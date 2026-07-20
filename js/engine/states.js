/**
 * Per-fact state machine: FLUENT / SLOW / UNSETTLED / UNKNOWN / STUCK.
 * (docs/DESIGN.md §2 fact-states table.)
 *
 * State is computed from the fact's rolling history of VALID attempts
 * (as classified by classify.js). Pure functions; the caller owns storage.
 *
 * SPEED IS JUDGED ON INITIATION ONLY (question shown → first keypress).
 * Typing time is logged and shown to parents but never classified on — see
 * STATES.FLUENT_CUTOFF_FLOOR_NET_MS for the reasoning and sources.
 *
 * UNSETTLED means "answering correctly, but not enough history to call it" —
 * fewer than WINDOW_SHORT valid attempts or spanning fewer than
 * MIN_DISTINCT_DAYS days. It is NOT a judgement about the child. This used to
 * collapse into SLOW, which both mislabelled the fact map ("slow (counting)")
 * and fed those facts to the scheduler as weak material at the old SLOW_WEIGHT
 * — so a child was drilled on facts he was answering correctly, purely for
 * having met them only twice. Speed no longer influences scheduling at all
 * (parent decision 2026-07-20, DESIGN §2): SLOW_WEIGHT is now STALE_WEIGHT and
 * applies only to facts unseen for FACT_STALE_DAYS.
 *
 * Per-fact record shape (kept in the state cache, capped):
 *   { attempts: [{correct, rt, init, countsRt, day}] (last ≤12 valid),
 *     totalAttempts, everThreeInRow, medianRt, medianInit, lastSeenDay, state }
 * medianRt is total (display, and the lapse/valid bands in classify.js);
 * medianInit is initiation (everything the state machine decides on).
 */
import { STATES } from '../config.js';

export const FACT_STATES = ['FLUENT', 'SLOW', 'UNSETTLED', 'UNKNOWN', 'STUCK'];

/**
 * States meaning "the child gets this right" (as opposed to UNKNOWN/STUCK).
 * UNSETTLED belongs here: it is an accurate fact awaiting enough history for a
 * speed verdict, and before UNSETTLED existed these facts were labelled SLOW
 * and counted toward the ladder mastery gate — so including them keeps
 * promotion behaving exactly as it did.
 */
export const ACCURATE_STATES = new Set(['FLUENT', 'SLOW', 'UNSETTLED']);

/** Append a classified answer to a fact record (returns a new record). */
export function appendAttempt(rec, ans, cls, day) {
    if (!cls.counts_for_accuracy) {
        // Non-evidence: only bump lastSeen so staleness doesn't refire it today.
        return { ...rec, lastSeenDay: day };
    }
    const correct = cls.forced_wrong ? false : ans.correct;
    const attempts = [...rec.attempts, {
        correct,
        rt: ans.initiation_ms + (ans.typing_ms || 0),
        init: ans.initiation_ms,
        countsRt: cls.counts_for_rt,
        day,
    }].slice(-12);
    let run = 0, everThreeInRow = rec.everThreeInRow;
    for (const a of attempts) { run = a.correct ? run + 1 : 0; if (run >= 3) everThreeInRow = true; }
    return {
        ...rec,
        attempts,
        totalAttempts: rec.totalAttempts + 1,
        everThreeInRow,
        medianRt: median(attempts.filter(a => a.countsRt).map(a => a.rt)) || rec.medianRt,
        medianInit: median(attempts.filter(a => a.countsRt).map(a => a.init)) || rec.medianInit,
        lastSeenDay: day,
    };
}

export function newFactRecord() {
    return { attempts: [], totalAttempts: 0, everThreeInRow: false, medianRt: 0, medianInit: 0, lastSeenDay: null, state: 'UNKNOWN' };
}

/**
 * Recompute a fact's state.
 * @param {object} rec        fact record
 * @param {number} speedCutoffMs  cutoff for THIS fact, in initiation ms —
 *                                the child's per-operation cutoff (childCutoff)
 *                                plus any problem-size allowance (factCutoff)
 */
