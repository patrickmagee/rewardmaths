/**
 * Daily adaptation (docs/DESIGN.md §2 "Adaptation metric").
 * Pure + idempotent: processDay() consumes one complete day's classified
 * answers and the prior child state, returns the next state + audit entries.
 * Runs lazily on first app-open of a new day; recomputable from the log.
 *
 * Child adaptive state shape (subset relevant here):
 *   { facts: { [factId]: factRecord }, familyEMA: { [family]: number },
 *     unlockedFamilies: string[], warmupFamilies: string[],
 *     demotionEvidence: { [family]: [{day, pDay}] },
 *     promotionEvidence: { [family]: string[] (days) },
 *     fluentRtByDay: [{day, medianRt}], lastProcessedDay, audit: [] }
 */
import { ADAPT, SCHEDULER } from '../config.js';
import { ADD_FAMILIES, SUB_PARTNER, familyOf } from './facts.js';
import { ACCURATE_STATES, median } from './states.js';

/**
 * @param {string} day  yyyy-mm-dd being processed (must be complete)
 * @param {Array} answers  that day's answers, each { fact_id, correct, rt,
 *     cls (classification), round_type, void (round/session voided) }
 * @param {object} state  prior adaptive state (not mutated)
 * @returns {{ state: object, audit: Array }}
 */
export function processDay(day, answers, state) {
    const audit = [];
    const next = structuredClone(state);
    next.lastProcessedDay = day;

    const usable = answers.filter(a => !a.void && a.round_type !== 'free');
    if (!usable.length) return { state: next, audit };

    // ---- Off-day guard: judge today's FLUENT-fact performance vs baseline.
    const fluent = usable.filter(a => (state.facts[a.fact_id]?.state) === 'FLUENT');
    const fluentAcc = fluent.length >= ADAPT.MIN_ITEMS_PER_DAY
        ? fluent.filter(a => a.cls.counts_for_accuracy && a.correct).length /
          Math.max(1, fluent.filter(a => a.cls.counts_for_accuracy).length)
        : null;
    const fluentRt = median(fluent.filter(a => a.cls.counts_for_rt).map(a => a.rt));
    const baseRt = trailingFluentRt(state, ADAPT.OFFDAY_BASELINE_DAYS);
    const offDay =
        (baseRt > 0 && fluentRt > 0 && fluentRt > ADAPT.OFFDAY_RT_MULT * baseRt) ||
        (fluentAcc !== null && fluentAcc < ADAPT.OFFDAY_FLUENT_ACCURACY);

    if (fluentRt > 0 && !offDay) {
        next.fluentRtByDay = [...(next.fluentRtByDay || []), { day, medianRt: fluentRt }]
            .slice(-ADAPT.OFFDAY_BASELINE_DAYS * 2);
    }
    if (offDay) {
        audit.push({ day, type: 'off_day', fluentAcc, fluentRt, baseRt });
        return { state: next, audit }; // nothing else is written
    }

    // ---- P_day per family, EMA update.
    const byFamily = groupBy(usable.filter(a => a.cls.counts_for_accuracy),
        a => familyOf(a.fact_id));
    for (const [fam, items] of Object.entries(byFamily)) {
        if (items.length < ADAPT.MIN_ITEMS_PER_DAY) continue;
        const pDay = items.filter(a => a.correct).length / items.length;
        const prev = next.familyEMA[fam];
        next.familyEMA[fam] = prev === undefined
            ? pDay // fast initialization from first observed day(s)
            : (1 - ADAPT.EMA_ALPHA) * prev + ADAPT.EMA_ALPHA * pDay;
        next.familyHighWater[fam] = Math.max(next.familyHighWater[fam] || 0, next.familyEMA[fam]);
        audit.push({ day, type: 'ema', family: fam, pDay, ema: next.familyEMA[fam], n: items.length });

        // Demotion evidence accrues only on sub-floor raw days.
        if (pDay < ADAPT.DEMOTE_FLOOR) {
            next.demotionEvidence[fam] = [...(next.demotionEvidence[fam] || []), { day, pDay }]
                .filter(e => daysBetween(e.day, day) <= 14);
        } else {
            next.demotionEvidence[fam] = [];
        }
        // Promotion evidence: days meeting the EMA bar.
        if (next.familyEMA[fam] >= ADAPT.PROMOTE_EMA) {
            const ds = new Set([...(next.promotionEvidence[fam] || []), day]);
            next.promotionEvidence[fam] = [...ds].slice(-7);
        }
    }

    // ---- Transitions (facts were already updated attempt-by-attempt).
    applyPromotions(next, day, audit);
    applyDemotions(next, day, audit);

    return { state: next, audit };
}

