/**
 * Parent-set level + retirement (docs/DESIGN.md §2).
 *
 * - startFamily seeds where the fold begins (a parent declaring a child's
 *   level, not the engine inferring it from data — the log is untouched).
 * - Retirement moves single-digit families the child has outgrown to
 *   maintenance-only, so a child working on two-digit arithmetic stops being
 *   fed +0/+1 as everyday practice but still meets it occasionally.
 */
import { newChildState, startingFamilies, currentFrontier } from '../js/engine/adapt.js';
import { newFactRecord } from '../js/engine/states.js';
import { familyRung, isRetiredFamily, familyOf, ADD_FAMILIES, isEasyMulFact, isLargeFact, tableFacts, sampleFamily, parseFact } from '../js/engine/facts.js';
import { mixedRound, focusRound, reviewRound } from '../js/engine/scheduler.js';
import { SCHEDULER } from '../js/config.js';

function fluent(id, lastSeenDay = '2026-07-01') {
    return {
        ...newFactRecord(), state: 'FLUENT', medianRt: 1500, medianInit: 1000,
        lastSeenDay, totalAttempts: 8,
        attempts: [{ correct: true, rt: 1500, init: 1000, countsRt: true, day: lastSeenDay }],
    };
}
const isSingleDigit = id => /^\d[+-]\d$/.test(id);

