/**
 * Round builder (docs/DESIGN.md §2 "Scheduler").
 * Pure: takes child state + day context + seeded rng, returns a round plan.
 *
 * Round plan: { round_type, items: [{ fact_id, model: bool }], untimed: bool,
 *               blockedFamily?: string }
 * `model: true` → show the fact WITH its answer first ("7 × 8 = 56 — now you").
 */
import { SCHEDULER } from '../config.js';
import { tableFacts, familyFacts, sampleFamily, familyOf, difficultyScore, parseFact } from './facts.js';

/**
 * Build today's default three rounds (+ variants).
 * @param {object} state    child adaptive state
 * @param {object} ctx      { day, retrievalsToday: {factId: n}, sprintDue,
 *                            placementActive, dayIndex }
 * @param {function} rng    seeded () => [0,1)
 */
export function buildDailyRounds(state, ctx, rng) {
    if (ctx.placementActive) {
        return [placementRound(state, ctx, rng), placementRound(state, ctx, rng), placementRound(state, ctx, rng)];
    }
    // A family in warm-up gets a blocked round in the focus slot until it
    // clears the accuracy gate (interleaving hurts novices). Multiple pending
    // warm-up families rotate by day.
    const wu = state.warmupFamilies || [];
    const warmup = wu.length ? wu[new Date(ctx.day).getDate() % wu.length] : null;
    const second = warmup ? blockedRound(state, warmup, rng) : focusRound(state, ctx, rng);
    const rounds = [reviewRound(state, ctx, rng), second, mixedRound(state, ctx, rng)];
    if (ctx.sprintDue) rounds[2] = sprintRound(state, ctx, rng);
    return rounds;
}

/** Review: the mastered table/family with the oldest last_seen. */
export function reviewRound(state, ctx, rng) {
    const table = stalestMasteredTable(state, ctx.day);
    const pool = table !== null
        ? tableFacts(table).filter(f => state.facts[f])
        : fluentFactIds(state);
    const items = pick(pool.length ? pool : fallbackPool(state), SCHEDULER.QUESTIONS_PER_ROUND, rng)
        .map(f => ({ fact_id: f, model: false }));
    return { round_type: 'review', items, untimed: false, table };
}

/**
 * Focus: 2-3 weakest facts embedded ~80/20 in knowns, momentum openers first,
 * weak facts repeated with increasing spacing, capped by the daily budget.
 */
export function focusRound(state, ctx, rng) {
    const weak = weakTargets(state, ctx);
    const knowns = rankedKnowns(state);
    const n = SCHEDULER.QUESTIONS_PER_ROUND;
    const items = [];

    // Momentum openers: the child's fastest facts.
    for (const f of knowns.slice(0, SCHEDULER.MOMENTUM_OPENERS)) {
        items.push({ fact_id: f, model: false });
    }
    // Interleave weak facts (modeled on first appearance if UNKNOWN/STUCK)
    // at increasing spacing among knowns. Weak material is capped at ~20-30%
    // of the round (incremental-rehearsal shape); further within-round
    // repetition comes from requeue-on-miss at play time.
    const slots = [2, 4, 7, 3, 6, 9, 5, 8]; // spread pattern within 10
    let slotIdx = 0;
    const weakAppearances = weak.map(w => ({ fact: w, rep: 0 }));
    if (weak.length && weakAppearances.length < SCHEDULER.FOCUS_WEAK_SLOTS) {
        weakAppearances.push({ fact: weak[0], rep: 1 }); // weakest gets a spaced 2nd rep
    }
    weakAppearances.length = Math.min(weakAppearances.length, SCHEDULER.FOCUS_WEAK_SLOTS);
    for (const app of weakAppearances) {
        if (items.length >= n) break;
        const pos = Math.min(slots[slotIdx++ % slots.length], n - 1);
        const st = state.facts[app.fact.id]?.state || 'UNKNOWN';
        insertAt(items, pos, {
            fact_id: app.fact.id,
            model: app.rep === 0 && (st === 'UNKNOWN' || st === 'STUCK'),
        });
    }
    // Fill remaining with knowns (avoid immediate repeats).
    let k = SCHEDULER.MOMENTUM_OPENERS;
    while (items.length < n && knowns.length) {
        items.push({ fact_id: knowns[k++ % knowns.length], model: false });
    }
    while (items.length < n) items.push({ fact_id: sampleAnything(state, rng), model: false });

    const untimed = weak.some(w => familyAccuracy(state, familyOf(w.id)) < SCHEDULER.UNTIMED_UNTIL_ACCURACY);
    return { round_type: 'focus', items: items.slice(0, n), untimed };
}

