/**
 * Day state: medals, easy days, goal reveal (docs/DESIGN.md §1).
 * Pure and deterministic — easy days derive from a seeded hash of
 * (user, iso-week) so every device agrees without storing anything.
 */
import { DAY } from '../config.js';
import { dayQualifies, addDays, isoWeek } from './streaks.js';

/** Deterministic easy-day: exactly 1 per ISO week, position pseudo-random. */
export function isEasyDay(user, day, settings = {}) {
    if (settings.easyDaysOff) return false;
    const week = isoWeek(day);
    const slot = hash(`${user}|${week}`) % 7;
    const dow = (new Date(day + 'T12:00:00').getDay() + 6) % 7; // Mon=0
    return dow === slot;
}

/** Valid (medal-earning) rounds in a day. */
export function validRounds(dayInfo) {
    if (!dayInfo) return 0;
    return (dayInfo.rounds || 0) - (dayInfo.voidRounds || 0) - (dayInfo.byType?.free || 0);
}

/**
 * @returns {{ medal: null|'bronze'|'silver'|'gold', bronzeTarget, next,
 *             goldDone, rounds }}
 */
export function dayMedal(dayInfo, { easy = false, bounceBack = false } = {}) {
    const rounds = validRounds(dayInfo);
    const bronzeTarget = (easy || bounceBack) ? DAY.EASY_DAY_BRONZE_ROUNDS : DAY.BRONZE_ROUNDS;
    let medal = null;
    if (rounds >= DAY.GOLD_ROUNDS) medal = 'gold';
    else if (rounds >= DAY.SILVER_ROUNDS) medal = 'silver';
    else if (rounds >= bronzeTarget) medal = 'bronze';
    const next = medal === 'gold' ? null
        : medal === 'silver' ? { medal: 'gold', roundsLeft: DAY.GOLD_ROUNDS - rounds }
        : medal === 'bronze' ? { medal: 'silver', roundsLeft: DAY.SILVER_ROUNDS - rounds }
        : { medal: 'bronze', roundsLeft: bronzeTarget - rounds };
    return { medal, bronzeTarget, next, goldDone: medal === 'gold', rounds };
}

/**
 * Goal reveal with attainability gate: only reveal a bronze the child hit on
 * ≥70% of their recent play-days; otherwise degrade to the modest target.
 * @param {object} days   derived day summaries
 */
export function goalReveal(user, days, today, streak, settings = {}) {
    const easy = isEasyDay(user, today, settings);
    const bounceBack = streak.bounceBack ||
        (!dayQualifies(days[addDays(today, -1)]) && anyHistory(days, today));
    let bronzeTarget = (easy || bounceBack) ? DAY.EASY_DAY_BRONZE_ROUNDS : DAY.BRONZE_ROUNDS;

    // Attainability gate over the last 14 played days.
    const recent = Object.keys(days).filter(d => d < today).sort().slice(-14);
    if (recent.length >= 5) {
        const hitRate = recent.filter(d => validRounds(days[d]) >= DAY.BRONZE_ROUNDS).length / recent.length;
        if (hitRate < DAY.REVEAL_ATTAINABILITY && bronzeTarget > DAY.EASY_DAY_BRONZE_ROUNDS) {
            bronzeTarget = DAY.EASY_DAY_BRONZE_ROUNDS;
        }
    }

    // Micro-proof: best recent day, from the child's own data.
    const bestRecent = recent.reduce((m, d) => Math.max(m, validRounds(days[d])), 0);

    return { bronzeTarget, easy, bounceBack, bestRecent };
    // NOTE: the reveal must never disclose `easy` to the child — UI copy uses
    // bronzeTarget only; `easy` is for the parent dashboard log.
}

function anyHistory(days, today) {
    return Object.keys(days).some(d => d < today && dayQualifies(days[d]));
}

function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
}
