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

/** Comparability class for baselining: tables against tables, ladder against
 *  ladder. Multiplication and the add/sub ladder are learned on different
 *  timetables, so pooling them would let a hard table hide behind easy sums. */
function themeKind(fact_id) {
    return parseFact(fact_id).op === 'mul' ? 'mul' : 'addsub';
}

/** Fact states that mean "measured, and the child is not getting it". */
const WEAK_STATES = new Set(['UNKNOWN', 'STUCK']);

/**
 * Normalise the factStates argument. Callers pass the full per-fact records
 * ({ state, attempts: [{day,…}], … }); a bare { [factId]: state } map is still
 * accepted for callers that only have states, and every such fact is then
 * treated as durable (we have no history with which to say otherwise).
 */
function factInfo(v) {
    if (typeof v === 'string') {
        return { state: v, distinctDays: Infinity, spanDays: Infinity, everThreeInRow: false };
    }
    const days = [...new Set((v.attempts || []).map(a => a.day))].sort();
    return {
        state: v.state,
        distinctDays: days.length,
        spanDays: days.length ? daysBetween(days[0], days[days.length - 1]) : 0,
        everThreeInRow: !!v.everThreeInRow,
    };
}

/**
 * Is this fact DURABLY weak — i.e. has the child had a fair run at it over
 * time and still not got it?
 *
 * Built on calendar time only. Attempt COUNT is deliberately excluded: it is
 * allocated by the scheduler, and allocated against exactly the themes this
 * layer exists to catch (a weak theme's facts carry ~4 attempts to a healthy
 * theme's ~10), so any volume gate re-imports the exposure coupling this whole
 * criterion was rewritten to escape. Distinct days and calendar span are not
 * allocable: a fact cannot be made older by serving it more.
 *
 * Both terms are needed. Distinct days alone passes a table introduced three
 * days ago and drilled hard; span alone passes a fact touched once in the
 * placement sweep and once a month later.
 */
function isDurablyWeak(f) {
    return WEAK_STATES.has(f.state) &&
        f.distinctDays >= FLAGS.MIN_DAYS &&
        f.spanDays >= FLAGS.DURABLE_MIN_SPAN_DAYS;
}

/**
 * Evaluate flag states for all themes.
 *
 * Escalation is STRUCTURAL-primary (2026-07-20, DESIGN §3): the per-fact state
 * distribution decides whether a theme is weak, and the trailing window only
 * corroborates that it is still live. Pass full fact records — the durability
 * test reads each fact's attempt DAYS.
 *
 * @param {Array} weekAnswers  classified answers from the trailing ~14 days:
 *        { fact_id, correct, initiation_ms, rt, day, cls, errorTag? }
 * @param {object} prevFlags   { [theme]: {state, since, lastConfirmed, evidence} }
 * @param {object} factStates  { [factId]: factRecord } (or a bare state map)
 * @param {string} today
 * @returns {object} nextFlags (same shape) + each flag carries .emailLine data
 */
