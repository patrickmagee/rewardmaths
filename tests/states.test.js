import { newFactRecord, appendAttempt, factState, childCutoff, isLargeFact, factCutoff } from '../js/engine/states.js';
import { STATES } from '../js/config.js';

const VALID = { counts_for_accuracy: true, counts_for_rt: true, counts_as_retrieval: true, exclusion_reason: null };
const LAPSE = { counts_for_accuracy: true, counts_for_rt: false, exclusion_reason: 'lapse_suspect' };
const GUESS = { counts_for_accuracy: false, counts_for_rt: false, exclusion_reason: 'rapid_guess' };

/** `rt` is INITIATION ms (what the state machine judges); `t` is typing ms
 *  (logged, shown to parents, deliberately never classified on). */
function drill(rec, specs) {
    let r = rec, day = 0;
    for (const s of specs) {
        day = s.day ?? day;
        r = appendAttempt(r, { correct: s.c, initiation_ms: s.rt, typing_ms: s.t ?? 0 }, s.cls || VALID, `2026-07-${String(day + 1).padStart(2, '0')}`);
    }
    return r;
}

/** n correct attempts at a fixed initiation, split across `days` distinct days. */
function corrects(n, rt, days = 2, extra = {}) {
    return Array.from({ length: n }, (_, i) => ({
        c: true, rt, day: Math.floor(i * days / n), ...extra,
    }));
}

