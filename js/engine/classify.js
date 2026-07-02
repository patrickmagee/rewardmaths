/**
 * RT-cleaning classifier (docs/DESIGN.md §2, docs/research/05 §1).
 * Pure: classifies every answer at write time, never mutates raw data.
 * Ordered rules, first match wins. Asymmetry is deliberate: fast-wrong is
 * non-evidence, slow-correct is accuracy-only, slow-wrong counts fully.
 */
import { RT } from '../config.js';

/**
 * @param {object} ans   { correct, initiation_ms, typing_ms, timeout? }
 * @param {object} fact  { medianRt, validAttempts, state } — medianRt of prior
 *                       VALID attempts (total ms); state FLUENT/SLOW/UNKNOWN/STUCK
 * @returns {{ counts_for_accuracy: boolean, counts_for_rt: boolean,
 *             counts_as_retrieval: boolean, exclusion_reason: string|null }}
 */
export function classifyAnswer(ans, fact) {
    const total = ans.initiation_ms + (ans.typing_ms || 0);
    const bandsApply = fact.validAttempts >= RT.MIN_ATTEMPTS_FOR_BANDS && fact.medianRt > 0;

    // 1. Timeout / hard ceiling (the UI auto-advances at HARD_CEILING_MS).
    if (ans.timeout || total >= RT.HARD_CEILING_MS) {
        const settled = fact.state === 'FLUENT' || fact.state === 'SLOW';
        return settled
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
 * Session-void check: a round/session with too many exclusions is junk for
 * state updates (and doesn't count toward medals).
 * @param {Array<{exclusion_reason: string|null}>} classified
 */
export function roundIsVoid(classified) {
    const excluded = classified.filter(c => c.exclusion_reason
        && c.exclusion_reason !== 'lapse_suspect').length;
    return excluded >= RT.VOID_EXCLUSIONS_PER_ROUND;
}

/** @param {Array} classifiedSession all classified answers today */
export function sessionIsVoid(classifiedSession) {
    if (!classifiedSession.length) return false;
    const excluded = classifiedSession.filter(c => c.exclusion_reason
        && c.exclusion_reason !== 'lapse_suspect').length;
    return excluded / classifiedSession.length > RT.VOID_EXCLUSION_RATE;
}
