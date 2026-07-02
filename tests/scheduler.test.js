import { buildDailyRounds, focusRound, weakTargets } from '../js/engine/scheduler.js';
import { newChildState } from '../js/engine/adapt.js';
import { newFactRecord } from '../js/engine/states.js';
import { tableFacts } from '../js/engine/facts.js';
import { SCHEDULER } from '../js/config.js';

function stateWith(factSpecs) {
    const s = newChildState();
    s.warmupFamilies = []; // these tests exercise the steady-state focus round
    for (const [id, st, medianRt = 2000, lastSeenDay = '2026-07-01'] of factSpecs) {
        s.facts[id] = { ...newFactRecord(), state: st, medianRt, lastSeenDay, totalAttempts: 8,
            attempts: [{ correct: true, rt: medianRt, countsRt: true, day: lastSeenDay }] };
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
    ok(focus.items.some(i => i.model), 'unknown fact is modeled on first appearance');
    const knownShare = focus.items.filter(i => !weakIds.has(i.fact_id)).length / focus.items.length;
    ok(knownShare >= 0.5, `most of focus round is known material (${knownShare})`);

    // Daily retrieval budget: a weak fact with 3 correct retrievals today is not re-served.
    const budgetCtx = { ...ctx, retrievalsToday: { '7x8': 3, '7x6': 3, '7x9': 3 } };
    const targets = weakTargets(state, budgetCtx);
    eq(targets.filter(t => weakIds.has(t.id)).length, 0, 'budget-spent facts not re-targeted');

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
}