export async function run({ eq, ok }) {
    const cutoff = 3000;

    // Fresh fact is UNKNOWN.
    eq(factState(newFactRecord(), cutoff), 'UNKNOWN', 'fresh fact UNKNOWN');

    // 10 fast corrects across 2 days → FLUENT.
    let r = drill(newFactRecord(), Array.from({ length: 10 }, (_, i) => ({ c: true, rt: 1800, day: i < 5 ? 0 : 1 })));
    eq(factState(r, cutoff), 'FLUENT', 'fast+accurate = FLUENT');

    // Same accuracy but slow → SLOW.
    r = drill(newFactRecord(), Array.from({ length: 10 }, (_, i) => ({ c: true, rt: 5000, day: i < 5 ? 0 : 1 })));
    eq(factState(r, cutoff), 'SLOW', 'accurate but slow = SLOW');

    // All attempts on ONE day → no settled state yet (needs ≥2 distinct days).
    r = drill(newFactRecord(), Array.from({ length: 10 }, () => ({ c: true, rt: 1800, day: 0 })));
    ok(factState(r, cutoff) !== 'FLUENT', 'single-day evidence cannot settle FLUENT');

    // One slow-correct lapse does NOT demote a FLUENT fact.
    r = drill(newFactRecord(), Array.from({ length: 10 }, (_, i) => ({ c: true, rt: 1800, day: i < 5 ? 0 : 1 })));
    r.state = factState(r, cutoff);
    r = drill(r, [{ c: true, rt: 9000, cls: LAPSE, day: 2 }]);
    eq(factState(r, cutoff), 'FLUENT', 'single lapse never demotes FLUENT');

    // 2-of-last-5 slow is NOT enough to demote (DEMOTE_SLOW_OF_5 = 3): promotion
    // tests a median of 10, so demoting on 2 raw attempts out of 5 was a much
    // weaker standard than promotion, and a genuinely fluent fact tripped it on
    // roughly a coin flip per window.
    r = drill(r, [{ c: true, rt: 4200, day: 3 }, { c: true, rt: 4400, day: 4 }]);
    eq(factState(r, cutoff), 'FLUENT', '2-of-5 slow does not demote');

    // 3-of-last-5 does.
    r = drill(r, [{ c: true, rt: 4600, day: 5 }]);
    eq(factState(r, cutoff), 'SLOW', 'repeated slowness demotes to SLOW');

    // Rapid guesses never move a state.
    r = drill(newFactRecord(), Array.from({ length: 10 }, (_, i) => ({ c: true, rt: 1800, day: i < 5 ? 0 : 1 })));
    r.state = factState(r, cutoff);
    const before = factState(r, cutoff);
    r = drill(r, Array.from({ length: 5 }, () => ({ c: false, rt: 350, cls: GUESS, day: 5 })));
    eq(factState(r, cutoff), before, 'mashing cannot change state');

    // STUCK: ≥10 attempts, never 3-in-a-row.
    r = drill(newFactRecord(), Array.from({ length: 12 }, (_, i) => ({ c: i % 2 === 0, rt: 4000, day: i % 3 })));
    eq(factState(r, cutoff), 'STUCK', 'alternating errors = STUCK');

    // ---- personal speed cutoff (INITIATION ms; no typing term at all) ----

    // Floor applies with no fluent facts to median. 2500ms is the researched
    // a-priori constant (DESIGN §2), asserted as a literal so drifting it
    // requires editing this test on purpose.
    eq(childCutoff([]), 2500, 'cutoff floor with no data');
    eq(childCutoff([]), STATES.FLUENT_CUTOFF_FLOOR_NET_MS, 'floor is the configured constant');
    // A very fast child does not get a punitively tight cutoff: the floor wins.
    eq(childCutoff([800, 900, 1000]), 2500, 'floor wins over a fast personal median');
    // Above the floor the personal term runs: 1.5× the child's own fluent
    // median — the SAME 1.5 the floor itself is derived with (DESIGN §2), so a
    // cutoff always means "1.5 × a fluent median" and only the median changes.
    eq(childCutoff([2000, 2200, 1800]), 3000, 'cutoff = 1.5× fluent median');
    // Asserted as a literal: 2.0 was tried on 2026-07-20 and reverted, because
    // the cutoff is self-referential and at 2.0 its fixed point passes ~92% of
    // a child's facts however slow the child is — and 2.0 put a mid-range
    // child past Wu et al. 2008's 3662ms ROC optimum, which DESIGN §2 requires
    // staying below. Raising this again should require editing this test.
    eq(STATES.FLUENT_CUTOFF_MULT, 1.5, 'personal multiplier matches the floor derivation');
    // Tom's real measured median initiation on times tables is 1756ms
    // (DESIGN §2). Even his HARDEST facts — personal term + large-fact
    // allowance — must stay below Wu et al. 2008's 3662.5ms ROC optimum, which
    // was measured at age 8.05 by experimenter keypress and which DESIGN §2
    // argues is an upper bound we sit below. At MULT 2.0 this came to 3812ms,
    // i.e. past it. (A genuinely slow child's personal term may exceed Wu by
    // design — the term is relative and Wu is absolute. This asserts the
    // mid-range case, which is the one that must not drift.)
    ok(factCutoff('7x7', childCutoff([1700, 1756, 1800])) < 3662,
        "a mid-range child's hardest facts stay below the Wu 2008 optimum");

    // ---- UNSETTLED: correct, but not yet enough history for a speed verdict ----

    // 4 valid corrects on ONE day. Not FLUENT (too little evidence) and, above
    // all, not SLOW — "slow" is a claim about the child we have not measured.
    r = drill(newFactRecord(), corrects(4, 1800, 1));
    eq(factState(r, cutoff), 'UNSETTLED', '4 corrects on 1 day = UNSETTLED');

    // Spanning 2 days does not rescue it: WINDOW_SHORT (5) attempts are needed
    // as well as MIN_DISTINCT_DAYS days.
    r = drill(newFactRecord(), corrects(4, 1800, 2));
    eq(factState(r, cutoff), 'UNSETTLED', '4 corrects over 2 days still UNSETTLED');

    // Enough history + fast initiation → a real verdict.
    r = drill(newFactRecord(), corrects(6, 1800, 2));
    eq(factState(r, cutoff), 'FLUENT', '6 corrects over 2 days, fast = FLUENT');

    // Enough history + slow initiation → SLOW, which is now a measured claim.
    r = drill(newFactRecord(), corrects(6, 4200, 2));
    eq(factState(r, cutoff), 'SLOW', '6 corrects over 2 days, slow = SLOW');

    // Low accuracy is UNKNOWN, not UNSETTLED — UNSETTLED means "getting it right".
    r = drill(newFactRecord(), [{ c: true, rt: 1800, day: 0 }, { c: false, rt: 1800, day: 0 },
        { c: false, rt: 1800, day: 1 }]);
    eq(factState(r, cutoff), 'UNKNOWN', 'inaccurate + thin history = UNKNOWN, not UNSETTLED');

    // ---- REGRESSION: typing time must never make a fact look SLOW ----
    // This is the defect that motivated moving classification onto initiation
    // only. Total RT = 1200 initiation + 3000 typing = 4200ms, well over the
    // cutoff, so under the old total-RT rule this fact was SLOW purely because
    // the child types slowly / the answer has more digits. The retrieval itself
    // is fast, so it must reach FLUENT.
    r = drill(newFactRecord(), corrects(6, 1200, 2, { t: 3000 }));
    ok(r.medianRt > cutoff, 'setup: total RT is over the cutoff (old rule would say SLOW)');
    ok(r.medianInit <= cutoff, 'setup: initiation alone is under the cutoff');
    eq(factState(r, cutoff), 'FLUENT', 'slow TYPING never blocks FLUENT — only slow initiation does');

    // ---- problem-size allowance ----

    ok(isLargeFact('7x8'), '7x8 is a large fact (both operands ≥ 6)');
    ok(isLargeFact('6x6'), '6x6 is large — the bound is inclusive');
    ok(!isLargeFact('3x4'), '3x4 is not a large fact');
    ok(!isLargeFact('5x9'), 'one large operand is not enough');
    eq(factCutoff('7x8', 2500), 2800, 'large fact gets the +300ms allowance');
    eq(factCutoff('3x4', 2500), 2500, 'small fact gets no allowance');
    eq(factCutoff('7x8', 2500) - factCutoff('3x4', 2500), STATES.LARGE_FACT_ALLOWANCE_MS,
        'allowance equals the configured constant');

    // The allowance is load-bearing: an initiation between the two cutoffs is
    // SLOW on a small fact and FLUENT on a large one.
    const between = 2650;
    r = drill(newFactRecord(), corrects(6, between, 2));
    eq(factState(r, factCutoff('3x4', 2500)), 'SLOW', '2650ms initiation is SLOW on 3x4');
    eq(factState(r, factCutoff('7x8', 2500)), 'FLUENT', 'same initiation is FLUENT on 7x8');
}
