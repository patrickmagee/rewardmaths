/**
 * Round builder (docs/DESIGN.md §2 "Scheduler").
 * Pure: takes child state + day context + seeded rng, returns a round plan.
 *
 * Round plan: { round_type, items: [{ fact_id, model: bool }], untimed: bool,
 *               blockedFamily?: string }
 * `model: true` → show the fact WITH its answer first ("7 × 8 = 56 — now you").
 */
import { SCHEDULER } from '../config.js';
import { tableFacts, familyFacts, sampleFamily, familyOf, difficultyScore, parseFact, ADD_FAMILIES, isRetiredFamily, isEasyMulFact, isLargeFact } from './facts.js';
import { ACCURATE_STATES } from './states.js';

/** The child's frontier: the highest unlocked add family. (Kept local to avoid
 *  a scheduler→adapt import cycle; mirrors adapt.currentFrontier.) */
function frontierOf(state) {
    const unlocked = state.unlockedFamilies || [];
    return ADD_FAMILIES.filter(f => unlocked.includes(f)).pop() || null;
}

/**
 * Has the child outgrown this fact? Two routes, one destination (maintenance):
 *
 *  - add/sub: the fact's family is ≥ RETIRE_DISTANCE rungs below a two-digit
 *    frontier (isRetiredFamily).
 *  - multiplication: the fact has a one-step derived route (×0/1/2/5/10/11) AND
 *    the child already has enough real mul work in circulation to fill rounds
 *    without it (MUL_MAINTENANCE_MIN_CORE). Tables carry no ladder rung, so the
 *    add/sub distance rule can never reach them; without this arm 46 of Tom's
 *    66 circulating mul facts sat at full weight and 11s alone took a quarter
 *    of his multiplication.
 */
function isRetired(ctx, id) {
    if (ctx.frontier && isRetiredFamily(familyOf(id), ctx.frontier, SCHEDULER.RETIRE_DISTANCE)) return true;
    return ctx.coreDepth && isEasyMulFact(id);
}

/** Per-call retirement context. Both terms are whole-state properties, so they
 *  are computed ONCE per round and threaded through — calling hasCoreMulDepth()
 *  from inside a per-fact predicate made every round O(facts²) and took the
 *  60-day simulation from seconds to minutes. */
function retireCtx(state) {
    return { frontier: frontierOf(state), coreDepth: hasCoreMulDepth(state) };
}

/** Enough accurate NON-easy mul facts to sustain rounds without the easy ones.
 *  Guards a beginner whose entire repertoire is 2s/5s/10s from having their
 *  whole multiplication pool retired out from under them. */
function hasCoreMulDepth(state) {
    let n = 0;
    for (const [id, rec] of Object.entries(state.facts)) {
        if (!ACCURATE_STATES.has(rec.state)) continue;
        if (!id.includes('x') || isEasyMulFact(id)) continue;
        if (++n >= SCHEDULER.MUL_MAINTENANCE_MIN_CORE) return true;
    }
    return false;
}

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
    // warm-up families rotate by day. The slot is shared day-about with the
    // true focus round: the ladder frontier lives in warm-up for weeks, and
    // letting it monopolise the slot starves times-table weak-fact work.
    const wu = state.warmupFamilies || [];
    const dom = new Date(ctx.day).getDate();
    // Parity gates entry (warm-up shares the slot day-about); the index rotates
    // independently so every warm-up family is reachable. Reusing `dom` for both
    // pinned a 2-element list to wu[0] forever (even % 2 === 0), starving wu[1].
    const warmup = wu.length && dom % 2 === 0 ? wu[Math.floor(dom / 2) % wu.length] : null;
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
        : revisionPool(state);
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

/**
 * Mixed: interleaved across all learned material.
 *
 * Selection is deliberately blind to SPEED (parent decision 2026-07-20).
 * A fact the child gets right is a fact the child knows, whether they recalled
 * it or worked it out — practice is allocated on accuracy and staleness only.
 * SLOW is still computed and still shown on the parent's fact map, but it no
 * longer buys a fact extra repetitions: this is training, not a test, and
 * nobody gets drilled for thinking. UNSETTLED keeps a mild boost, which is not
 * a speed judgement — it is simply the fact needing more attempts before any
 * verdict is possible.
 *
 * DIFFICULTY, unlike speed, does allocate practice (parent decision
 * 2026-07-25). Facts with both operands ≥ 6 draw at LARGE_FACT_WEIGHT, and
 * outgrown material — retired add/sub families plus one-step-derivable
 * multiplication — is capped at MAINTENANCE_SLOTS items per round instead of
 * competing for every slot. That is the curriculum deciding where the time
 * goes, not the engine judging the child.
 */
