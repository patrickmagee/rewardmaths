import { classifyAnswer, roundIsVoid, sessionIsVoid } from '../js/engine/classify.js';

export async function run({ eq, ok }) {
    const settled = { medianRt: 2100, validAttempts: 8, state: 'FLUENT' };
    const learning = { medianRt: 4000, validAttempts: 5, state: 'UNKNOWN' };
    const fresh = { medianRt: 0, validAttempts: 0, state: 'UNKNOWN' };

    // 60s on a normally-2s fact → the UI times out at 12s; lapse, not evidence.
    let c = classifyAnswer({ correct: false, initiation_ms: 11000, typing_ms: 1500, timeout: true }, settled);
    eq([c.counts_for_accuracy, c.counts_for_rt, c.exclusion_reason],
        [false, false, 'timeout'], 'timeout on FLUENT fact = lapse');

    // Timeout on an UNKNOWN fact = real negative evidence.
    c = classifyAnswer({ correct: false, initiation_ms: 11000, typing_ms: 1500, timeout: true }, learning);
    eq([c.counts_for_accuracy, c.forced_wrong], [true, true], 'timeout on UNKNOWN counts as wrong');

    // Anticipation.
    c = classifyAnswer({ correct: true, initiation_ms: 150, typing_ms: 300 }, settled);
    eq(c.exclusion_reason, 'anticipation', 'sub-300ms initiation discarded');

    // Rapid guess: wrong + fast = non-evidence.
    c = classifyAnswer({ correct: false, initiation_ms: 400, typing_ms: 200 }, learning);
    eq(c.exclusion_reason, 'rapid_guess', 'fast-wrong is a rapid guess');
    eq(c.counts_for_accuracy, false, 'rapid guess never counts against the fact');

    // Fast-CORRECT is not a rapid guess (could be genuine automaticity).
    c = classifyAnswer({ correct: true, initiation_ms: 400, typing_ms: 300 }, settled);
    eq(c.exclusion_reason, null, 'fast-correct is valid');

    // Lapse-suspect: correct but >3× the fact's median → accuracy-only.
    c = classifyAnswer({ correct: true, initiation_ms: 7000, typing_ms: 500 }, settled);
    eq([c.counts_for_accuracy, c.counts_for_rt, c.exclusion_reason],
        [true, false, 'lapse_suspect'], 'slow-correct = accuracy only');

    // Same RT on a fact with no median yet → valid (bands need 3 attempts).
    c = classifyAnswer({ correct: true, initiation_ms: 7000, typing_ms: 500 }, fresh);
    eq(c.exclusion_reason, null, 'no bands before 3 valid attempts');

    // Wrong-and-slow = full negative evidence.
    c = classifyAnswer({ correct: false, initiation_ms: 5000, typing_ms: 600 }, settled);
    eq([c.counts_for_accuracy, c.counts_for_rt], [true, true], 'effortful error counts fully');

    // Round/session voiding.
    const excl = { exclusion_reason: 'rapid_guess' };
    const okAns = { exclusion_reason: null };
    ok(roundIsVoid([excl, excl, excl, okAns]), '3 exclusions void a round');
    ok(!roundIsVoid([excl, excl, okAns, okAns]), '2 exclusions do not');
    ok(sessionIsVoid([excl, excl, excl, okAns, okAns, okAns, okAns, okAns, okAns, okAns]),
        '>20% exclusions void a session');
}
