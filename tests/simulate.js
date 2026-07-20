/**
 * Simulation harness: synthetic children play ~60 days through the real
 * engine (scheduler → answer generation → classify → states → daily adapt).
 * Proves the rules behave before a real child touches them:
 *   - the ladder promotes sanely for a steady learner
 *   - one bad day never demotes anything
 *   - a masher earns nothing and never drives facts into STUCK
 *   - a slow typer still reaches FLUENT (personal cutoffs self-normalise)
 *   - a child with a genuinely weak 7s table gets flagged; a steady one doesn't
 *
 * Run: npm run simulate
 */
import { buildDailyRounds } from '../js/engine/scheduler.js';
import { classifyAnswer, roundIsVoid } from '../js/engine/classify.js';
import { newFactRecord, appendAttempt, FACT_STATES } from '../js/engine/states.js';
import { recomputeStates } from '../js/data/derive.js';
import { processDay, newChildState } from '../js/engine/adapt.js';
import { evaluateFlags, tagError } from '../js/engine/flags.js';
import { parseFact, familyOf, tableFacts } from '../js/engine/facts.js';
import { ADD_FAMILIES } from '../js/engine/facts.js';

function seededRng(seed) {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

/** Persona: models true per-fact skill that improves with retrieval practice. */
class Persona {
    constructor(name, opts, rng) {
        this.name = name;
        this.opts = { baseSkill: 0.6, learnRate: 0.09, typing: 800, lapseRate: 0.03,
            badDayEvery: 0, mashDays: [], weakTables: [], roundsPerDay: () => 2, ...opts };
        this.rng = rng;
        this.skill = {}; // factId -> [0,1]
    }
    skillOf(id) {
        if (!(id in this.skill)) {
            const { op, a, b } = parseFact(id);
            let s = this.opts.baseSkill;
            if (op === 'mul') {
                const t = Math.max(a, b);
                s -= (t - 2) * 0.03;
                if (this.opts.weakTables.includes(t)) s -= 0.6;
            } else {
                s -= ADD_FAMILIES.indexOf(familyOf(id)) * 0.02;
                if (op === 'sub') s -= 0.08;
            }
            this.skill[id] = Math.max(0.05, Math.min(0.95, s));
        }
        return this.skill[id];
    }
    answer(id, dayIdx, mashing) {
        const s = this.skillOf(id);
        const bad = this.opts.badDayEvery && dayIdx % this.opts.badDayEvery === 0 && dayIdx > 0;
        if (mashing) {
            return { correct: this.rng() < 0.15, initiation_ms: 250 + this.rng() * 200, typing_ms: 100 };
        }
        const pCorrect = Math.min(0.98, 0.35 + 0.63 * s) * (bad ? 0.55 : 1);
        const correct = this.rng() < pCorrect;
        const lapse = this.rng() < this.opts.lapseRate;
        let initiation = 700 + (1 - s) * 3800 + this.rng() * 600 + (bad ? 1500 : 0);
        if (lapse) initiation += 9000;
        if (correct && s > 0.8) initiation = 600 + this.rng() * 900 + (bad ? 1200 : 0);
        const timeout = initiation + this.opts.typing >= 12000;
        if (correct && !lapse) this.skill[id] = Math.min(0.98, s + this.opts.learnRate * (this.rng() * 0.5 + 0.75));
        return { correct: correct && !timeout, initiation_ms: Math.round(initiation),
            typing_ms: this.opts.typing, timeout };
    }
}

function simulate(persona, days = 60, seedState) {
    const state = seedState || newChildState();
    const rng = persona.rng;
    const answerLog = []; // {day, ...}
    const audit = [];
    let voidedRounds = 0, totalRounds = 0, medalRounds = 0;

    for (let d = 0; d < days; d++) {
        const day = dayStr(d);
        const mashToday = persona.opts.mashDays.includes(d);
        const ctx = {
            day, retrievalsToday: {}, sprintDue: false,
            placementActive: d < 7 && !seedState, // first week = placement sweep
        };
        const nRounds = persona.opts.roundsPerDay(d, rng);
        const dayAnswers = [];

        for (let r = 0; r < nRounds; r++) {
            const rounds = buildDailyRounds(state, ctx, rng);
            const round = rounds[Math.min(r, rounds.length - 1)];
            totalRounds++;
            const classified = [];
            for (const item of round.items) {
                const id = item.fact_id;
                const rec = state.facts[id] || newFactRecord();
                const ans = persona.answer(id, d, mashToday);
                const cls = classifyAnswer(ans, {
                    medianRt: rec.medianRt,
                    validAttempts: rec.attempts.length,
                    state: rec.state,
                });
                classified.push(cls);
                if (cls.counts_as_retrieval && ans.correct) {
                    ctx.retrievalsToday[id] = (ctx.retrievalsToday[id] || 0) + 1;
                }
                dayAnswers.push({
                    fact_id: id, day, correct: ans.correct && !cls.forced_wrong,
                    // initiation_ms must be logged: flags.js judges speed on
                    // initiation and silently falls back to total rt without it,
                    // so omitting it here left the pre-ship gate exercising the
                    // OLD metric against the new thresholds.
                    initiation_ms: ans.initiation_ms,
                    rt: ans.initiation_ms + ans.typing_ms, cls,
                    round_type: round.round_type, void: false,
                    given: ans.correct ? parseFact(id).answer : parseFact(id).answer + 1,
                    errorTag: ans.correct ? null : tagError(id, parseFact(id).answer + 1),
                });
            }
            const isVoid = roundIsVoid(classified);
            if (isVoid) {
                voidedRounds++;
                for (let i = dayAnswers.length - round.items.length; i < dayAnswers.length; i++) {
                    dayAnswers[i].void = true;
                }
            } else {
                medalRounds++;
            }
        }

        // Apply attempts → fact records + states (as the app does per round).
        const factsBefore = structuredClone(state.facts); // off-day rollback (DESIGN §2)
        for (const a of dayAnswers) {
            if (a.void) continue;
            const rec = state.facts[a.fact_id] || newFactRecord();
            state.facts[a.fact_id] = appendAttempt(rec,
                { correct: a.correct, initiation_ms: a.rt - persona.opts.typing, typing_ms: persona.opts.typing },
                a.cls, day);
        }
        // Call the SHIPPED fold rather than re-implementing it. This block used
        // to be a third copy of recomputeStates() and had silently drifted:
        // after speed classification moved to initiation, it was still feeding
        // medianRt to a childCutoff() that no longer took a typing argument and
        // skipping the problem-size allowance — so the mandatory pre-ship gate
        // was validating the old metric against the new thresholds.
        recomputeStates(state);

        // Daily adaptation.
        const res = processDay(day, dayAnswers, state);
        if (res.audit.some(a => a.type === 'off_day')) res.state.facts = factsBefore;
        Object.assign(state, res.state);
        audit.push(...res.audit);
        answerLog.push(...dayAnswers);
    }
    return { state, audit, answerLog, voidedRounds, totalRounds, medalRounds };
}

function dayStr(i) {
    const d = new Date(2026, 6, 1 + i);
    return d.toISOString().slice(0, 10);
}

/** Tally by fact state. Derived from FACT_STATES so adding a state can never
 *  silently NaN a bucket (a hardcoded list did exactly that when UNSETTLED
 *  landed: c['UNSETTLED']++ on an absent key printed as null). */
function counts(state) {
    const c = Object.fromEntries(FACT_STATES.map(s => [s, 0]));
    for (const r of Object.values(state.facts)) {
        if (!(r.state in c)) throw new Error(`unknown fact state: ${r.state}`);
        c[r.state]++;
    }
    return c;
}

let failures = 0;
function check(cond, msg) {
    console.log(`  ${cond ? 'ok ' : 'FAIL'} ${msg}`);
    if (!cond) failures++;
}

// Families every child starts with (age-appropriate ladder start) — ladder
// "progress" means unlocking beyond this set.
const START_FAMILIES = newChildState().unlockedFamilies.length;

// ---------------- personas ----------------

console.log('\n== steady (85-90%, 2-4 rounds/day, 60 days) ==');
{
    const rng = seededRng(1);
    const p = new Persona('steady', { baseSkill: 0.62, roundsPerDay: (d, r) => 2 + Math.floor(r() * 3) }, rng);
    const { state, audit, voidedRounds } = simulate(p, 60);
    const c = counts(state);
    const unlocked = state.unlockedFamilies.length;
    console.log(`  facts: ${JSON.stringify(c)}; families unlocked: ${unlocked}; voided: ${voidedRounds}`);
    check(c.FLUENT > 30, `builds a fluent base (${c.FLUENT})`);
    check(unlocked > START_FAMILIES, `ladder progresses beyond the start (${unlocked} families)`);
    check(voidedRounds === 0, 'no voided rounds for an honest player');
    check(!audit.some(a => a.type === 'family_demoted'), 'no spurious demotions');
}

console.log('\n== bad-day-prone (catastrophic day every 8th) ==');
{
    const rng = seededRng(2);
    const p = new Persona('badday', { baseSkill: 0.62, badDayEvery: 8, roundsPerDay: () => 3 }, rng);
    const { state, audit } = simulate(p, 60);
    const offDays = audit.filter(a => a.type === 'off_day').length;
    const demotions = audit.filter(a => a.type === 'family_demoted').length;
    console.log(`  off-days detected: ${offDays}; demotions: ${demotions}; families: ${state.unlockedFamilies.length}`);
    check(offDays >= 3, `off-day guard catches bad days (${offDays})`);
    check(demotions === 0, 'bad days never demote');
    // The frontier may legitimately hold for a marginal child (mastery gate);
    // what bad days must NOT do is derail the ladder vs a steady twin.
    const control = new Persona('badday-control', { baseSkill: 0.62, roundsPerDay: () => 3 }, seededRng(2));
    const simC = simulate(control, 60);
    check(state.unlockedFamilies.length >= simC.state.unlockedFamilies.length - 2,
        `bad days don't derail the ladder (${state.unlockedFamilies.length} vs steady twin ${simC.state.unlockedFamilies.length})`);
}

console.log('\n== masher (mashes 1 day in 5) ==');
{
    const rng = seededRng(3);
    const p = new Persona('masher', { baseSkill: 0.62, mashDays: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50], roundsPerDay: () => 3 }, rng);
    const { state, voidedRounds, audit } = simulate(p, 60);
    const c = counts(state);
    console.log(`  voided rounds: ${voidedRounds}; facts: ${JSON.stringify(c)}`);
    check(voidedRounds >= 20, `mash rounds are voided (${voidedRounds})`);
    check(c.STUCK <= 2, `mashing does not create STUCK facts (${c.STUCK})`);
    check(!audit.some(a => a.type === 'family_demoted'), 'mashing never demotes families');
}

