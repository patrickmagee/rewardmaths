/**
 * RT-cleaning classifier (docs/DESIGN.md §2, docs/research/05 §1).
 * Pure: classifies every answer at write time, never mutates raw data.
 * Ordered rules, first match wins. Asymmetry is deliberate: fast-wrong is
 * non-evidence, slow-correct is accuracy-only, slow-wrong counts fully.
 */
import { RT } from '../config.js';

/**
 * States that have earned lapse-forgiveness on a timeout — i.e. the engine has
 * actually established the child can retrieve the fact. Deliberately NARROWER
 * than states.js ACCURATE_STATES, which includes UNSETTLED: that set exists for
 * the ladder mastery gate, where counting accurate-but-young facts is right.
 * Here it is not — see the timeout rule below.
 */
const SETTLED_STATES = new Set(['FLUENT', 'SLOW']);

/**
 * The auto-advance ceiling for a child, in ms. Defaults to the a-priori
 * RT.HARD_CEILING_MS; the per-child override (settings.ceilingMs) exists for
 * children who need longer to answer (accessibility), NOT for tuning the
 * engine to a child's data. Classification bands are unchanged by it.
 *
 * Clamped to [HARD_CEILING_MIN_MS, HARD_CEILING_MAX_MS] so a mis-set or
 * hand-edited value can't destroy the evidence base. Pure — settings is a
 * defaulted trailing param, as with isEasyDay(), so callers work without it.
 * @param {{ceilingMs?: number}} [settings]  a child's profile.settings
 */
export function ceilingMs(settings = {}) {
    const v = Number(settings.ceilingMs);
    if (!Number.isFinite(v) || v <= 0) return RT.HARD_CEILING_MS;
    return Math.min(RT.HARD_CEILING_MAX_MS, Math.max(RT.HARD_CEILING_MIN_MS, Math.round(v)));
}

/**
 * @param {object} ans   { correct, initiation_ms, typing_ms, timeout?, ceiling_ms? }
 * @param {object} fact  { medianRt, validAttempts, state } — medianRt of prior
 *                       VALID attempts (total ms; the lapse/valid bands are
 *                       deliberately total-time, unlike the state machine's
 *                       speed cutoff which is initiation-only);
 *                       state FLUENT/SLOW/UNSETTLED/UNKNOWN/STUCK
 * @returns {{ counts_for_accuracy: boolean, counts_for_rt: boolean,
 *             counts_as_retrieval: boolean, exclusion_reason: string|null }}
 */