function applyPromotions(state, day, audit) {
    // Graduate NON-frontier warm-up families (recovery / sub partners) once
    // accuracy clears the blocked gate. The frontier stays in warm-up until it
    // fully unlocks the next family — otherwise its practice volume collapses
    // before the 2-day unlock evidence can accumulate.
    const frontierFam = currentFrontier(state);
    state.warmupFamilies = (state.warmupFamilies || []).filter(fam => {
        if (fam === frontierFam) return true;
        const ema = state.familyEMA[fam] ?? 0;
        if (ema >= SCHEDULER.BLOCKED_UNTIL_ACCURACY) {
            audit.push({ day, type: 'warmup_graduated', family: fam, ema });
            return false;
        }
        return true;
    });

    // Unlock the next ladder family when the frontier clears the mastery gate.
    const frontier = frontierFam;
    if (!frontier) return;
    const ema = state.familyEMA[frontier] ?? 0;
    const days = state.promotionEvidence[frontier] || [];
    const facts = factsInFamily(state, frontier);
    const okShare = facts.length
        ? facts.filter(f => ACCURATE_STATES.has(f.state)).length / facts.length
        : 0;
    if (ema >= ADAPT.PROMOTE_EMA && days.length >= ADAPT.PROMOTE_MIN_DAYS &&
        okShare >= ADAPT.PROMOTE_FACTS_OK) {
        // The old frontier graduates out of warm-up as the next family unlocks.
        state.warmupFamilies = (state.warmupFamilies || []).filter(f => f !== frontier);
        audit.push({ day, type: 'warmup_graduated', family: frontier, ema });
        const nextFam = nextLadderFamily(state);
        if (nextFam) {
            state.unlockedFamilies.push(nextFam);
            state.warmupFamilies = [...(state.warmupFamilies || []), nextFam];
            audit.push({ day, type: 'family_unlocked', family: nextFam, from: frontier, ema, okShare });
        }
        // Addition family fully fluent → unlock its subtraction partner.
        const sub = SUB_PARTNER[frontier];
        if (sub && !state.unlockedFamilies.includes(sub)) {
            state.unlockedFamilies.push(sub);
            state.warmupFamilies = [...(state.warmupFamilies || []), sub];
            audit.push({ day, type: 'family_unlocked', family: sub, partnerOf: frontier });
        }
    }
}

function applyDemotions(state, day, audit) {
    for (const [fam, evidence] of Object.entries(state.demotionEvidence)) {
        // Only families that were once genuinely mastered can demote —
        // a still-being-learned family below the floor is just "learning".
        if ((state.familyHighWater[fam] || 0) < ADAPT.PROMOTE_EMA) continue;
        const ema = state.familyEMA[fam] ?? 1;
        const distinctDays = new Set(evidence.map(e => e.day)).size;
        if (ema < ADAPT.DEMOTE_FLOOR && distinctDays >= ADAPT.DEMOTE_MIN_DAYS) {
            if (!(state.warmupFamilies || []).includes(fam)) {
                state.warmupFamilies = [...(state.warmupFamilies || []), fam];
                audit.push({ day, type: 'family_demoted', family: fam, ema, evidence: [...evidence] });
            }
            state.demotionEvidence[fam] = [];
        }
    }
}

/** The highest unlocked add/sub ladder family (times tables ladder separately). */
export function currentFrontier(state) {
    const unlockedAdds = ADD_FAMILIES.filter(f => state.unlockedFamilies.includes(f));
    return unlockedAdds[unlockedAdds.length - 1] || null;
}

export function nextLadderFamily(state) {
    return ADD_FAMILIES.find(f => !state.unlockedFamilies.includes(f)) || null;
}

/**
 * Ladder starting set (SCHEDULER.ADD_START_FAMILY): every family below the
 * start is assumed prior knowledge — unlocked along with its subtraction
 * partner so the placement sweep probes them and weak facts surface as
 * UNKNOWN. The start family itself is the warm-up frontier.
 */
export function startingFamilies() {
    const idx = Math.max(0, ADD_FAMILIES.indexOf(SCHEDULER.ADD_START_FAMILY));
    const adds = ADD_FAMILIES.slice(0, idx + 1);
    const subs = adds.slice(0, -1).map(f => SUB_PARTNER[f]).filter(Boolean);
    return [...adds, ...subs];
}

export function newChildState(opts = {}) {
    const unlocked = opts.unlockedFamilies || startingFamilies();
    const addFrontier = ADD_FAMILIES.filter(f => unlocked.includes(f)).pop();
    return {
        facts: {},
        familyEMA: {},
        familyHighWater: {},
        unlockedFamilies: unlocked,
        // The frontier family starts in warm-up so the scheduler serves it
        // blocked rounds until it clears the accuracy gate.
        warmupFamilies: addFrontier ? [addFrontier] : [],
        demotionEvidence: {},
        promotionEvidence: {},
        fluentRtByDay: [],
        unknownCirculation: opts.unknownCirculation || SCHEDULER.UNKNOWN_CIRCULATION_DEFAULT,
        lastProcessedDay: null,
    };
}

// applyAnswers() lived here: a second copy of the fact-record fold + cutoff
// recomputation that duplicated derive.js recomputeStates(). It had no callers
// anywhere in the app or the tests, and it had already silently drifted out of
// sync with the real fold once. Deleted 2026-07-20 — derive.js is the single
// source of truth for turning answers into fact states.

function factsInFamily(state, fam) {
    return Object.entries(state.facts)
        .filter(([id]) => familyOf(id) === fam)
        .map(([, r]) => r);
}

function trailingFluentRt(state, days) {
    const xs = (state.fluentRtByDay || []).slice(-days).map(d => d.medianRt);
    return median(xs);
}

function groupBy(xs, keyFn) {
    const out = {};
    for (const x of xs) (out[keyFn(x)] ||= []).push(x);
    return out;
}

function daysBetween(a, b) {
    return Math.abs((new Date(b) - new Date(a)) / 86400000);
}

