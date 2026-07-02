/**
 * Struggle flags + error tagging (docs/DESIGN.md §3, docs/research/04 §2).
 * Theme = a times table or an add/sub ladder family, computed bottom-up.
 * Pure functions over the classified answer log + fact states.
 */
import { FLAGS } from '../config.js';
import { parseFact, familyOf, tableOf } from './facts.js';
import { median } from './states.js';

/**
 * Tag a wrong answer with its error type.
 * @returns {'table_confusion'|'counting_slip'|'operation_confusion'|'weak_fact'}
 *          plus { neighbour } for table confusion.
 */
export function tagError(fact_id, givenAnswer) {
    const { a, op, b, answer } = parseFact(fact_id);
    const g = +givenAnswer;
    if (!Number.isFinite(g)) return { type: 'weak_fact' };
    if (op === 'mul') {
        for (const [x, y] of [[a, b], [b, a]]) {
            for (let n = 2; n <= 12; n++) {
                if (n !== y && x * n === g) {
                    return { type: 'table_confusion', neighbour: `${x}x${n}`, offBy: n - y };
                }
            }
        }
        if (g === a + b) return { type: 'operation_confusion' };
        if (Math.abs(g - answer) <= 2) return { type: 'counting_slip' };
        return { type: 'weak_fact' };
    }
    if (Math.abs(g - answer) <= 2) return { type: 'counting_slip' };
    if (op === 'add' && (g === a - b || g === b - a)) return { type: 'operation_confusion' };
    if (op === 'sub' && g === a + b) return { type: 'operation_confusion' };
    if (Math.abs(g - answer) === 10) return { type: 'decade_error' };
    return { type: 'weak_fact' };
}

/** Theme of a fact: table-N for mul, ladder family for add/sub. */
export function themeOf(fact_id) {
    const { op } = parseFact(fact_id);
    return op === 'mul' ? `table-${tableOf(fact_id)}` : familyOf(fact_id);
}

/**
 * Evaluate flag states for all themes.
 * @param {Array} weekAnswers  classified answers from the trailing ~14 days:
 *        { fact_id, correct, rt, day, cls, errorTag? }
 * @param {object} prevFlags   { [theme]: {state, since, lastConfirmed, evidence} }
 * @param {object} factStates  { [factId]: state }
 * @param {string} today
 * @returns {object} nextFlags (same shape) + each flag carries .emailLine data
 */
export function evaluateFlags(weekAnswers, prevFlags, factStates, today) {
    const usable = weekAnswers.filter(a => a.cls.counts_for_accuracy);
    const overallAcc = accuracy(usable);
    const overallRt = median(usable.filter(a => a.cls.counts_for_rt).map(a => a.rt));

    const byTheme = groupBy(usable, a => themeOf(a.fact_id));
    const next = {};

    for (const [theme, items] of Object.entries(byTheme)) {
        const prev = prevFlags[theme] || { state: 'none' };
        const acc = accuracy(items);
        const rt = median(items.filter(a => a.cls.counts_for_rt).map(a => a.rt));
        const days = new Set(items.map(a => a.day)).size;
        const deficient =
            (overallAcc - acc >= FLAGS.ACCURACY_DEFICIT) ||
            (overallRt > 0 && rt > FLAGS.RT_RATIO * overallRt);

        // Resolution / expiry.
        const themeFacts = Object.entries(factStates).filter(([id]) => themeOf(id) === theme);
        const fluentShare = themeFacts.length
            ? themeFacts.filter(([, s]) => s === 'FLUENT').length / themeFacts.length : 0;

        if (prev.state === 'flagged') {
            const age = daysBetween(prev.since, today);
            if (fluentShare >= FLAGS.RESOLVED_FLUENT_SHARE && age >= FLAGS.MIN_FLAG_DAYS) {
                next[theme] = { state: 'resolved', since: today, resolvedFrom: prev.since };
            } else if (!deficient && daysBetween(prev.lastConfirmed || prev.since, today) > FLAGS.EXPIRE_DAYS) {
                next[theme] = { state: 'none', expired: today };
            } else {
                next[theme] = { ...prev, lastConfirmed: deficient ? today : prev.lastConfirmed };
            }
            continue;
        }

        // Escalation.
        if (deficient && items.length >= FLAGS.MIN_ATTEMPTS && days >= FLAGS.MIN_DAYS) {
            next[theme] = {
                state: 'flagged', since: today, lastConfirmed: today,
                evidence: buildEvidence(theme, items, overallAcc, overallRt, acc, rt),
            };
        } else if (deficient && items.length >= 5) {
            next[theme] = { state: 'watching', since: prev.since || today };
        } else {
            next[theme] = { state: 'none' };
        }
    }
    // Carry forward flagged themes with no data this week (don't silently drop).
    for (const [theme, prev] of Object.entries(prevFlags)) {
        if (!next[theme] && prev.state === 'flagged') next[theme] = prev;
    }
    return next;
}

/**
 * Classify a flagged theme for the parent playbook:
 * inaccurate | slow | conceptual.
 */
export function flagType(evidence) {
    if (evidence.dominantError === 'operation_confusion' || evidence.repeatedBug) {
        return 'conceptual';
    }
    if (evidence.accuracy >= 0.85) return 'slow';
    return 'inaccurate';
}

function buildEvidence(theme, items, overallAcc, overallRt, acc, rt) {
    const misses = items.filter(a => !a.correct);
    const worstFacts = topN(countBy(misses, a => a.fact_id), 3);
    const errorCounts = countBy(misses.filter(a => a.errorTag), a => a.errorTag.type);
    const dominantError = topN(errorCounts, 1)[0] || null;
    // Repeated identical wrong answer on the same fact = bug signal.
    const byFactAnswer = countBy(misses.filter(a => a.given !== undefined),
        a => `${a.fact_id}=${a.given}`);
    const repeatedBug = Object.entries(byFactAnswer).find(([, n]) => n >= 2)?.[0] || null;
    return {
        theme,
        attempts: items.length,
        accuracy: acc, overallAccuracy: overallAcc,
        medianRt: rt, overallRt,
        rtRatio: overallRt ? rt / overallRt : null,
        worstFacts, dominantError, repeatedBug,
        days: new Set(items.map(a => a.day)).size,
    };
}

function accuracy(xs) {
    return xs.length ? xs.filter(a => a.correct).length / xs.length : 0;
}

function groupBy(xs, keyFn) {
    const out = {};
    for (const x of xs) (out[keyFn(x)] ||= []).push(x);
    return out;
}

function countBy(xs, keyFn) {
    const out = {};
    for (const x of xs) { const k = keyFn(x); out[k] = (out[k] || 0) + 1; }
    return out;
}

function topN(counts, n) {
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, n).map(([k]) => k);
}

function daysBetween(a, b) {
    return Math.abs((new Date(b) - new Date(a)) / 86400000);
}
