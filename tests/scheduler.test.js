import { buildDailyRounds, focusRound, weakTargets } from '../js/engine/scheduler.js';
import { newChildState } from '../js/engine/adapt.js';
import { newFactRecord } from '../js/engine/states.js';
import { tableFacts } from '../js/engine/facts.js';
import { SCHEDULER } from '../js/config.js';

// Typing component subtracted from a spec's total RT to get its initiation
// component. Speed is classified on initiation only (states.js), and the
// scheduler ranks knowns on medianInit — a record with medianRt but no
// medianInit sorts as 0 and makes every speed in these specs inert.
// A fixed offset keeps the ORDERING of the specs' RTs intact in medianInit.
const TYPING_MS = 700;
const initOf = medianRt => Math.max(300, medianRt - TYPING_MS);

function stateWith(factSpecs) {
    const s = newChildState();
    s.warmupFamilies = []; // these tests exercise the steady-state focus round
    for (const [id, st, medianRt = 2000, lastSeenDay = '2026-07-01'] of factSpecs) {
        const medianInit = initOf(medianRt);
        s.facts[id] = { ...newFactRecord(), state: st, medianRt, medianInit, lastSeenDay, totalAttempts: 8,
            attempts: [{ correct: true, rt: medianRt, init: medianInit, countsRt: true, day: lastSeenDay }] };
    }
    return s;
}

