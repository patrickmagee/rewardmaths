/**
 * Derivation: the answer log is the source of truth; ALL adaptive state is a
 * fold over it (docs/REWRITE.md §2). Pure and deterministic — two devices
 * with the same merged log derive byte-identical state, so sync only ever
 * merges logs, never states.
 *
 * Raw answer record (as stored/synced):
 *   { id, user, day, ts, round_id, round_type, fact_id, given, correct,
 *     initiation_ms, typing_ms, input, timeout }
 */
import { classifyAnswer, roundIsVoid } from '../engine/classify.js';
import { newFactRecord, appendAttempt, factState, childCutoff, median } from '../engine/states.js';
import { processDay, newChildState } from '../engine/adapt.js';
import { tagError } from '../engine/flags.js';

/**
 * Fold the full answer log into derived state.
 * @param {Array} answers  raw records, any order (deduped by id upstream)
 * @param {object} opts    { typingBaselines: {tap: ms, key: ms} }
 * @returns {{ state, audit, days, classified }}
 *   state: engine child state · audit: adaptation audit trail ·
 *   days: {[day]: {rounds, voidRounds, byType}} · classified: log + cls tags
 */
export function deriveState(answers, opts = {}) {
    // Canonicalise FIRST: everything downstream (including the typing-baseline
    // estimate) must consume the same deduped, ts-sorted stream, or two
    // devices with the same merged log can derive different states.
    const clean = dedupe(answers).sort((a, b) => a.ts - b.ts || cmp(a.id, b.id));

    // Typing baseline is estimated passively from real play: median typing_ms
    // across correct answers (per input method), so a slow typer's speed
    // cutoffs self-normalise without any explicit calibration game.
    const baselines = opts.typingBaselines || estimateTypingBaselines(clean);
    const state = newChildState(opts);
    const audit = [];
    const days = {};
    const classified = [];

    const byDay = groupBy(clean, a => a.day);
    const dayKeys = Object.keys(byDay).sort();

    for (const day of dayKeys) {
        const dayAnswers = [...byDay[day]].sort((a, b) => a.ts - b.ts || cmp(a.id, b.id));
        const rounds = groupBy(dayAnswers, a => a.round_id);
        const dayInfo = { rounds: 0, voidRounds: 0, byType: {} };
        const processed = [];
        // Off-day rollback point: the verdict only exists after the day is
        // folded, but DESIGN §2 says an off-day writes NOTHING — including
        // per-fact records (a globally bad day would otherwise knock facts
        // out of FLUENT and stall family promotion for weeks).
        const factsBefore = structuredClone(state.facts);

        for (const roundAnswers of Object.values(rounds)) {
            const roundType = roundAnswers[0].round_type;
            // Classify sequentially: each answer sees the fact history as it
            // stood when the answer happened.
            const cls = [];
            for (const a of roundAnswers) {
                const rec = state.facts[a.fact_id] || newFactRecord();
                cls.push(classifyAnswer(a, {
                    medianRt: rec.medianRt,
                    validAttempts: rec.attempts.length,
                    state: rec.state,
                }));
            }
            const isVoid = roundIsVoid(cls);
            dayInfo.rounds++;
            if (isVoid) dayInfo.voidRounds++;
            else dayInfo.byType[roundType] = (dayInfo.byType[roundType] || 0) + 1;
            // byType counts VALID rounds only — the UI's round-card ticks and
            // the medal note must agree (a voided round earns neither).

            roundAnswers.forEach((a, i) => {
                const c = cls[i];
                const correct = c.forced_wrong ? false : a.correct;
                const entry = {
                    ...a, correct, cls: c, void: isVoid,
                    rt: a.initiation_ms + (a.typing_ms || 0),
                    errorTag: correct ? null : tagError(a.fact_id, a.given),
                };
                processed.push(entry);
                classified.push(entry);
                if (!isVoid && a.round_type !== 'free') {
                    const rec = state.facts[a.fact_id] || newFactRecord();
                    state.facts[a.fact_id] = appendAttempt(rec,
                        { correct: a.correct, initiation_ms: a.initiation_ms, typing_ms: a.typing_ms },
                        c, day);
                }
            });
        }

        // Recompute per-fact states with per-operation personal cutoffs.
        recomputeStates(state, baselines);

        // Daily adaptation (EMA, off-day guard, promote/demote).
        const res = processDay(day, processed, state);
        if (res.audit.some(a => a.type === 'off_day')) res.state.facts = factsBefore;
        Object.assign(state, res.state);
        audit.push(...res.audit);
        days[day] = dayInfo;
    }
    return { state, audit, days, classified };
}

/** Recompute all fact states (exported for round-end live updates). */
export function recomputeStates(state, baselines = {}) {
    const typing = typingOf(baselines);
    const cutoffs = {};
    for (const [op, sym] of [['mul', 'x'], ['add', '+'], ['sub', '-']]) {
        const meds = Object.entries(state.facts)
            .filter(([id, r]) => r.state === 'FLUENT' && id.includes(sym))
            .map(([, r]) => r.medianRt).filter(Boolean);
        cutoffs[op] = childCutoff(meds, typing);
    }
    for (const [id, rec] of Object.entries(state.facts)) {
        const op = id.includes('x') ? 'mul' : id.includes('+') ? 'add' : 'sub';
        rec.state = factState(rec, cutoffs[op]);
    }
    return cutoffs;
}

/** Union-merge answer logs from any number of sources; dedupe by id. */
export function mergeAnswers(...logs) {
    return dedupe(logs.flat());
}

function dedupe(answers) {
    const seen = new Map();
    for (const a of answers) if (a && a.id && !seen.has(a.id)) seen.set(a.id, a);
    return [...seen.values()];
}

/** Median typing baseline across input methods (fallback default handled downstream). */
function typingOf(baselines) {
    const xs = Object.values(baselines).filter(Number.isFinite);
    return xs.length ? median(xs) : undefined;
}

/** Passive typing baseline: median typing_ms of recent correct answers, per
 *  input method. Needs a handful of answers; undefined until then.
 *  MUST be fed deduped, ts-sorted answers (slice(-200) is order-sensitive). */
export function estimateTypingBaselines(answers) {
    const byInput = {};
    for (const a of answers) {
        if (a.correct && Number.isFinite(a.typing_ms) && a.typing_ms > 0 && !a.timeout) {
            (byInput[a.input || 'tap'] ||= []).push(a.typing_ms);
        }
    }
    const out = {};
    for (const [input, xs] of Object.entries(byInput)) {
        if (xs.length >= 8) out[input] = median(xs.slice(-200));
    }
    return out;
}

function groupBy(xs, keyFn) {
    const out = {};
    for (const x of xs) (out[keyFn(x)] ||= []).push(x);
    return out;
}

function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
