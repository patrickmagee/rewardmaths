import { tagError, evaluateFlags, flagType, themeOf } from '../js/engine/flags.js';

const VALID = { counts_for_accuracy: true, counts_for_rt: true, exclusion_reason: null };

function ans(fact_id, correct, rt, day, given) {
    return { fact_id, correct, rt, day, cls: VALID, given,
        errorTag: correct ? null : tagError(fact_id, given ?? 0) };
}

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

    // Flag lifecycle: theme deficient vs child's own baseline, ≥24 attempts, ≥3 days.
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
    const factStates = { '7x8': 'STUCK', '2x3': 'FLUENT' };
    const flags = evaluateFlags(week, {}, factStates, '2026-07-05');
    eq(flags['table-8']?.state ?? flags['table-7']?.state, 'flagged', '7s flagged');
    const flag = flags['table-8'] || flags['table-7'];
    ok(flag.evidence.attempts >= 24, 'enough attempts');
    ok(flag.evidence.accuracy < flag.evidence.overallAccuracy, 'deficit vs own baseline');

    // Insufficient days → watching, not flagged.
    const shortWeek = week.filter(a => a.day <= '2026-07-02');
    const f2 = evaluateFlags(shortWeek, {}, factStates, '2026-07-02');
    const s2 = (f2['table-8'] || f2['table-7'])?.state;
    ok(s2 !== 'flagged', `too few days does not flag (got ${s2})`);

    // Flag types for the playbook.
    eq(flagType({ accuracy: 0.9, dominantError: null, repeatedBug: null }), 'slow', 'accurate-but-slow');
    eq(flagType({ accuracy: 0.6, dominantError: 'operation_confusion', repeatedBug: null }), 'conceptual', 'op confusion → conceptual');
    eq(flagType({ accuracy: 0.6, dominantError: 'weak_fact', repeatedBug: null }), 'inaccurate', 'weak facts → inaccurate');
}