export async function run({ eq, ok, seededRng }) {
    // --- startFamily parameterises the starting set -------------------------
    const dflt = startingFamilies();
    ok(dflt.includes('bridge-10') && !dflt.includes('td-ones'),
        'default start frontier is bridge-10 (nothing two-digit unlocked)');

    const hi = startingFamilies('td-ones-cross');
    ok(hi.includes('td-ones') && hi.includes('td-tens') && hi.includes('td-ones-cross'),
        'startFamily=td-ones-cross unlocks the two-digit families up to it');
    ok(hi.includes('add-0-1') && hi.includes('bridge-10'),
        'everything below the start is pre-unlocked as prior knowledge');
    eq(currentFrontier(newChildState({ startFamily: 'td-ones-cross' })), 'td-ones-cross',
        'newChildState(startFamily) puts the frontier at the declared level');
    eq(currentFrontier(newChildState({ startFamily: 'td-ones-cross' })),
        currentFrontier(newChildState({ unlockedFamilies: startingFamilies('td-ones-cross') })),
        'startFamily and explicit unlockedFamilies agree');
    // Backward compatibility: no opts → unchanged behaviour.
    eq(currentFrontier(newChildState()), 'bridge-10', 'no startFamily → global default unchanged');

    // --- Rung / retirement taxonomy ----------------------------------------
    eq(familyRung('add-0-1'), 0, 'add-0-1 is rung 0');
    eq(familyRung('sub-bridge-10'), familyRung('bridge-10'), 'a sub family borrows its add partner rung');
    eq(familyRung('td-ones'), ADD_FAMILIES.indexOf('td-ones'),
        'two-digit families DO carry a retire rung (changed 2026-07-25)');
    eq(familyRung('table-7'), null, 'times tables have no retire rung');

    const FR = 'td-ones-cross', D = SCHEDULER.RETIRE_DISTANCE;
    ok(isRetiredFamily('add-0-1', FR, D), 'far-below single-digit family retires');
    ok(isRetiredFamily('bridge-10', FR, D), 'bridge-10 retires once frontier is two-digit');
    ok(!isRetiredFamily('table-7', FR, D), 'a times table never retires by ladder distance');

    // Two-digit families retire on the SAME distance rule as single-digit ones
    // (2026-07-25). td-ones is 32+1 — a child on the crossing frontier has
    // outgrown it exactly as thoroughly as they outgrew +0/+1. td-tens sits one
    // rung below the frontier and stays.
    ok(isRetiredFamily('td-ones', FR, D), 'td-ones retires two rungs below a td-ones-cross frontier');
    ok(!isRetiredFamily('td-tens', FR, D), 'td-tens (one rung below) is still current level');
    ok(!isRetiredFamily('td-ones-cross', FR, D), 'the frontier itself never retires');

    // The bug this fixed: familyOf() files 10+0 / 10+1 as td-ones (a ≥ 10), so
    // exempting two-digit families made literal plus-ones un-retirable. Tom was
    // served 10+1 five times in two days while on the crossing frontier.
    eq(familyOf('10+1'), 'td-ones', '10+1 is filed two-digit by familyOf');
    ok(isRetiredFamily(familyOf('10+1'), FR, D), '…and therefore now retires with td-ones');

    // Retirement fires ONLY when the frontier itself is two-digit. A child
    // still on the single-digit ladder (incl. the default bridge-10) retires
    // NOTHING — they are still consolidating that work. (Protects Eliza and
    // every default-level child from losing single-digit practice.)
    for (const fam of ADD_FAMILIES)
        ok(!isRetiredFamily(fam, 'bridge-10', D), `${fam} not retired under a single-digit frontier`);
    ok(!isRetiredFamily('add-0-1', 'add-rest', D), 'even the top single-digit frontier retires nothing');

    // Distance boundary, measured from a two-digit frontier: td-ones is rung 8,
    // so at distance 2 the cut is rung 6 — bridge-10(6) retires, add-rest(7) not.
    ok(!isRetiredFamily('add-rest', 'td-ones', 2), 'add-rest (rung 7) stays active just below a td-ones frontier');
    ok(isRetiredFamily('bridge-10', 'td-ones', 2), 'bridge-10 (rung 6) retires two rungs below a td-ones frontier');

    // --- Mixed round: outgrown single-digit is maintenance-only ------------
    const st = newChildState({ startFamily: 'td-ones-cross' });
    st.warmupFamilies = [];
    // A pile of FLUENT single-digit facts (retired) + a few FLUENT two-digit.
    for (const id of ['1+0', '2+0', '3+0', '6+0', '1+1', '4+1', '2+3', '5+2', '3+4', '7+2'])
        st.facts[id] = fluent(id);
    for (const id of ['24+3', '45+8', '67-20'])
        st.facts[id] = fluent(id);

    let singleDigit = 0, total = 0, twoDigit = 0;
    for (let seed = 1; seed <= 40; seed++) {
        const rng = seededRng(seed);
        const r = mixedRound(st, { day: '2026-07-22', retrievalsToday: {} }, rng);
        for (const it of r.items) {
            total++;
            if (isSingleDigit(it.fact_id)) singleDigit++;
            else if (familyOf(it.fact_id).startsWith('td-')) twoDigit++;
        }
    }
    ok(singleDigit > 0, `outgrown single-digit still appears occasionally (${singleDigit}/${total})`);
    // MAINTENANCE_SLOTS is a hard cap on maintenance ITEMS PER ROUND
    // (2026-07-25), so this is an exact structural bound, not a lucky ratio —
    // it holds however lopsided the retired-vs-current fact counts get.
    const cap = SCHEDULER.MAINTENANCE_SLOTS / SCHEDULER.QUESTIONS_PER_ROUND;
    ok(singleDigit / total <= cap,
        `outgrown single-digit capped at MAINTENANCE_SLOTS/round (${Math.round(100 * singleDigit / total)}% ≤ ${Math.round(100 * cap)}%)`);
    ok(twoDigit > singleDigit,
        `current-level two-digit outweighs retired single-digit (${twoDigit} vs ${singleDigit})`);

    // With NO retirement (frontier still low), the same single-digit facts are
    // full everyday practice — proves the difference is retirement, not luck.
    const lo = newChildState(); lo.warmupFamilies = [];
    for (const id of ['1+0', '2+0', '3+0', '6+0', '1+1', '4+1']) lo.facts[id] = fluent(id);
    let loSingle = 0, loTotal = 0;
    for (let seed = 1; seed <= 20; seed++) {
        const r = mixedRound(lo, { day: '2026-07-22', retrievalsToday: {} }, seededRng(seed));
        for (const it of r.items) { loTotal++; if (isSingleDigit(it.fact_id)) loSingle++; }
    }
    ok(loSingle / loTotal > 0.5,
        `un-retired single-digit is everyday practice (${Math.round(100 * loSingle / loTotal)}%)`);

    // --- Focus openers + review fallback also exclude retired --------------
    // rankedKnowns (focus momentum openers) and fluentFactIds (review fallback)
    // must skip outgrown facts, or "the child's fastest facts" are all trivia.
    const st2 = newChildState({ startFamily: 'td-ones-cross' });
    st2.warmupFamilies = [];
    for (const id of ['1+0', '2+0', '3+0', '6+0']) st2.facts[id] = { ...fluent(id), medianInit: 400 };
    for (const id of ['24+3', '45+8', '67-20', '38+7']) st2.facts[id] = { ...fluent(id), medianInit: 2500 };
    let focusRetired = 0, focusTotal = 0;
    for (let seed = 1; seed <= 30; seed++) {
        const r = focusRound(st2, { day: '2026-07-22', retrievalsToday: {} }, seededRng(seed));
        for (const it of r.items) { focusTotal++; if (isSingleDigit(it.fact_id)) focusRetired++; }
    }
    ok(focusRetired === 0,
        `focus openers never serve a retired single-digit fact despite it being fastest (${focusRetired}/${focusTotal})`);
    const rv = reviewRound(st2, { day: '2026-07-22', retrievalsToday: {} }, seededRng(7));
    ok(rv.items.every(it => !isSingleDigit(it.fact_id)), 'review fallback excludes retired single-digit');

    // --- Maintenance surfaces the STALEST retired facts, not the freshest ---
    const st3 = newChildState({ startFamily: 'td-ones-cross' });
    st3.warmupFamilies = [];
    st3.facts['1+0'] = fluent('1+0', '2026-05-01'); // very stale
    st3.facts['2+0'] = fluent('2+0', '2026-05-02'); // stale
    st3.facts['3+0'] = fluent('3+0', '2026-07-21'); // fresh — should be crowded out
    let freshSeen = 0;
    for (let seed = 1; seed <= 40; seed++) {
        const r = mixedRound(st3, { day: '2026-07-22', retrievalsToday: {} }, seededRng(seed));
        if (r.items.some(it => it.fact_id === '3+0')) freshSeen++;
    }
    ok(freshSeen === 0,
        `MAINTENANCE_SLOTS=${SCHEDULER.MAINTENANCE_SLOTS} keeps the freshest retired fact out (seen ${freshSeen}/40)`);

    // --- One-step-derivable multiplication is maintenance too (2026-07-25) ---
    // Tables carry no ladder rung, so the distance rule can never reach them.
    // Measured on Tom's log: 46 of 66 circulating mul facts used a ×2/×5/×10/×11
    // route, 46% of served multiplication was tables 2/5/10/11, and 4% had both
    // operands in 6-9. The predicate is per-FACT, not per-table, because
    // tableOf() files by larger operand — 12×10 must go, 12×7 must stay.
    ok(isEasyMulFact('4x11') && isEasyMulFact('12x10') && isEasyMulFact('7x5'),
        'a ×2/×5/×10/×11 route makes the fact easy whatever table owns it');
    ok(!isEasyMulFact('12x7') && !isEasyMulFact('7x8') && !isEasyMulFact('3x4'),
        'facts with no one-step route are real practice');
    ok(!isEasyMulFact('10+1'), 'the predicate is multiplication-only');

    const mul = newChildState({ startFamily: 'td-ones-cross' });
    mul.warmupFamilies = [];
    const easyIds = [], coreIds = [];
    for (const t of [2, 5, 10, 11]) for (const f of tableFacts(t)) if (isEasyMulFact(f)) easyIds.push(f);
    for (const f of ['6x7', '7x6', '6x8', '8x6', '7x8', '8x7', '7x9', '9x7', '8x9', '9x8', '6x9', '9x6',
        '3x4', '4x3', '3x6', '12x7', '12x8']) coreIds.push(f);
    for (const id of [...new Set(easyIds)]) mul.facts[id] = fluent(id);
    for (const id of coreIds) mul.facts[id] = fluent(id);

    let easyN = 0, largeN = 0, mulTotal = 0;
    for (let seed = 1; seed <= 60; seed++) {
        const r = mixedRound(mul, { day: '2026-07-25', retrievalsToday: {} }, seededRng(seed));
        for (const it of r.items) {
            mulTotal++;
            if (isEasyMulFact(it.fact_id)) easyN++;
            else if (isLargeFact(it.fact_id)) largeN++;
        }
    }
    ok(easyN > 0, `easy multiplication still appears occasionally (${easyN}/${mulTotal})`);
    ok(easyN / mulTotal <= SCHEDULER.MAINTENANCE_SLOTS / SCHEDULER.QUESTIONS_PER_ROUND,
        `easy multiplication capped at the maintenance slots (${Math.round(100 * easyN / mulTotal)}%)`);
    ok(largeN > easyN * 2,
        `the 6-9 core dominates the easy tables it used to lose to (${largeN} large vs ${easyN} easy)`);

    // The depth gate: a child whose whole repertoire IS the easy tables keeps
    // them as everyday practice — retiring them would empty the pool.
    const beginner = newChildState();
    beginner.warmupFamilies = [];
    for (const id of [...new Set(easyIds)].slice(0, 12)) beginner.facts[id] = fluent(id);
    let begEasy = 0, begTotal = 0;
    for (let seed = 1; seed <= 20; seed++) {
        const r = mixedRound(beginner, { day: '2026-07-25', retrievalsToday: {} }, seededRng(seed));
        for (const it of r.items) { begTotal++; if (isEasyMulFact(it.fact_id)) begEasy++; }
    }
    ok(begEasy / begTotal > 0.8,
        `below MUL_MAINTENANCE_MIN_CORE the easy tables stay everyday practice (${Math.round(100 * begEasy / begTotal)}%)`);

    // --- Two-digit samplers: real crossings, and both operations ------------
    // The add lower bound used to be "just enough to reach the next ten", so
    // td-ones-cross legitimately emitted 39+1 / 38+2 / 25+5 — the "+1 / +2" a
    // parent sees over a child's shoulder. And neither td-ones nor
    // td-ones-cross emitted subtraction at all, so a child on the two-digit
    // frontier with the single-digit sub families retired got NONE.
    // One rng drawn 400 times, not 400 fresh rngs: a seeded generator's FIRST
    // output correlates with its seed, and that first draw is the add/sub coin.
    let sawSub = 0, tiny = 0, noCross = 0;
    const crossRng = seededRng(11);
    for (let i = 0; i < 400; i++) {
        const id = sampleFamily('td-ones-cross', crossRng);
        const { a, op, b, answer } = parseFact(id);
        if (op === 'sub') sawSub++;
        if (b < 3) tiny++;
        const crosses = op === 'add'
            ? Math.floor(answer / 10) > Math.floor(a / 10)
            : Math.floor(answer / 10) < Math.floor(a / 10);
        if (!crosses) noCross++;
        eq(familyOf(id), 'td-ones-cross', `${id} round-trips through familyOf`);
    }
    ok(sawSub > 100, `td-ones-cross emits subtraction as well as addition (${sawSub}/400)`);
    eq(tiny, 0, 'td-ones-cross never emits a +1 / +2 / -1 / -2');
    eq(noCross, 0, 'every td-ones-cross item actually crosses the decade');

    const onesRng = seededRng(13);
    let onesSub = 0;
    for (let i = 0; i < 200; i++) {
        const id = sampleFamily('td-ones', onesRng);
        if (parseFact(id).op === 'sub') onesSub++;
        eq(familyOf(id), 'td-ones', `${id} round-trips through familyOf`);
    }
    ok(onesSub > 50, `td-ones emits subtraction as well as addition (${onesSub}/200)`);
}