export async function run({ eq, ok, seededRng }) {
    const rng = seededRng(7);

    // Rich state: 2s table fluent, 7s weak.
    const specs = [];
    for (const f of tableFacts(2)) specs.push([f, 'FLUENT', 1500]);
    for (const f of tableFacts(5)) specs.push([f, 'FLUENT', 1700, '2026-06-10']); // stale → review target
    specs.push(['7x8', 'UNKNOWN'], ['7x6', 'SLOW', 4500], ['7x9', 'STUCK']);
    const state = stateWith(specs);
    const ctx = { day: '2026-07-02', retrievalsToday: {}, sprintDue: false, placementActive: false };

    const rounds = buildDailyRounds(state, ctx, rng);
    eq(rounds.map(r => r.round_type), ['review', 'focus', 'mixed'], 'default daily set');
    ok(rounds.every(r => r.items.length === SCHEDULER.QUESTIONS_PER_ROUND), 'rounds are 10 questions');

    // Review targets the stalest mastered table (5s).
    eq(rounds[0].table, 5, 'review picks stalest mastered table');

    // Focus embeds the weak facts and opens with fast knowns.
    const focus = rounds[1];
    const weakIds = new Set(['7x8', '7x6', '7x9']);
    const weakCount = focus.items.filter(i => weakIds.has(i.fact_id)).length;
    ok(weakCount >= 2, `focus round contains weak facts (got ${weakCount})`);
    ok(!weakIds.has(focus.items[0].fact_id), 'focus opens with a known fact (momentum)');
    // …and specifically with the child's FASTEST knowns. Speed is judged on
    // initiation, so this must bite on medianInit: the 2s facts (1500 total →
    // 800 init) must open ahead of the 5s facts (1700 → 1000). Asserting only
    // "not weak" passes under any ordering, including a reversed one.
    const fluentInits = Object.values(state.facts)
        .filter(r => r.state === 'FLUENT').map(r => r.medianInit);
    const fastestInit = Math.min(...fluentInits);
    ok(Math.max(...fluentInits) > fastestInit, 'fixture actually has a speed spread');
    for (let i = 0; i < SCHEDULER.MOMENTUM_OPENERS; i++) {
        eq(state.facts[focus.items[i].fact_id].medianInit, fastestInit,
            `momentum opener ${i} is one of the fastest knowns by initiation`);
    }
    ok(focus.items.some(i => i.model), 'unknown fact is modeled on first appearance');
    const knownShare = focus.items.filter(i => !weakIds.has(i.fact_id)).length / focus.items.length;
    ok(knownShare >= 0.5, `most of focus round is known material (${knownShare})`);

    // Daily retrieval budget: a weak fact with 3 correct retrievals today is not re-served.
    const budgetCtx = { ...ctx, retrievalsToday: { '7x8': 3, '7x6': 3, '7x9': 3 } };
    const targets = weakTargets(state, budgetCtx);
    eq(targets.filter(t => weakIds.has(t.id)).length, 0, 'budget-spent facts not re-targeted');

    // UNSETTLED is never weak material. Those facts are being answered
    // correctly and have simply not been met often enough for a speed verdict;
    // while they were mislabelled SLOW they were fed to focus rounds at the
    // old SLOW_WEIGHT (now STALE_WEIGHT, and stale-only), so a child was
    // re-taught facts he already had.
    const unsettled = stateWith([
        ...tableFacts(2).map(f => [f, 'FLUENT', 1500]),
        ['7x8', 'UNSETTLED'], ['7x9', 'UNSETTLED'], ['6x7', 'UNSETTLED'],
    ]);
    const t3 = weakTargets(unsettled, ctx);
    eq(t3.filter(t => unsettled.facts[t.id]?.state === 'UNSETTLED').length, 0,
        'UNSETTLED facts are never weak targets');
    // …but it must still not starve: brand-new facts from the working table
    // remain available, so the round has something to teach.
    ok(t3.every(t => !unsettled.facts[t.id]), 'targets fall through to new facts');

    // Unknown-circulation cap.
    const manyUnknown = stateWith([
        ...tableFacts(2).map(f => [f, 'FLUENT', 1500]),
        ['7x8', 'UNKNOWN'], ['7x9', 'UNKNOWN'], ['6x7', 'UNKNOWN'], ['6x8', 'UNKNOWN'],
        ['8x9', 'UNKNOWN'], ['12x7', 'UNKNOWN'], ['12x8', 'UNKNOWN'],
    ]);
    manyUnknown.unknownCirculation = 3;
    const t2 = weakTargets(manyUnknown, ctx);
    ok(t2.filter(t => manyUnknown.facts[t.id].state !== 'SLOW').length <= 3,
        'unknown circulation capped');

    // Sprint replaces the third round when due.
    const sprintRounds = buildDailyRounds(state, { ...ctx, sprintDue: true }, rng);
    eq(sprintRounds[2].round_type, 'sprint', 'sprint due replaces mixed');
    eq(sprintRounds[2].durationMs, 60000, 'sprint is 60s');

    // Placement mode.
    const placement = buildDailyRounds(newChildState(), { ...ctx, placementActive: true }, rng);
    ok(placement.every(r => r.round_type === 'placement'), 'placement mode');
    ok(placement[0].untimed, 'placement is untimed');

    // Each placement round deliberately restarts the stratum cursor at 0 and
    // relies on the PLACEMENT_EXPOSURES guard to skip facts already covered —
    // "restart and skip saturated" lands on the un-swept frontier by itself.
    // Threading the returned cursor forward instead makes the sweep jump past
    // uncovered strata: broader but thinner, so fewer facts reach the 2
    // exposures needed to settle. Measured over 12 sim seeds, that dropped the
    // weak-table flag from 12/12 to 1/12. `placementCursor` in the return value
    // is vestigial — do not wire it into buildDailyRounds.
    eq(placement.map(r => r.round_type), ['placement', 'placement', 'placement'],
        'placement day is three placement rounds');
    // A DEMOTED TIMES TABLE lands in warm-up. adapt.js keys demotion evidence
    // by familyOf(), which returns "table-N" for multiplication, so a mastered
    // table that collapses is pushed into warmupFamilies and reaches
    // blockedRound(). Table ids are not familyFacts() members: this used to fall
    // through to the parametric sampler, which has no members for a table, and
    // threw "Cannot read properties of null (reading 'length')" — a hard crash
    // of round building in the child app, reproducible in ~1 sim run in 250.
    const demoted = stateWith(specs);
    demoted.warmupFamilies = ['table-12'];
    const wuRounds = buildDailyRounds(demoted, { day: '2026-07-02', retrievalsToday: {} }, seededRng(11));
    const blocked = wuRounds.find(r => r.blockedFamily === 'table-12');
    ok(blocked, 'a demoted table gets a blocked warm-up round');
    ok(blocked.items.every(i => i.fact_id && tableFacts(12).includes(i.fact_id)),
        'blocked table round is built from that table\'s real facts');

}