export function mixedRound(state, ctx, rng) {
    const pool = [];
    const rc = retireCtx(state);
    // DESIGN §1 volume cap: "max ~3 correct retrievals/day, then that fact
    // stops being served". Until 2026-07-28 MAX_RETRIEVALS_PER_FACT_PER_DAY was
    // read in weakTargets() ALONE, so the cap bound focus-round weak facts and
    // nothing else — while every round past the third is a mixed round, which
    // is exactly where a longer day adds volume. Measured over 24 seeds on the
    // real logs, 4th-plus exposures ran 0.8%/1.7% of items at 6 rounds and
    // 3.1%/5.7% at 8. ctx.retrievalsToday is live within a session (main.js
    // re-derives after every round), so this re-reads as the day fills up.
    const budgetLeft = id =>
        ((ctx.retrievalsToday || {})[id] || 0) < SCHEDULER.MAX_RETRIEVALS_PER_FACT_PER_DAY;
    // Same pool without the budget filter, kept only as the exhaustion fallback
    // below — never used while any in-budget candidate remains.
    const poolNoBudget = [];
    const retiredMaint = []; // outgrown material — occasional maintenance only
    for (const [id, rec] of Object.entries(state.facts)) {
        const ret = isRetired(rc, id);
        let entry = null;
        if (rec.state === 'FLUENT' || rec.state === 'SLOW') {
            entry = { id, w: weightOf(id, 1) };
        } else if (rec.state === 'UNSETTLED') {
            entry = { id, w: weightOf(id, SCHEDULER.UNSETTLED_WEIGHT) };
        }
        if (!entry) continue;
        // Retired UNSETTLED still goes to maintenance (not dropped): it
        // resurfaces occasionally so it can still settle rather than being
        // frozen UNSETTLED forever on the parent's fact map.
        if (ret) {
            if (budgetLeft(id)) retiredMaint.push({ id, rec });
            continue;
        }
        poolNoBudget.push(entry);
        if (budgetLeft(id)) pool.push(entry);
    }
    // Stale-fact reinjection — staleness IS still a reason to resurface a fact,
    // but not one the child has outgrown (that lane is maintenance, below).
    for (const [id, rec] of Object.entries(state.facts)) {
        if (isRetired(rc, id) || !budgetLeft(id)) continue;
        if (rec.lastSeenDay && daysBetween(rec.lastSeenDay, ctx.day) >= SCHEDULER.FACT_STALE_DAYS) {
            pool.push({ id, w: SCHEDULER.STALE_WEIGHT });
        }
    }
    // Parametric variety from unlocked two-digit families (the child's current
    // add/sub level once they've moved up the ladder). Retired ones are skipped:
    // a frontier of td-td must not keep synthesising fresh td-ones items.
    for (const fam of (state.unlockedFamilies || [])) {
        if (familyFacts(fam)) continue;
        if (rc.frontier && isRetiredFamily(fam, rc.frontier, SCHEDULER.RETIRE_DISTANCE)) continue;
        // Sampled ids can repeat across a long day, so they take the cap too.
        const sampled = sampleFamily(fam, rng);
        if (budgetLeft(sampled)) pool.push({ id: sampled, w: 1 });
    }

    const n = SCHEDULER.QUESTIONS_PER_ROUND;
    // Maintenance is drawn FIRST, as a hard cap on items rather than a cap on
    // pool candidates. Two candidates at MAINTENANCE_WEIGHT against a ~40-weight
    // pool were only drawn ~2% of the time, so a large retired set took months
    // to cycle; a fixed 2-of-10, stalest first, is both the "occasional" the
    // design intends and a rotation that actually reaches every retired fact.
    retiredMaint.sort((a, b) => stalenessDays(b.rec, ctx.day) - stalenessDays(a.rec, ctx.day));
    const maint = retiredMaint.slice(0, SCHEDULER.MAINTENANCE_SLOTS).map(m => m.id);
    // Budget exhaustion must NOT reach anyPool(). Rounds 4+ are all mixed
    // rounds, so a long day draws 6+ of them; a child with a thin circulating
    // set can spend every fact's 3-retrieval budget and drain the filtered pool.
    // anyPool() is the last-ditch fallback and ignores retirement, the budget
    // AND the UNKNOWN exclusion — it would put UNKNOWN facts into the mixed
    // lane, which DESIGN §3 relies on never happening.
    //
    // Top up rather than swap: weightedPick only de-duplicates while the pool is
    // LARGER than the number wanted — below that it draws with replacement, and
    // both draws see the same pre-round retrievalsToday, so a drained pool
    // serves the same fact twice in one round (measured: Eliza, 10+ rounds).
    // The cap is what drains the pool, so it has to be the thing that yields.
    // Over-serving a fact the child already knows is much the lesser evil.
    const want = n - maint.length;
    if (pool.length < want) {
        const have = new Set(pool.map(p => p.id));
        for (const e of poolNoBudget) if (!have.has(e.id)) pool.push(e);
    }
    const fill = weightedPick(pool.length ? pool : anyPool(state, rng), want, rng);
    // Interleave so maintenance isn't a predictable easy block at one end.
    const items = shuffle([...fill, ...maint], rng).slice(0, n)
        .map(f => ({ fact_id: f, model: false }));
    return { round_type: 'mixed', items, untimed: false };
}

