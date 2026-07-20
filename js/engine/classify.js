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

    // 1. Timeout / hard ceiling. Uses the ceiling stamped on the answer — the
    // one the child actually played against — so re-deriving an old log after
    // a parent changes the setting can't retroactively flip past attempts into
    // timeouts (and with them fact states, void rounds, medals). Records
    // written before ceiling_ms existed fall back to the default.
    if (ans.timeout || total >= (ans.ceiling_ms || RT.HARD_CEILING_MS)) {
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
        // engine removed: a forced-wrong timeout sends it to UNKNOWN, not
        // SLOW (factState never returns SLOW without enough evidence), and
        // UNKNOWN is the correct reading of a fact the child just failed.
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
