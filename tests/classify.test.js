import { classifyAnswer, roundIsVoid, sessionIsVoid, ceilingMs } from '../js/engine/classify.js';
import { newFactRecord, appendAttempt, factState } from '../js/engine/states.js';
import { weakTargets } from '../js/engine/scheduler.js';
import { newChildState } from '../js/engine/adapt.js';
import { RT } from '../js/config.js';

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

    // Regression (Eliza, 2026-07-19): a child who simply RUNS OUT OF TIME is
    // not a masher. Timeouts are evidence (DESIGN §2 — they drive a fact to
    // UNKNOWN); the void rule covers mashes/anticipations only (DESIGN §3).
    // Voiding on timeouts discarded her whole session and reported it to the
    // parent as "rapid guessing".
    const slowOut = { exclusion_reason: 'timeout' };
    ok(!roundIsVoid([slowOut, slowOut, slowOut, slowOut, okAns]),
        'timeouts never void a round — slow is not guessing');
    ok(!sessionIsVoid([slowOut, slowOut, slowOut, slowOut, slowOut, okAns]),
        'a timeout-heavy session still counts');
    ok(!roundIsVoid([{ exclusion_reason: 'lapse_suspect' }, { exclusion_reason: 'lapse_suspect' },
        { exclusion_reason: 'lapse_suspect' }]), 'lapse-suspects never void');
    // …but genuine disengagement still voids, mixed in with slowness.
    ok(roundIsVoid([{ exclusion_reason: 'anticipation' }, excl,
        { exclusion_reason: 'anticipation' }, slowOut, okAns]),
        'mashes/anticipations still void a round');

    // ---- per-child auto-advance ceiling (parent-tunable) ----

    eq(ceilingMs(), RT.HARD_CEILING_MS, 'no settings → a-priori default');
    eq(ceilingMs({}), RT.HARD_CEILING_MS, 'empty settings → default');
    eq(ceilingMs({ ceilingMs: 20000 }), 20000, 'in-range override honoured');
    eq(ceilingMs({ ceilingMs: 500 }), RT.HARD_CEILING_MIN_MS, 'below floor clamps up');
    eq(ceilingMs({ ceilingMs: 999000 }), RT.HARD_CEILING_MAX_MS, 'above cap clamps down');
    eq(ceilingMs({ ceilingMs: 'nonsense' }), RT.HARD_CEILING_MS, 'junk falls back to default');
    eq(ceilingMs({ ceilingMs: 0 }), RT.HARD_CEILING_MS, 'zero falls back (never a 0ms ceiling)');

    // The ceiling is read per-answer, so raising a child's timeout does NOT
    // retroactively rescue past attempts that already timed out…
    c = classifyAnswer({ correct: false, initiation_ms: 12000, typing_ms: 0,
        timeout: true, ceiling_ms: 12000 }, learning);
    eq(c.exclusion_reason, 'timeout', 'old 12s timeout stays a timeout');

    // …and lowering it does NOT retroactively convict past valid attempts.
    // 14s answer logged under a 20s ceiling stays full evidence — this is the
    // immutability guarantee (it holds whatever the current default is).
    c = classifyAnswer({ correct: false, initiation_ms: 13000, typing_ms: 1000,
        timeout: false, ceiling_ms: 20000 }, fresh);
    eq([c.counts_for_accuracy, c.counts_for_rt, c.exclusion_reason],
        [true, true, null], 'answer under its own ceiling is valid, not a timeout');

    // Immutability now hinges on the play-time `timeout` flag, not on
    // re-reading ceiling_ms at derive time. A timeout:true record IS a timeout
    // whatever the current default…
    c = classifyAnswer({ correct: false, initiation_ms: 6000, typing_ms: 700,
        timeout: true, ceiling_ms: 6000 }, learning);
    eq(c.exclusion_reason, 'timeout', 'timeout:true is a timeout (flag is truth)');

    // …and a record OVER a ceiling but with timeout:false is NOT forged into a
    // timeout: a timed round would have stamped timeout:true the instant it
    // advanced, so this can only be an untimed round (see FIX #4 below).
    c = classifyAnswer({ correct: true, initiation_ms: 6500, typing_ms: 200,
        timeout: false, ceiling_ms: 6000 }, fresh);
    eq(c.exclusion_reason, null, 'over its own ceiling but timeout:false = untimed, valid');

    // Legacy records (written before ceiling_ms existed) are classified by their
    // own timeout flag. A legacy timeout carries timeout:true and stays a
    // timeout; an untimed-round record carries timeout:false and, however slow,
    // is full evidence — the derive-time ceiling is never re-imposed.
    c = classifyAnswer({ correct: false, initiation_ms: RT.HARD_CEILING_MS + 500,
        typing_ms: 0, timeout: true }, learning);
    eq(c.exclusion_reason, 'timeout', 'legacy timeout:true stays a timeout');
    c = classifyAnswer({ correct: false, initiation_ms: RT.HARD_CEILING_MS + 500,
        typing_ms: 0, timeout: false }, fresh);
    eq(c.exclusion_reason, null, 'slow answer with timeout:false is not forged into a timeout');
    c = classifyAnswer({ correct: false, initiation_ms: RT.HARD_CEILING_MS - 500, typing_ms: 0 }, fresh);
    eq(c.exclusion_reason, null, 'answer under the default is full evidence');

    // ---- FIX #4 (Eliza, 2026-07-20): untimed rounds must not be re-ceilinged ----
    // Untimed rounds (placement, blocked warm-up, shaky-family focus) never arm
    // the auto-advance clock, so session.js never stamps timeout:true on them.
    // The old classifier ALSO fired on `total >= ceiling_ms`, forging a timeout
    // at derive time and flipping a slow-but-CORRECT answer to forced_wrong.
    // Real case: Eliza's 6×8 on an untimed placement round — 40.8s initiation,
    // correct, ceiling 40000 → total 43551 ≥ 40000 → forced_wrong → fact UNKNOWN
    // → parent told "not secure", requeued for re-teach of a fact she got RIGHT.
    c = classifyAnswer({ correct: true, initiation_ms: 40800, typing_ms: 2751,
        timeout: false, ceiling_ms: 40000 }, fresh);
    eq([c.forced_wrong, c.counts_for_accuracy, c.exclusion_reason],
        [undefined, true, null], 'untimed slow-correct stays correct, not forced_wrong');

    // The genuine timeout it must NOT weaken: same fact, timer actually fired.
    c = classifyAnswer({ correct: false, initiation_ms: 40000, typing_ms: 0,
        timeout: true, ceiling_ms: 40000 }, learning);
    eq([c.forced_wrong, c.exclusion_reason], [true, 'timeout'],
        'a real timeout:true still counts as negative evidence');

    // FIX #4 (B): the comment above rule 1 must not drift from code. A forced-
    // wrong timeout does NOT always land on UNKNOWN — 4 corrects over 2 days then
    // a timeout resolves to SLOW (acc 4/5 = 0.80 clears the UNKNOWN gate; 4/5
    // correct misses the FLUENT bar; falls through to SLOW). Benign post-decouple
    // (SLOW no longer schedules), but the boundary is asserted so it stays true.
    let slowRec = newFactRecord();
    const good = { correct: true, initiation_ms: 1200, typing_ms: 400, timeout: false };
    for (const day of ['2026-07-01', '2026-07-01', '2026-07-02', '2026-07-02']) {
        const cg = classifyAnswer(good, { medianRt: slowRec.medianRt, validAttempts: slowRec.attempts.length, state: slowRec.state });
        slowRec = appendAttempt(slowRec, good, cg, day);
        slowRec.state = factState(slowRec, 2500);
    }
    eq(slowRec.state, 'UNSETTLED', '4 corrects over 2 days = UNSETTLED (still non-settled)');
    const lapse = { correct: false, initiation_ms: 40000, typing_ms: 0, timeout: true, ceiling_ms: 40000 };
    const cl = classifyAnswer(lapse, { medianRt: slowRec.medianRt, validAttempts: slowRec.attempts.length, state: slowRec.state });
    ok(cl.forced_wrong, 'timeout on the non-settled fact is forced_wrong');
    slowRec = appendAttempt(slowRec, lapse, cl, '2026-07-03');
    slowRec.state = factState(slowRec, 2500);
    eq(slowRec.state, 'SLOW', '4-correct-then-timeout resolves to SLOW, not UNKNOWN (anchors the rule-1 comment)');

    // ---- UNSETTLED must not be an absorbing state (regression, 2026-07-20) ----
    // Lapse-forgiveness on a timeout belongs to FLUENT/SLOW only. When UNSETTLED
    // was forgiven too, the attempt was never appended, so the record could not
    // grow the history that would re-judge it, and weakTargets (UNKNOWN/STUCK
    // only) never remediated it: a fact failed 33 times over 11 days stayed at
    // attempts=2 / UNSETTLED, invisible to child and parent alike.
    const unsettled = { medianRt: 1600, medianInit: 1200, validAttempts: 2, state: 'UNSETTLED' };
    c = classifyAnswer({ correct: false, initiation_ms: 40000, typing_ms: 0,
        timeout: true, ceiling_ms: 40000 }, unsettled);
    eq([c.counts_for_accuracy, c.forced_wrong],
        [true, true], 'timeout on UNSETTLED is evidence, not a forgiven lapse');

    // End to end: two correct answers then sustained timeouts must escape.
    let rec = newFactRecord();
    for (let i = 0; i < 2; i++) {
        const a = { correct: true, initiation_ms: 1200, typing_ms: 400, timeout: false };
        rec = appendAttempt(rec, a, classifyAnswer(a, { ...rec, validAttempts: rec.attempts.length }), '2026-07-01');
        rec.state = factState(rec, 2500);
    }
    eq(rec.state, 'UNSETTLED', 'two same-day correct answers = UNSETTLED');
    for (let d = 2; d <= 12; d++) {
        const day = `2026-07-${String(d).padStart(2, '0')}`;
        for (let i = 0; i < 3; i++) {
            const a = { correct: false, initiation_ms: 40000, typing_ms: 0, timeout: true, ceiling_ms: 40000 };
            rec = appendAttempt(rec, a, classifyAnswer(a, { ...rec, validAttempts: rec.attempts.length }), day);
            rec.state = factState(rec, 2500);
        }
    }
    ok(rec.totalAttempts > 2, `sustained timeouts are recorded (${rec.totalAttempts} attempts)`);
    ok(rec.state === 'UNKNOWN' || rec.state === 'STUCK',
        `a fact failed 33 times is weak, not "${rec.state}"`);

    const st = newChildState();
    st.facts['7x8'] = rec;
    ok(weakTargets(st, { day: '2026-07-13', retrievalsToday: {} }).some(t => t.id === '7x8'),
        'a repeatedly failed fact is scheduled for remediation');
}
