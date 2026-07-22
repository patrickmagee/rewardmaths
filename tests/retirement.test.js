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
import { familyRung, isRetiredFamily, familyOf, ADD_FAMILIES } from '../js/engine/facts.js';
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
    eq(familyRung('td-ones'), null, 'two-digit families have no retire rung');
    eq(familyRung('table-7'), null, 'times tables have no retire rung');

    const FR = 'td-ones-cross', D = SCHEDULER.RETIRE_DISTANCE;
    ok(isRetiredFamily('add-0-1', FR, D), 'far-below single-digit family retires');
    ok(isRetiredFamily('bridge-10', FR, D), 'bridge-10 retires once frontier is two-digit');
    ok(!isRetiredFamily('td-ones', FR, D), 'two-digit family never retires (it is current level)');
    ok(!isRetiredFamily('table-7', FR, D), 'a times table never retires');

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
    ok(singleDigit / total < 0.15,
        `outgrown single-digit is a minority, not everyday practice (${Math.round(100 * singleDigit / total)}%)`);
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
}