/** Base weight scaled for problem size: the 6/7/8/9 core (and 12×6..12×9) is
 *  where fluency is actually won, so it draws LARGE_FACT_WEIGHT× as often. */
function weightOf(id, base) {
    return isLargeFact(id) ? base * SCHEDULER.LARGE_FACT_WEIGHT : base;
}

/**
 * Blocked warm-up round for a family/table still under the accuracy gate.
 *
 * `family` may be a times table: adapt.js keys demotion evidence by familyOf(),
 * which returns `table-N` for multiplication, so a mastered table that collapses
 * is pushed into warmupFamilies and lands here. That is the right behaviour —
 * a broken table should get blocked warm-up rounds — but table ids are not in
 * familyFacts(), which returned null and sent the parametric sampler looking for
 * members it does not have (crash: `members.length` of null, ~1 run in 250).
 */
export function blockedRound(state, family, rng) {
    const table = /^table-(\d+)$/.exec(family);
    // Only td-* families are parametric (sampleFamily can synthesize members);
    // any other familyFacts()-null id (e.g. malformed "table-??" from an
    // operand>12) would crash sampleFamily, so fall back to a safe fixed pool.
    const pool = (table ? tableFacts(+table[1]) : familyFacts(family)) ||
        (family.startsWith('td-') ? Array.from({ length: 20 }, () => sampleFamily(family, rng)) : tableFacts(2));
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
 *
 * "Weak" means the child is getting it WRONG — UNKNOWN or STUCK. Neither
 * UNSETTLED nor SLOW qualifies (parent decision 2026-07-20):
 *   - UNSETTLED is being answered correctly and has simply not been met often
 *     enough for a verdict. Treating it as a struggle — which is what happened
 *     while these facts were mislabelled SLOW — spent focus rounds re-teaching
 *     facts the child already had.
 *   - SLOW is also being answered correctly, just by working it out rather than
 *     recalling it. That is worth showing a parent, but it is not a failure and
 *     it does not earn remediation. Training, not a test.
 * Accuracy and staleness are the only inputs left.
 */
export function weakTargets(state, ctx) {
    const budgetLeft = id =>
        (ctx.retrievalsToday[id] || 0) < SCHEDULER.MAX_RETRIEVALS_PER_FACT_PER_DAY;
    const existing = Object.entries(state.facts)
        .filter(([id, r]) => (r.state === 'UNKNOWN' || r.state === 'STUCK') && budgetLeft(id))
        .map(([id, r]) => ({
            id,
            isNew: false,
            score: 2 +
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

    // Every candidate is now UNKNOWN/STUCK/new, so all of them consume the
    // circulation budget — the old `st !== 'SLOW'` exemption is gone with SLOW.
    const out = [];
    let unknowns = 0;
    for (const c of [...existing, ...fresh]) {
        if (unknowns >= Math.min(state.unknownCirculation, SCHEDULER.FOCUS_WEAK_FACTS)) continue;
        unknowns++;
        out.push(c);
        if (out.length >= SCHEDULER.FOCUS_WEAK_FACTS) break;
    }
    return out;
}

/** First table in TABLE_ORDER not yet ~mastered (unseen facts count against).
 *  Mastery mirrors the ladder gate in adapt.js: an accurately-answered fact
 *  counts whether it's FLUENT, SLOW, or UNSETTLED (ACCURATE_STATES). Counting
 *  FLUENT only meant a table with settled-but-not-yet-fluent facts never
 *  cleared 70%, pinning every child on table 2 (and the child-facing "today"
 *  copy in main.js with it). Speed no longer gates progression (DESIGN §2). */
export function workingTable(state) {
    for (const t of SCHEDULER.TABLE_ORDER) {
        const ids = tableFacts(t);
        const mastered = ids.filter(id => ACCURATE_STATES.has(state.facts[id]?.state)).length;
        if (mastered / ids.length < 0.7) return t;
    }
    return null; // every table mastered
}

/**
 * Known material for focus-round openers and filler: FLUENT first (so the
 * momentum openers really are the child's fastest facts), then the rest of
 * ACCURATE_STATES by speed.
 *
 * FLUENT-ONLY was too narrow once easy multiplication joined the retired set
 * (2026-07-25). Most of what a mid-ladder child has driven all the way to
 * FLUENT is precisely the ×2/×5/×10/×11 material now held back — Tom was left
 * with three eligible facts, so a focus round filled its seven known slots by
 * cycling the same three. Same failure mode, and same fix, as `workingTable()`
 * on 2026-07-21: accuracy is what "known" means here, speed is not.
 */
function rankedKnowns(state) {
    const rc = retireCtx(state);
    const rank = r => (r.state === 'FLUENT' ? 0 : 1);
    return Object.entries(state.facts)
        .filter(([id, r]) => ACCURATE_STATES.has(r.state) && !isRetired(rc, id))
        .sort(([, a], [, b]) =>
            rank(a) - rank(b) ||
            (a.medianInit ?? Infinity) - (b.medianInit ?? Infinity))
        .map(([id]) => id);
}

/** Review fallback pool when no table qualifies: everything the child has
 *  learned and not outgrown. Accurate, not FLUENT-only — see rankedKnowns(). */
function revisionPool(state) {
    const rc = retireCtx(state);
    return Object.entries(state.facts)
        .filter(([id, r]) => ACCURATE_STATES.has(r.state) && !isRetired(rc, id))
        .map(([id]) => id);
}

/**
 * Stalest mastered table for the review round.
 *
 * A one-step-trick table (2/5/10/11 — SCHEDULER.EASY_MUL_OPERANDS) is only a
 * legitimate review target for a child who has not yet got past it. Once
 * hasCoreMulDepth() holds, those facts are maintenance, and a maintenance fact
 * must not be able to claim a whole 10-question round — review is a third of
 * the day's practice. Returning null then is the right answer, not a
 * consolation table: reviewRound falls through to the child's fluent-fact pool,
 * which is retirement-filtered and so reviews the material they actually had to
 * learn. Same gate as the mixed-round easy-mul rule, so the two can't disagree.
 */
function stalestMasteredTable(state, day) {
    const skipEasy = hasCoreMulDepth(state);
    let best = null, bestGap = -1;
    for (const t of SCHEDULER.TABLE_ORDER) {
        if (skipEasy && SCHEDULER.EASY_MUL_OPERANDS.includes(t)) continue;
        const facts = tableFacts(t).map(f => state.facts[f]).filter(Boolean);
        // A table needs enough MET facts to fill a round without repeats.
        // pick() recycles a short pool, so a table the child has met three
        // facts of produced "3x8 3x6 8x12 8x12 3x6 3x8 …" — ten questions, three
        // facts. That was always possible; skipping the easy tables (which are
        // large and fully met) is what made it likely, so the guard lands here.
        if (facts.length < SCHEDULER.QUESTIONS_PER_ROUND) continue;
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

/** Seeded Fisher-Yates — keeps the round order deterministic per seed. */
function shuffle(xs, rng) {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
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