/** Mixed: interleaved across all learned material, weighted toward SLOW. */
export function mixedRound(state, ctx, rng) {
    const pool = [];
    for (const [id, rec] of Object.entries(state.facts)) {
        if (rec.state === 'FLUENT') pool.push({ id, w: 1 });
        else if (rec.state === 'SLOW') pool.push({ id, w: SCHEDULER.SLOW_WEIGHT });
    }
    // Stale-fact reinjection.
    for (const [id, rec] of Object.entries(state.facts)) {
        if (rec.lastSeenDay && daysBetween(rec.lastSeenDay, ctx.day) >= SCHEDULER.FACT_STALE_DAYS) {
            pool.push({ id, w: SCHEDULER.SLOW_WEIGHT });
        }
    }
    // Parametric variety from unlocked two-digit families.
    for (const fam of state.unlockedFamilies) {
        if (!familyFacts(fam)) pool.push({ id: sampleFamily(fam, rng), w: 1 });
    }
    const items = weightedPick(pool.length ? pool : anyPool(state, rng), SCHEDULER.QUESTIONS_PER_ROUND, rng)
        .map(f => ({ fact_id: f, model: false }));
    return { round_type: 'mixed', items, untimed: false };
}

/** Blocked warm-up round for a family/table still under the accuracy gate. */
export function blockedRound(state, family, rng) {
    const pool = familyFacts(family) ||
        Array.from({ length: 20 }, () => sampleFamily(family, rng));
    const items = pick(pool, SCHEDULER.QUESTIONS_PER_ROUND, rng)
        .map((f, i) => ({ fact_id: f, model: i < 2 && !state.facts[f] }));
    return { round_type: 'focus', items, untimed: true, blockedFamily: family };
}

/** Weekly 60s benchmark sprint: fixed-form, single operation. */
export function sprintRound(state, ctx, rng) {
    const op = ctx.sprintOp || 'mul';
    const pool = op === 'mul'
        ? SCHEDULER.TABLE_ORDER.flatMap(t => tableFacts(t))
        : Object.keys(state.facts).filter(f => parseFact(f).op === op);
    // Fixed-form: seeded by week so both probes in a week are comparable.
    const items = pick(pool, 40, rng).map(f => ({ fact_id: f, model: false }));
    return { round_type: 'sprint', items, untimed: false, durationMs: 60000, op };
}

/** Placement sweep: stratified rotation across all families/tables. */
export function placementRound(state, ctx, rng) {
    const strata = [
        ...SCHEDULER.TABLE_ORDER.map(t => ({ kind: 'table', t })),
        ...state.unlockedFamilies.map(f => ({ kind: 'family', f })),
    ];
    const items = [];
    let i = ctx.placementCursor || 0;
    while (items.length < SCHEDULER.QUESTIONS_PER_ROUND) {
        const s = strata[i++ % strata.length];
        const id = s.kind === 'table'
            ? pick(tableFacts(s.t), 1, rng)[0]
            : (familyFacts(s.f) ? pick(familyFacts(s.f), 1, rng)[0] : sampleFamily(s.f, rng));
        const seen = (state.facts[id]?.totalAttempts || 0) +
            items.filter(x => x.fact_id === id).length;
        if (seen < SCHEDULER.PLACEMENT_EXPOSURES) items.push({ fact_id: id, model: false });
        if (i > strata.length * 40) break; // placement effectively complete
    }
    while (items.length < SCHEDULER.QUESTIONS_PER_ROUND) {
        items.push({ fact_id: sampleAnything(state, rng), model: false });
    }
    return { round_type: 'placement', items, untimed: true, placementCursor: i };
}

// ---------- selection helpers ----------

/**
 * 2-3 weakest facts, budget-aware (≤3 correct retrievals/fact/day).
 * Facts already in circulation (seen, weak) come first; brand-NEW facts are
 * introduced only from the current working table (times-table ladder) and
 * only when circulation has room.
 */