export function classifyAnswer(ans, fact) {
    const total = ans.initiation_ms + (ans.typing_ms || 0);
    const bandsApply = fact.validAttempts >= RT.MIN_ATTEMPTS_FOR_BANDS && fact.medianRt > 0;

    // 1. Timeout. Trust the play-time `timeout` flag ALONE — the round screen
    // sets it iff the auto-advance timer actually fired (session.js), which is
    // the ground truth of a hit ceiling. We deliberately do NOT re-impose the
    // ceiling at derive time (`total >= ceiling_ms`): untimed rounds (placement,
    // blocked warm-up, shaky-family focus) never arm the clock, so a slow answer
    // there is genuine thinking, not a timeout — yet a total over the ceiling
    // would forge one, flipping a correct answer to forced_wrong (real case:
    // Eliza's 6×8, 40.8s init, correct, on an untimed placement round, shown to
    // the parent as "not secure" and requeued for re-teach). Because a TIMED
    // round stamps timeout:true the instant it advances, a timeout:false record
    // over the ceiling can ONLY be an untimed round, making the old arm redundant
    // for timed play and wrong for untimed. This also makes immutability simpler:
    // the flag is fixed at write time, so changing the ceiling setting can never
    // reclassify history (ceiling_ms is still stamped, now purely informational).
    // Legacy records predate untimed rounds and carry their own timeout flag.
    if (ans.timeout) {
        // 1a. Timeouts that were never a verdict on knowledge (2026-07-28).
        //
        // (i) The 12-SECOND ERA. Records written before 2026-07-20 carry no
        // ceiling_ms (the field was added with the 40s fix — verified across
        // both children's full logs: absent on every earlier day, 40000 on
        // every later one). 12s cut off genuine working-out wholesale, and the
        // wreckage is still steering the engine: 26 facts across the two
        // children sit UNKNOWN on those timeouts alone with ZERO wrong answers
        // ever — Tom's include 2×5 and 9×10. UNKNOWN is excluded from the mixed
        // pool (scheduler.mixedRound takes FLUENT/SLOW/UNSETTLED only) and
        // rationed to FOCUS_WEAK_FACTS per focus round, so the effect is not
        // cosmetic: Eliza's whole 7/8/9 core was frozen out of circulation for
        // a week. Raw records stay exactly as written (append-only) — we simply
        // stop reading a retired ceiling as evidence, and the facts get judged
        // on how the child does now.
        //
        // (ii) SPRINT. The sprint runs a deliberately short ceiling
        // (RT.SPRINT_CEILING_MS) so one stall can't eat the 60s probe. Letting
        // that count as negative evidence would rebuild the 12s trap on a
        // one-week cycle, so it doesn't.
        //
        // Both are non-evidence, NOT forced-wrong: counts_as_retrieval false
        // means states.appendAttempt skips them entirely.
        if (!Number.isFinite(ans.ceiling_ms) || ans.ceiling_ms <= 0) {
            return res(false, false, false, 'legacy_timeout');
        }
        if (ans.round_type === 'sprint') {
            return res(false, false, false, 'sprint_timeout');
        }
        // A timeout on a fact the child DEMONSTRABLY knows is a lapse, not
        // ignorance — but only FLUENT/SLOW carry that demonstration. UNSETTLED
        // means precisely "not enough history to judge yet", so forgiving its
        // timeouts made it an absorbing state: the attempt isn't appended
        // (states.js appendAttempt early-returns on non-evidence), so the
        // record can never grow the history that would re-judge it, and
        // weakTargets only remediates UNKNOWN/STUCK. Measured: 33 timeouts
        // over 11 days left a fact at attempts=2, state=UNSETTLED, never
        // practised again — invisible to the child and to the parent.
        // Excluding UNSETTLED does NOT reintroduce the spurious amber this
        // engine removed. A forced-wrong timeout usually sends a thin-history
        // fact to UNKNOWN. It CAN land on SLOW at the 5th attempt — e.g. 4
        // corrects over 2 days then a timeout: acc 4/5 = 0.80 clears the UNKNOWN
        // gate but the 4/5 correct count misses the FLUENT bar, so it falls
        // through to SLOW (verified against states.factState). That is benign:
        // post-decouple (parent decision 2026-07-20) SLOW no longer drives
        // scheduling at all, so it earns the child no extra drilling, and the
        // fact self-heals to FLUENT/UNSETTLED on the next within-ceiling correct.
        return SETTLED_STATES.has(fact.state)
            ? res(false, false, false, 'timeout')      // lapse on a known fact
            : res(true, false, false, 'timeout', false); // real negative evidence
    }

    // 2. Anticipation floor.
    if (ans.initiation_ms < RT.ANTICIPATION_FLOOR_MS) {
        return res(false, false, false, 'anticipation');
    }

    // 3. Rapid guess (wrong + fast) — disengagement, not knowledge.
    if (!ans.correct && ans.initiation_ms < RT.RAPID_GUESS_MS) {
        return res(false, false, false, 'rapid_guess');
    }

    // 4. Lapse-suspect: correct but way over this fact's own median.
    if (ans.correct && bandsApply && total > RT.LAPSE_MEDIAN_MULT * fact.medianRt) {
        return res(true, false, true, 'lapse_suspect');
    }

    // 5./6. Valid band (correct or effortful-wrong): full evidence.
    return res(true, true, ans.correct, null);
}

function res(acc, rt, retrieval, reason, correctOverride) {
    return {
        counts_for_accuracy: acc,
        counts_for_rt: rt,
        counts_as_retrieval: !!retrieval, // consumes the fact's daily budget only on correct retrievals
        exclusion_reason: reason,
        forced_wrong: correctOverride === false || undefined,
    };
}

/**
 * Disengagement only — the child was mashing, not working.
 * DESIGN §3 scopes the void rule to "mashes/anticipations". A `timeout` is
 * NOT disengagement: per DESIGN §2 a timeout on an unsettled fact is real
 * negative evidence (it is what drives a fact to UNKNOWN), and a timeout on a
 * settled fact is a lapse. Counting timeouts here discarded the rounds of any
 * child who was simply slow — the opposite of the intent.
 */
const DISENGAGED = new Set(['anticipation', 'rapid_guess']);

/**
 * Every exclusion_reason that means "the auto-advance timer fired". The parent
 * dashboard counts all of them as timeouts — they genuinely happened and the
 * history stays truthful; what changed in 1a is only whether they steer the
 * engine. Consumers must use this rather than `=== 'timeout'`.
 */
export const TIMEOUT_REASONS = new Set(['timeout', 'legacy_timeout', 'sprint_timeout']);
export const isTimeoutReason = r => TIMEOUT_REASONS.has(r);

const disengagedCount = list =>
    list.filter(c => DISENGAGED.has(c.exclusion_reason)).length;

/**
 * Session-void check: a round/session with too much mashing is junk for
 * state updates (and doesn't count toward medals).
 * @param {Array<{exclusion_reason: string|null}>} classified
 */
export function roundIsVoid(classified) {
    return disengagedCount(classified) >= RT.VOID_EXCLUSIONS_PER_ROUND;
}

/** @param {Array} classifiedSession all classified answers today */
export function sessionIsVoid(classifiedSession) {
    if (!classifiedSession.length) return false;
    return disengagedCount(classifiedSession) / classifiedSession.length
        > RT.VOID_EXCLUSION_RATE;
}
