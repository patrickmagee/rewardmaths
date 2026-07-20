import { tagError, evaluateFlags, flagType, themeOf } from '../js/engine/flags.js';
import { FLAGS } from '../js/config.js';

const VALID = { counts_for_accuracy: true, counts_for_rt: true, exclusion_reason: null };

function ans(fact_id, correct, rt, day, given) {
    return { fact_id, correct, rt, day, cls: VALID, given,
        errorTag: correct ? null : tagError(fact_id, given ?? 0) };
}

/** Day string N days before 2026-07-05 (the "today" every case below uses). */
function ago(n) {
    return new Date(Date.UTC(2026, 6, 5) - n * 86400000).toISOString().slice(0, 10);
}

/**
 * A fact record with attempts on the given day-offsets (2 attempts each).
 * Escalation reads the DAYS of a fact's history, never the count, so these
 * fixtures are written in terms of when the child met the fact.
 */
function rec(state, dayOffsets) {
    const attempts = dayOffsets.flatMap(d =>
        [{ day: ago(d), correct: false }, { day: ago(d), correct: false }]);
    return { state, attempts, totalAttempts: attempts.length, everThreeInRow: false };
}
/** Failing for weeks: three distinct days spread across 24 calendar days. */
const durable = s => rec(s, [24, 12, 1]);
/** Introduced this week: three distinct days, but all inside 3 calendar days. */
const fresh = s => rec(s, [3, 2, 1]);
/** Healthy filler so the child has a baseline of comparable material. */
const fluent = () => rec('FLUENT', [24, 12, 1]);