export function weakTargets(state, ctx) {
    const budgetLeft = id =>
        (ctx.retrievalsToday[id] || 0) < SCHEDULER.MAX_RETRIEVALS_PER_FACT_PER_DAY;
    const existing = Object.entries(state.facts)
        .filter(([id, r]) => (r.state === 'UNKNOWN' || r.state === 'STUCK' || r.state === 'SLOW') && budgetLeft(id))
        .map(([id, r]) => ({
            id,
            isNew: false,
            score: (r.state === 'SLOW' ? 1 : 2) +
                stalenessDays(r, ctx.day) / 10 +
                errorRate(r) * 2 -
                difficultyScore(id) / 100, // prefer easier weak facts first
        }))
        .sort((a, b) => b.score - a.score);

    // New introductions: unseen facts from the working table, easiest first.
    const wt = workingTable(state);
    const fresh = wt === null ? [] : tableFacts(wt)
        .filter(id => !state.facts[id] && budgetLeft(id))
        .sort((a, b) => difficultyScore(a) - difficultyScore(b))
        .map(id => ({ id, isNew: true, score: 0 }));

    const out = [];
    let unknowns = 0;
    for (const c of [...existing, ...fresh]) {
        const st = c.isNew ? 'UNKNOWN' : state.facts[c.id].state;
        if (st !== 'SLOW') {
            if (unknowns >= Math.min(state.unknownCirculation, SCHEDULER.FOCUS_WEAK_FACTS)) continue;
            unknowns++;
        }
        out.push(c);
        if (out.length >= SCHEDULER.FOCUS_WEAK_FACTS) break;
    }
    return out;
}

/** First table in TABLE_ORDER not yet ~fluent (unseen facts count against). */
export function workingTable(state) {
    for (const t of SCHEDULER.TABLE_ORDER) {
        const ids = tableFacts(t);
        const fluent = ids.filter(id => state.facts[id]?.state === 'FLUENT').length;
        if (fluent / ids.length < 0.7) return t;
    }
    return null; // every table mastered
}

function rankedKnowns(state) {
    return Object.entries(state.facts)
        .filter(([, r]) => r.state === 'FLUENT')
        .sort(([, a], [, b]) => a.medianRt - b.medianRt)
        .map(([id]) => id);
}

function fluentFactIds(state) {
    return Object.entries(state.facts).filter(([, r]) => r.state === 'FLUENT').map(([id]) => id);
}

function stalestMasteredTable(state, day) {
    let best = null, bestGap = -1;
    for (const t of SCHEDULER.TABLE_ORDER) {
        const facts = tableFacts(t).map(f => state.facts[f]).filter(Boolean);
        if (!facts.length) continue;
        const fluentShare = facts.filter(r => r.state === 'FLUENT').length / facts.length;
        if (fluentShare < 0.6) continue;
        const gap = Math.min(...facts.map(r => r.lastSeenDay ? daysBetween(r.lastSeenDay, day) : 999));
        if (gap > bestGap) { bestGap = gap; best = t; }
    }
    return best;
}

export function familyAccuracy(state, fam) {
    const recs = Object.entries(state.facts)
        .filter(([id]) => familyOf(id) === fam)
        .flatMap(([, r]) => r.attempts.slice(-5));
    if (!recs.length) return 0;
    return recs.filter(a => a.correct).length / recs.length;
}

function errorRate(rec) {
    const A = rec.attempts.slice(-5);
    return A.length ? A.filter(a => !a.correct).length / A.length : 1;
}

function stalenessDays(rec, day) {
    return rec.lastSeenDay ? daysBetween(rec.lastSeenDay, day) : 30;
}

function fallbackPool(state) {
    const ids = Object.keys(state.facts);
    return ids.length ? ids : tableFacts(2);
}

function anyPool(state, rng) {
    return fallbackPool(state).map(id => ({ id, w: 1 }));
}

function sampleAnything(state, rng) {
    const pool = fallbackPool(state);
    return pool[Math.floor(rng() * pool.length)];
}

function insertAt(arr, pos, item) {
    arr.splice(Math.min(pos, arr.length), 0, item);
}

function pick(pool, n, rng) {
    const p = [...pool];
    const out = [];
    while (out.length < n && p.length) {
        out.push(p.splice(Math.floor(rng() * p.length), 1)[0]);
        if (!p.length && out.length < n) p.push(...pool); // allow repeats if pool small
    }
    return out;
}

function weightedPick(pool, n, rng) {
    const out = [];
    const total = () => pool.reduce((s, x) => s + x.w, 0);
    for (let i = 0; i < n && pool.length; i++) {
        let r = rng() * total();
        let idx = pool.findIndex(x => (r -= x.w) <= 0);
        if (idx < 0) idx = pool.length - 1;
        out.push(pool[idx].id);
        if (pool.length > n) pool.splice(idx, 1); // avoid repeats when pool is rich
    }
    return out;
}

function daysBetween(a, b) {
    return Math.abs((new Date(b) - new Date(a)) / 86400000);
}
