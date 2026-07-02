/**
 * Round session: drives one round's question queue with timing capture,
 * modeling, immediate correction, and requeue-on-miss. UI-agnostic — the
 * round screen supplies hooks; this module owns the logic so it stays
 * testable and consistent (docs/DESIGN.md §1 "In-round feedback").
 */
import { RT, SCHEDULER } from '../config.js';
import { parseFact, factCue, familyOf } from '../engine/facts.js';
import { makeId } from '../data/db.js';
import { COPY } from './copy.js';

export class RoundSession {
    /**
     * @param {object} plan  round plan from the scheduler
     * @param {object} opts  { user, day, factAccuracy: (factId) => number,
     *                         hooks: { showModel, showQuestion, showCorrect,
     *                                  showWrong, done }, now?: () => ms }
     */
    constructor(plan, opts) {
        this.plan = plan;
        this.user = opts.user;
        this.day = opts.day;
        this.factAccuracy = opts.factAccuracy || (() => 1);
        this.hooks = opts.hooks;
        this.roundId = `${opts.day}-${plan.round_type}-${makeId()}`;
        this.queue = plan.items.map(i => ({ ...i }));
        this.requeued = new Set();
        this.answers = [];
        this.startedAt = Date.now();
        this.deadlineTimer = null;
        this.sprintEndsAt = plan.durationMs ? performance.now() + plan.durationMs : null;
    }

    async start() {
        await this.next();
    }

    async next() {
        if (this.sprintEndsAt && performance.now() >= this.sprintEndsAt) return this.finish();
        if (!this.queue.length) {
            if (this.sprintEndsAt) {
                // Sprint cycles its item pool until time runs out.
                this.queue = this.plan.items.map(i => ({ ...i, model: false }));
            } else {
                return this.finish();
            }
        }
        const item = this.queue.shift();
        this.current = item;
        const fact = parseFact(item.fact_id);

        if (item.model) {
            await this.hooks.showModel(item.fact_id, COPY.correction(item.fact_id));
        }
        this.renderAt = performance.now();
        this.armDeadline();
        this.hooks.showQuestion(item.fact_id, fact, {
            index: this.answers.filter(a => !a.requeued).length,
            total: this.plan.items.length,
            untimed: this.plan.untimed,
        });
    }

    armDeadline() {
        clearTimeout(this.deadlineTimer);
        this.deadlineTimer = setTimeout(() => this.timeout(), RT.HARD_CEILING_MS);
    }

    /** Called by the round screen when the keypad submits. */
    async submit(entry) {
        // Guard against input landing before a question is on screen
        // (e.g. during a model reveal) — never record NaN timings.
        if (this.renderAt === undefined || !this.current) return;
        clearTimeout(this.deadlineTimer);
        const item = this.current;
        const fact = parseFact(item.fact_id);
        const given = Number(entry.value);
        const correct = given === fact.answer;
        this.record(item, {
            given, correct,
            initiation_ms: Math.round(entry.firstInputAt - this.renderAt),
            typing_ms: Math.round(entry.submitAt - entry.firstInputAt),
            input: entry.input, timeout: false,
        });

        if (correct) {
            await this.hooks.showCorrect(item.fact_id, { requeued: !!item.requeued });
        } else {
            // Immediate neutral correction; ≤8-word cue only for facts still
            // below the untimed accuracy gate; requeue once.
            const cue = this.factAccuracy(item.fact_id) < SCHEDULER.UNTIMED_UNTIL_ACCURACY
                ? factCue(item.fact_id) : null;
            await this.hooks.showWrong(item.fact_id, COPY.correction(item.fact_id), cue,
                { requeued: !!item.requeued });
            this.requeue(item);
        }
        await this.next();
    }

    async timeout() {
        const item = this.current;
        this.record(item, {
            given: null, correct: false,
            initiation_ms: RT.HARD_CEILING_MS, typing_ms: 0,
            input: 'none', timeout: true,
        });
        await this.hooks.showWrong(item.fact_id, COPY.correction(item.fact_id), null,
            { requeued: !!item.requeued });
        this.requeue(item);
        await this.next();
    }

    requeue(item) {
        if (this.requeued.has(item.fact_id) || this.sprintEndsAt) return;
        this.requeued.add(item.fact_id);
        this.queue.push({ fact_id: item.fact_id, model: false, requeued: true });
    }

    record(item, result) {
        this.answers.push({
            id: makeId(),
            user: this.user,
            day: this.day,
            ts: Date.now(),
            round_id: this.roundId,
            round_type: this.plan.round_type,
            fact_id: item.fact_id,
            requeued: !!item.requeued,
            ...result,
        });
    }

    finish() {
        clearTimeout(this.deadlineTimer);
        const scored = this.answers.filter(a => !a.requeued);
        const missed = countMisses(this.answers);
        return this.hooks.done({
            answers: this.answers,
            score: scored.filter(a => a.correct).length,
            total: this.plan.round_type === 'sprint' ? scored.length : this.plan.items.length,
            elapsedMs: Date.now() - this.startedAt,
            factsToWatch: missed.slice(0, 2),
            hardTheme: missed.length ? familyOrTable(missed[0]) : null,
        });
    }
}

function countMisses(answers) {
    const misses = {};
    for (const a of answers) if (!a.correct) misses[a.fact_id] = (misses[a.fact_id] || 0) + 1;
    return Object.entries(misses).sort(([, x], [, y]) => y - x).map(([id]) => id);
}

function familyOrTable(factId) {
    const { op, a, b } = parseFact(factId);
    return op === 'mul' ? `${Math.max(a, b)}s` : familyOf(factId).replace(/-/g, ' ');
}