export async function run({ eq, ok }) {
    // Error taxonomy.
    eq(tagError('7x8', 63).type, 'table_confusion', '7×8=63 is a neighbour error');
    eq(tagError('7x8', 63).neighbour, '7x9', 'neighbour identified');
    eq(tagError('7x8', 15).type, 'operation_confusion', '7×8=15 is adding');
    eq(tagError('7x8', 57).type, 'counting_slip', 'off-by-one');
    eq(tagError('7x8', 42).type, 'table_confusion', '7×8=42 is 7×6');
    eq(tagError('13-9', 5).type, 'counting_slip', 'off-by-one sub');
    eq(tagError('13-9', 22).type, 'operation_confusion', '13-9=22 is adding');

    eq(themeOf('7x8'), 'table-8', 'mul theme = table of larger operand');
    eq(themeOf('3x7'), 'table-7', 'theme by larger operand');
    eq(themeOf('8+5'), 'bridge-10', 'add theme = ladder family');

    // Flag lifecycle: the theme's per-fact states must show durable, near-total
    // failure (the primary signal), corroborated by a live window deficit.
    const week = [];
    // Strong overall performance on other material.
    for (let d = 1; d <= 5; d++) {
        for (let i = 0; i < 12; i++) week.push(ans('2x3', true, 1500, `2026-07-0${d}`));
    }
    // Weak 7s: 60% accuracy, slow, across 4 days, >24 attempts.
    for (let d = 1; d <= 4; d++) {
        for (let i = 0; i < 8; i++) {
            week.push(ans('7x8', i < 5, 4200, `2026-07-0${d}`, i < 5 ? undefined : 63));
        }
    }
    // The child's own comparable material, so the theme has a baseline to stand
    // out from; table-8's three facts have all been failed repeatedly for weeks.
    const base = { '2x3': fluent(), '2x4': fluent(), '3x4': fluent(),
        '5x6': fluent(), '9x9': fluent() };
    const weakRecs = { ...base,
        '7x8': durable('STUCK'), '6x8': durable('UNKNOWN'), '8x8': durable('UNKNOWN') };
    const flags = evaluateFlags(week, {}, weakRecs, '2026-07-05');
    eq(flags['table-8']?.state, 'flagged', 'durably failing 8s flagged');
    const flag = flags['table-8'];
    ok(flag.evidence.accuracy < flag.evidence.overallAccuracy, 'deficit vs own baseline');
    eq(flag.evidence.durableWeakFacts, 3, 'durable weak facts counted');
    ok(flag.evidence.durableShare - flag.evidence.baselineShare >= FLAGS.WEAK_SHARE_DEFICIT,
        'share stands out from the child\'s own baseline');

    // Insufficient days → watching, not flagged.
    const shortWeek = week.filter(a => a.day <= '2026-07-02');
    const f2 = evaluateFlags(shortWeek, {}, weakRecs, '2026-07-02');
    ok(f2['table-8']?.state !== 'flagged', 'too few days does not flag');

    // ---- Escalation is structural, not volumetric (2026-07-20, DESIGN §3) ----
    // A theme the scheduler has STARVED. UNKNOWN facts are excluded from mixed
    // rounds and rationed in focus rounds, so the weaker a theme is the less it
    // is served — ANY attempt-count gate, windowed or cumulative, is
    // anti-correlated with the weakness it gates on. Here the window carries
    // only 8 table-8 attempts and the flag must still fire on the fact states.
    const starved = [];
    for (let d = 1; d <= 5; d++) {
        for (let i = 0; i < 12; i++) starved.push(ans('2x3', true, 1500, `2026-07-0${d}`));
    }
    for (let d = 1; d <= 4; d++) {
        for (let i = 0; i < 2; i++) starved.push(ans('7x8', false, 4200, `2026-07-0${d}`, 63));
    }
    const f3 = evaluateFlags(starved, {}, weakRecs, '2026-07-05');
    eq(f3['table-8']?.state, 'flagged', 'starved-but-failing theme still flags');
    ok(f3['table-8'].evidence.attempts <= 8, 'flagged on a thin window sample');

    // …but ONLY when the fact states agree. Same thin window, same deficit,
    // facts that are fine → acquisition noise on the remainder, not a theme to
    // send a parent at.
    const healthyRecs = { ...base, '7x8': fluent(), '6x8': fluent(), '8x8': fluent() };
    ok(evaluateFlags(starved, {}, healthyRecs, '2026-07-05')['table-8']?.state !== 'flagged',
        'window deficit on a fluent theme does not flag');

    // …and it must bite with plenty of window volume too. This is the
    // one-bad-fortnight false positive: 32 attempts over 4 days and a real
    // deficit, but only one of the theme's facts is actually weak.
    const blipRecs = { ...base, '7x8': fluent(), '6x8': fluent(), '8x8': durable('UNKNOWN') };
    const f4 = evaluateFlags(week, {}, blipRecs, '2026-07-05');
    ok(f4['table-8'].evidence === undefined, 'one weak fact is not a weak theme');
    eq(f4['table-8'].state, 'watching', 'it is downgraded to watching, not silently dropped');

    // ---- The newly-introduced-table false positive (the reason durability is
    // measured in CALENDAR days). Identical states, identical window deficit —
    // the only difference is that the child first met these facts three days
    // ago. "Not taught yet" must never be reported as "failing".
    const freshRecs = { ...base,
        '7x8': fresh('UNKNOWN'), '6x8': fresh('UNKNOWN'), '8x8': fresh('STUCK') };
    const f5 = evaluateFlags(week, {}, freshRecs, '2026-07-05');
    ok(f5['table-8']?.state !== 'flagged', 'a table introduced this week is not flagged');
    eq(f5['table-8'].evidence, undefined, 'no evidence attached to a non-flag');

    // Span and distinct-days are independent gates and both are load-bearing.
    // Parked, not failing: two touches a month apart is not "failed for weeks".
    const parkedRecs = { ...base,
        '7x8': rec('UNKNOWN', [30, 1]), '6x8': rec('UNKNOWN', [30, 1]), '8x8': rec('STUCK', [30, 1]) };
    ok(evaluateFlags(week, {}, parkedRecs, '2026-07-05')['table-8']?.state !== 'flagged',
        'wide span but only two days does not flag');

    // A theme half-failing is a theme mid-acquisition. The share bar is
    // ADAPT.PROMOTE_FACTS_OK read backwards (0.80): a not-yet-taught table is
    // ALSO mostly-unlearned, so only near-total failure separates "broken" from
    // "the child's frontier". Six facts, three of them durably weak → no flag,
    // even though that clears MIN_DURABLE_WEAK_FACTS.
    const halfWeek = [...week];
    for (let d = 1; d <= 4; d++) {
        for (let i = 0; i < 3; i++) halfWeek.push(ans('6x9', false, 4200, `2026-07-0${d}`, 55));
    }
    const halfRecs = { ...base,
        '6x9': durable('UNKNOWN'), '7x9': durable('UNKNOWN'), '8x9': durable('STUCK'),
        '9x2': fluent(), '9x3': fluent(), '9x4': fluent() };
    ok(evaluateFlags(halfWeek, {}, halfRecs, '2026-07-05')['table-9']?.state !== 'flagged',
        'a half-failing theme is mid-acquisition, not a weak theme');

    // Two failing facts is a fact problem, not a theme problem. A share is
    // meaningless on a denominator of two, and the playbook a flag triggers
    // ("work on your 5s") is the wrong instruction for two stray facts.
    const tinyWeek = [...week];
    for (let d = 1; d <= 4; d++) {
        for (let i = 0; i < 2; i++) tinyWeek.push(ans('4x5', false, 4200, `2026-07-0${d}`, 25));
    }
    const tinyRecs = { ...base, '4x5': durable('UNKNOWN'), '5x5': durable('STUCK') };
    ok(evaluateFlags(tinyWeek, {}, tinyRecs, '2026-07-05')['table-5']?.state !== 'flagged',
        'a two-fact theme does not flag however weak');

    // A theme no worse than the child's own frontier must not flag: when
    // everything comparable is equally unlearned, nothing stands out, and a
    // dashboard that flags all of it tells a parent nothing.
    const allWeak = Object.fromEntries(
        Object.keys(weakRecs).map(id => [id, durable('UNKNOWN')]));
    ok(evaluateFlags(week, {}, allWeak, '2026-07-05')['table-8']?.state !== 'flagged',
        'theme level with the child\'s own baseline does not flag');

    // Bare { factId: state } maps (callers without records) still work: with no
    // history to judge durability by, every fact is taken at face value.
    ok(evaluateFlags(week, {}, { '7x8': 'STUCK', '6x8': 'STUCK', '8x8': 'STUCK',
        '2x3': 'FLUENT', '2x4': 'FLUENT', '3x4': 'FLUENT', '5x6': 'FLUENT',
        '9x9': 'FLUENT' }, '2026-07-05')['table-8']?.state === 'flagged',
        'bare state map still evaluates');

    // ---- Speed is judged on initiation, matching the state machine ----
    // A theme that is slow ONLY in typing (3-digit answers) must not trip the
    // RT criterion; initiation is identical to the baseline theme's.
    const typer = [];
    for (let d = 1; d <= 5; d++) {
        for (let i = 0; i < 12; i++) {
            typer.push({ ...ans('2x3', true, 1500, `2026-07-0${d}`), initiation_ms: 1400 });
        }
        for (let i = 0; i < 6; i++) {
            // Same 1400ms initiation, 3000ms more typing → total RT 3× baseline.
            typer.push({ ...ans('11x12', true, 4400, `2026-07-0${d}`), initiation_ms: 1400 });
        }
    }
    const typerRecs = { ...base, '11x12': durable('UNKNOWN'),
        '10x12': durable('UNKNOWN'), '9x12': durable('UNKNOWN') };
    ok(evaluateFlags(typer, {}, typerRecs, '2026-07-05')['table-12']?.state !== 'flagged',
        'slow typing alone does not trip the theme RT criterion');

    // Flag types for the playbook.
    eq(flagType({ accuracy: 0.9, dominantError: null, repeatedBug: null }), 'slow', 'accurate-but-slow');
    eq(flagType({ accuracy: 0.6, dominantError: 'operation_confusion', repeatedBug: null }), 'conceptual', 'op confusion → conceptual');
    eq(flagType({ accuracy: 0.6, dominantError: 'weak_fact', repeatedBug: null }), 'inaccurate', 'weak facts → inaccurate');
}
