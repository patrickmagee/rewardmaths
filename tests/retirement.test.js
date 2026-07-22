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
import { mixedRound } from '../js/engine/scheduler.js';
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
    // Distance boundary: exactly (frontier - distance) rungs down retires; the
    // rung just inside the window does not.
    const frIdx = ADD_FAMILIES.indexOf('bridge-10');           // rung 6 frontier
    ok(!isRetiredFamily(ADD_FAMILIES[frIdx - 1], 'bridge-10', 2), 'one rung below frontier stays active');
    ok(isRetiredFamily(ADD_FAMILIES[frIdx - 2], 'bridge-10', 2), 'two rungs below frontier retires');

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
}