console.log('\n== slow typer (accurate, 2.5s typing) ==');
{
    const rng = seededRng(4);
    const p = new Persona('slowtyper', { baseSkill: 0.7, typing: 2500, roundsPerDay: () => 3 }, rng);
    const { state } = simulate(p, 60);
    const c = counts(state);
    console.log(`  facts: ${JSON.stringify(c)}`);
    check(c.FLUENT > 20, `slow typing does not block FLUENT (${c.FLUENT}) — personal cutoff self-normalises`);
}

console.log('\n== weak-7s child (flags should fire while 7s are worked) vs steady ==');
/*
 * These checks are SEED-AVERAGED, deliberately (2026-07-20).
 *
 * They used to assert a single seed's outcome. That is not a valid test of this
 * system: persona.rng is shared between scheduler item-selection and answer
 * generation, so any change to the round-building code path — including a pure
 * relabel that alters no semantics — reshuffles every subsequent draw over 45
 * simulated days. A single seed therefore reports one draw from a chaotic
 * process, and the old assertions happened to sit on a knife edge (the weak
 * child's table-7 cleared the then-FLAGS.MIN_ATTEMPTS bar, since removed, by
 * exactly zero margin). A control
 * that adds one wasted rng() call and changes nothing else flips them both.
 *
 * A rate over many seeds measures what the checks claim to measure. But 20
 * seeds does not: at n=20 the 95% CI on a rate near 0.7 is roughly ±20pt, so
 * `hitRate >= 0.70` was a coin flip — measured over 392 seeds, the engine that
 * set that bar had a true sensitivity of 70.2% and therefore failed its OWN
 * gate about 39% of the time. An assertion that fails two runs in five on
 * unchanged code guards nothing and trains people to re-run it.
 *
 * SEEDS = 100 (2026-07-20). The BAR IS UNCHANGED at 0.70 — deliberately; the
 * fix for an underpowered test is sample size, never a friendlier threshold.
 * What changed is that the estimate is now tight enough for the bar to mean
 * something: measured over 400 paired seeds the structural criterion's
 * sensitivity is 88.0% (95% Wilson CI 84.5-90.8), so at n=100 the whole
 * interval sits ~18pt clear of the bar and P(spurious failure) is ~1e-7. The
 * other bars are set between measured regimes, not at observed values — see
 * the mutation table in DESIGN §3.
 *
 * Costs ~30s. That is the price of a gate whose verdict is reproducible.
 */
{
    const SEEDS = 100;
    /** Play one persona for 45 days and return every theme ever flagged. */
    function flaggedThemes(persona) {
        const { state, answerLog } = simulate(persona, 45);
        const flagged = new Set();
        // Evaluate weekly with a trailing 14-day window, as the app does. Pass
        // the full fact RECORDS — evaluateFlags reads cumulative attempts.
        for (let d = 14; d < 45; d += 7) {
            const win = answerLog.filter(a => a.day >= dayStr(d - 14) && a.day <= dayStr(d) && !a.void);
            for (const [t, f] of Object.entries(evaluateFlags(win, {}, state.facts, dayStr(d)))) {
                if (f.state === 'flagged') flagged.add(t);
            }
        }
        return flagged;
    }

    let weakHit = 0, steadyQuiet = 0, steadyFalse7 = 0;
    let weakFlagTotal = 0, steadyFlagTotal = 0;
    for (let i = 0; i < SEEDS; i++) {
        const weak = flaggedThemes(new Persona('weak7s',
            { baseSkill: 0.8, weakTables: [7], roundsPerDay: () => 4 }, seededRng(100 + i)));
        // Same seed, same everything, EXCEPT the 7s are not weak. The paired
        // control is what makes this a discrimination test rather than a
        // base-rate test.
        const steady = flaggedThemes(new Persona('steady2',
            { baseSkill: 0.8, roundsPerDay: () => 4 }, seededRng(100 + i)));
        if (weak.has('table-7')) weakHit++;
        if (steady.has('table-7')) steadyFalse7++;
        if (steady.size <= 1) steadyQuiet++;
        weakFlagTotal += weak.size;
        steadyFlagTotal += steady.size;
    }
    const hitRate = weakHit / SEEDS, falseRate = steadyFalse7 / SEEDS, quietRate = steadyQuiet / SEEDS;
    console.log(`  weak-7s child: table-7 flagged in ${weakHit}/${SEEDS} seeds ` +
        `(${(weakFlagTotal / SEEDS).toFixed(1)} themes flagged/seed)`);
    console.log(`  steady twin:   table-7 flagged in ${steadyFalse7}/${SEEDS} seeds ` +
        `(${(steadyFlagTotal / SEEDS).toFixed(1)} themes flagged/seed), ` +
        `≤1 flag in ${steadyQuiet}/${SEEDS}`);

    // Sensitivity: a genuinely weak table is usually caught.
    check(hitRate >= 0.70, `weak 7s table flagged in most seeds (${(hitRate * 100).toFixed(0)}%)`);
    // Specificity: the same table in a child who is fine is usually not caught.
    check(falseRate <= 0.20, `steady twin's 7s rarely flagged (${(falseRate * 100).toFixed(0)}%)`);
    // Discrimination — the check that actually guards the construct. It fails
    // if the flag goes dead (hitRate→0) AND if it fires on everything
    // (falseRate→hitRate), so neither degenerate engine can pass it.
    check(hitRate - falseRate >= 0.50,
        `flag discriminates weak 7s from steady 7s (${((hitRate - falseRate) * 100).toFixed(0)}pt gap)`);
    // The dashboard must stay readable: a steady child is not a wall of amber.
    check(quietRate >= 0.60, `steady child mostly unflagged (${(quietRate * 100).toFixed(0)}% of seeds ≤1 flag)`);
    // Mean false flags per steady seed is the SENSITIVE specificity measure —
    // the ≤1-flag rate above saturates and hides regressions. Measured: 0.1
    // with fact-state corroboration, 0.9 without it (a 9× swing that the
    // saturating check only registered as 100%→80%). The 0.4 bar sits between
    // the two measured regimes.
    check(steadyFlagTotal / SEEDS <= 0.4,
        `steady child accrues few false flags (${(steadyFlagTotal / SEEDS).toFixed(2)}/seed)`);
}

console.log(failures ? `\n${failures} CHECKS FAILED` : '\nall simulation checks passed');
process.exit(failures ? 1 : 0);