export function evaluateFlags(weekAnswers, prevFlags, factStates, today) {
    const usable = weekAnswers.filter(a => a.cls.counts_for_accuracy);
    const overallAcc = accuracy(usable);
    // Speed is judged on INITIATION, exactly as the fact-state machine judges
    // it (DESIGN §2, 2026-07-20). Using total RT here while the classifier used
    // initiation meant the parent-facing flag and the fact map disagreed about
    // what "slow" means, and typing time — which scales with answer digit
    // count — leaked into a theme-level comparison where large-answer themes
    // (the 12s) carry systematically more of it.
    const overallRt = median(usable.filter(a => a.cls.counts_for_rt).map(initOf));

    const byTheme = groupBy(usable, a => themeOf(a.fact_id));
    const next = {};

    // The child's OWN durable-weak share, per kind of theme (times tables
    // compare to times tables, ladder families to ladder families). Every
    // learner has a frontier that is not yet learned; what marks a theme out is
    // being durably weak by more than the child's own working margin.
    const allFacts = Object.entries(factStates)
        .map(([id, v]) => ({ kind: themeKind(id), info: factInfo(v) }));
    const baselineFor = kind => {
        const pool = allFacts.filter(f => f.kind === kind);
        return pool.length ? pool.filter(f => isDurablyWeak(f.info)).length / pool.length : 0;
    };

    for (const [theme, items] of Object.entries(byTheme)) {
        const prev = prevFlags[theme] || { state: 'none' };
        const acc = accuracy(items);
        const rt = median(items.filter(a => a.cls.counts_for_rt).map(initOf));
        const days = new Set(items.map(a => a.day)).size;
        const deficient =
            (overallAcc - acc >= FLAGS.ACCURACY_DEFICIT) ||
            (overallRt > 0 && rt > FLAGS.RT_RATIO * overallRt);

        // Resolution / expiry.
        const themeFacts = Object.entries(factStates)
            .filter(([id]) => themeOf(id) === theme)
            .map(([id, v]) => [id, factInfo(v)]);
        const fluentShare = themeFacts.length
            ? themeFacts.filter(([, f]) => f.state === 'FLUENT').length / themeFacts.length : 0;

        // ---- Primary (structural) signal: the per-fact state distribution.
        // A theme is weak when most of its facts have been failed, repeatedly,
        // over weeks — measured against how much of the child's own comparable
        // material is in that condition at all.
        const durableWeak = themeFacts.filter(([, f]) => isDurablyWeak(f));
        const durableShare = themeFacts.length ? durableWeak.length / themeFacts.length : 0;
        const baseline = baselineFor(themeKind(items[0].fact_id));
        const structural =
            durableWeak.length >= FLAGS.MIN_DURABLE_WEAK_FACTS &&
            durableShare >= FLAGS.WEAK_FACT_SHARE &&
            durableShare - baseline >= FLAGS.WEAK_SHARE_DEFICIT;

        if (prev.state === 'flagged') {
            const age = daysBetween(prev.since, today);
            const confirms = deficient || structural;
            if (fluentShare >= FLAGS.RESOLVED_FLUENT_SHARE && age >= FLAGS.MIN_FLAG_DAYS) {
                next[theme] = { state: 'resolved', since: today, resolvedFrom: prev.since };
            } else if (!confirms && daysBetween(prev.lastConfirmed || prev.since, today) > FLAGS.EXPIRE_DAYS) {
                next[theme] = { state: 'none', expired: today };
            } else {
                next[theme] = { ...prev, lastConfirmed: confirms ? today : prev.lastConfirmed };
            }
            continue;
        }

        // ---- Escalation (2026-07-20, DESIGN §3). Structural signal PRIMARY,
        // trailing window as corroboration — the reverse of the original design.
        //
        // The window can only report what the scheduler served, and the
        // scheduler serves a weak theme less. So the window no longer decides
        // whether there is a problem; it decides only that the problem is still
        // live and is being seen right now (a real deficit, on a real sample,
        // across MIN_DAYS distinct days). Everything about "is this theme
        // actually weak" is answered from durable per-fact evidence, which the
        // scheduler cannot allocate away.
        //
        // The durability gate is also the guard against the opposite error —
        // flagging a table the child met last week. Both halves matter:
        //   · ADMITS a genuinely weak theme the scheduler has starved: six
        //     facts failed across three weeks still reads as six facts failed
        //     across three weeks, however few reps it was given.
        //   · REJECTS a table mid-introduction: its facts are failing, but not
        //     yet on MIN_DAYS days across DURABLE_MIN_SPAN_DAYS, and its share
        //     does not stand out from the child's own frontier.
        if (structural && deficient && items.length >= FLAGS.MIN_ATTEMPTS_WATCHING &&
            days >= FLAGS.MIN_DAYS) {
            next[theme] = {
                state: 'flagged', since: today, lastConfirmed: today,
                evidence: buildEvidence(theme, items, overallAcc, overallRt, acc, rt,
                    { themeFacts: themeFacts.length, durableWeakFacts: durableWeak.length,
                        durableShare, baselineShare: baseline }),
            };
        } else if (deficient && items.length >= FLAGS.MIN_ATTEMPTS_WATCHING) {
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

function initOf(a) {
    return Number.isFinite(a.initiation_ms) ? a.initiation_ms : a.rt;
}

function buildEvidence(theme, items, overallAcc, overallRt, acc, rt, states = {}) {
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
        ...states,
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