export function factState(rec, speedCutoffMs) {
    const A = rec.attempts;
    if (!A.length) return 'UNKNOWN';

    const distinctDays = new Set(A.map(a => a.day)).size;
    const last10 = A.slice(-STATES.WINDOW_LONG);
    const last5 = A.slice(-STATES.WINDOW_SHORT);
    const acc5 = share(last5, a => a.correct);
    const acc10 = share(last10, a => a.correct);

    // STUCK: enough attempts, still no traction.
    if (rec.totalAttempts >= STATES.STUCK_MIN_ATTEMPTS &&
        (!rec.everThreeInRow || acc10 < STATES.STUCK_ACCURACY_OF_10)) {
        return 'STUCK';
    }

    // Not enough evidence yet (a state needs ≥2 distinct days). Answering
    // correctly → UNSETTLED (still measuring); not → UNKNOWN. Never SLOW:
    // "slow" is a claim about the child's speed and we have not measured it.
    if (A.length < STATES.WINDOW_SHORT || distinctDays < STATES.MIN_DISTINCT_DAYS) {
        return acc5 >= STATES.UNKNOWN_ACCURACY ? 'UNSETTLED' : 'UNKNOWN';
    }

    if (acc5 < STATES.UNKNOWN_ACCURACY) return 'UNKNOWN';

    // An already-FLUENT fact demotes on repeated recent slowness (≥3 of last
    // 5 valid over the cutoff), regardless of the longer window's median —
    // and never on a single lapse (lapses have countsRt=false).
    const slowOf5 = last5.filter(a => a.countsRt && a.init > speedCutoffMs).length;
    if (rec.state === 'FLUENT' && slowOf5 >= STATES.DEMOTE_SLOW_OF_5) return 'SLOW';

    // FLUENT: 9-of-last-10 correct AND median initiation under the cutoff.
    const rts = last10.filter(a => a.countsRt).map(a => a.init);
    const med = median(rts);
    const fluentAcc = last10.filter(a => a.correct).length >=
        Math.min(STATES.FLUENT_CORRECT_OF_10, last10.length);
    if (fluentAcc && med > 0 && med <= speedCutoffMs) return 'FLUENT';
    if (rec.state === 'FLUENT' && slowOf5 < STATES.DEMOTE_SLOW_OF_5) return 'FLUENT';
    return 'SLOW';
}

/**
 * Child's personal speed cutoff for one operation, in INITIATION ms: 2× their
 * own median initiation across facts currently FLUENT in that operation,
 * floored at FLUENT_CUTOFF_FLOOR_NET_MS.
 *
 * No typing term: a slow typer is no longer penalised because typing is not
 * classified on at all, which is a cleaner fix than the allowance it replaces
 * (a single scalar typing baseline corrected the mean and left the variance,
 * so it could never handle per-fact digit-count differences).
 *
 * @param {number[]} fluentMedians medianInit of the child's FLUENT facts (same op)
 */
export function childCutoff(fluentMedians) {
    const floor = STATES.FLUENT_CUTOFF_FLOOR_NET_MS;
    const base = median(fluentMedians);
    if (!base) return floor;
    return Math.max(floor, STATES.FLUENT_CUTOFF_MULT * base);
}

/**
 * True for times-table facts where both operands are large — genuinely slower
 * even when retrieved, so they get a problem-size allowance on top of the
 * cutoff.
 *
 * Multiplication only. The 317ms allowance is sourced to Dickson et al. (2022),
 * which measured it in multiplication. A problem-size effect exists in addition
 * too (Van Beek et al. 2014: 1129ms small → 1707ms large), but "both operands
 * ≥6" is a poor proxy for it — addition difficulty tracks bridging 10 and
 * carrying, so 7+6 would qualify while the harder 13+4 would not. Add/sub size
 * is handled structurally instead, by the ladder's family ordering.
 */
export function isLargeFact(id) {
    const m = /^(\d+)x(\d+)$/.exec(id);
    if (!m) return false;
    const lo = STATES.LARGE_FACT_MIN_OPERAND;
    return +m[1] >= lo && +m[2] >= lo;
}

/** Per-fact cutoff: the operation cutoff plus any problem-size allowance. */
export function factCutoff(id, opCutoffMs) {
    return opCutoffMs + (isLargeFact(id) ? STATES.LARGE_FACT_ALLOWANCE_MS : 0);
}

export function median(xs) {
    if (!xs || !xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function share(xs, pred) {
    return xs.length ? xs.filter(pred).length / xs.length : 0;
}
