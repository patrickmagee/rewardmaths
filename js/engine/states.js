/**
 * Per-fact state machine: FLUENT / SLOW / UNKNOWN / STUCK.
 * (docs/DESIGN.md §2 fact-states table.)
 *
 * State is computed from the fact's rolling history of VALID attempts
 * (as classified by classify.js). Pure functions; the caller owns storage.
 *
 * Per-fact record shape (kept in the state cache, capped):
 *   { attempts: [{correct, rt, countsRt, day}] (last ≤12 valid),
 *     totalAttempts, everThreeInRow, medianRt, lastSeenDay, state }
 */
import { STATES } from '../config.js';

export const FACT_STATES = ['FLUENT', 'SLOW', 'UNKNOWN', 'STUCK'];

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
        lastSeenDay: day,
    };
}

export function newFactRecord() {
    return { attempts: [], totalAttempts: 0, everThreeInRow: false, medianRt: 0, lastSeenDay: null, state: 'UNKNOWN' };
}

/**
 * Recompute a fact's state.
 * @param {object} rec        fact record
 * @param {number} speedCutoffMs  child's personal cutoff for this operation
 *                                (1.5× own fluent-median, floored) — see childCutoff()
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

    // Not enough evidence yet → UNKNOWN (a state needs ≥2 distinct days).
    if (A.length < STATES.WINDOW_SHORT || distinctDays < STATES.MIN_DISTINCT_DAYS) {
        return acc5 >= STATES.UNKNOWN_ACCURACY ? 'SLOW' : 'UNKNOWN';
    }

    if (acc5 < STATES.UNKNOWN_ACCURACY) return 'UNKNOWN';

    // An already-FLUENT fact demotes on repeated recent slowness (≥2 of last
    // 5 valid over the cutoff), regardless of the longer window's median —
    // and never on a single lapse (lapses have countsRt=false).
    const slowOf5 = last5.filter(a => a.countsRt && a.rt > speedCutoffMs).length;
    if (rec.state === 'FLUENT' && slowOf5 >= STATES.DEMOTE_SLOW_OF_5) return 'SLOW';

    // FLUENT: 9-of-last-10 correct AND median under the personal cutoff.
    const rts = last10.filter(a => a.countsRt).map(a => a.rt);
    const med = median(rts);
    const fluentAcc = last10.filter(a => a.correct).length >=
        Math.min(STATES.FLUENT_CORRECT_OF_10, last10.length);
    if (fluentAcc && med > 0 && med <= speedCutoffMs) return 'FLUENT';
    if (rec.state === 'FLUENT' && slowOf5 < STATES.DEMOTE_SLOW_OF_5) return 'FLUENT';
    return 'SLOW';
}

/**
 * Child's personal speed cutoff for one operation: 1.5× their own median RT
 * across facts currently FLUENT in that operation, floored at a net thinking
 * floor PLUS the child's measured typing baseline — so a slow typer can still
 * bootstrap into FLUENT (their cutoff starts higher, then self-normalises).
 * @param {number[]} fluentMedians medianRt of the child's FLUENT facts (same op)
 * @param {number} typingMs        child's typing baseline for this input method
 */
export function childCutoff(fluentMedians, typingMs = STATES.DEFAULT_TYPING_MS) {
    const floor = STATES.FLUENT_CUTOFF_FLOOR_NET_MS + typingMs;
    const base = median(fluentMedians);
    if (!base) return floor;
    return Math.max(floor, STATES.FLUENT_CUTOFF_MULT * base);
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
