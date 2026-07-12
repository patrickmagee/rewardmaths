/**
 * Streak derivation (docs/DESIGN.md §1 "Streaks"). Pure: computed from the
 * derived per-day summary, never stored — so it converges across devices.
 *
 * Rules: streak survives on any 1 valid round/day; 2 auto-shields per ISO
 * week cover missed days (the 5-of-7 model); 48h repair (a double session
 * after a full break restores); bounce-back flag the day after a miss.
 */
import { DAY } from '../config.js';

/** A day qualifies if it has ≥1 non-void round (free play excluded upstream). */
export function dayQualifies(dayInfo) {
    if (!dayInfo) return false;
    const valid = (dayInfo.rounds || 0) - (dayInfo.voidRounds || 0) -
        (dayInfo.byType?.free || 0);
    return valid >= DAY.STREAK_MIN_ROUNDS;
}

/**
 * @param {object} days   { 'yyyy-mm-dd': dayInfo } from deriveState
 * @param {string} today
 * @returns {{ current, best, todayDone, shieldsUsedThisWeek, bounceBack,
 *             repairAvailable, milestoneToday }}
 */
export function deriveStreak(days, today) {
    const qualifies = d => dayQualifies(days[d]);
    const shieldsUsed = {}; // isoWeek -> count
    const shieldedDays = []; // misses inside the current streak a shield covered

    // Walk backward from today (today itself only counts if played).
    let current = 0;
    let cursor = today;
    const todayDone = qualifies(today);
    if (todayDone) current = 1;
    cursor = addDays(cursor, -1);

    while (true) {
        if (qualifies(cursor)) {
            current++;
        } else {
            const wk = isoWeek(cursor);
            shieldsUsed[wk] = (shieldsUsed[wk] || 0);
            if (shieldsUsed[wk] < DAY.SHIELDS_PER_WEEK && anyPlayBefore(days, cursor)) {
                shieldsUsed[wk]++; // shield silently covers the miss
                shieldedDays.push(cursor);
            } else {
                break;
            }
        }
        cursor = addDays(cursor, -1);
        if (current > 3660) break; // safety
    }

    // Best-ever streak: same walk over every historical run.
    const best = Math.max(current, bestEver(days));

    // Bounce-back: yesterday was a miss (shielded or not) and today qualifies.
    const bounceBack = todayDone && !qualifies(addDays(today, -1)) && anyPlayBefore(days, addDays(today, -1));

    // Repair: streak fully broke within the last 48h and a double session
    // today would restore it.
    const yesterday = addDays(today, -1);
    const dayBefore = addDays(today, -2);
    const repairAvailable = !todayDone && current === 0 &&
        (qualifies(dayBefore) || qualifies(addDays(today, -3))) && !qualifies(yesterday);

    const milestoneToday = DAY.MILESTONES.includes(current) && todayDone ? current : null;

    return {
        current, best, todayDone, bounceBack, repairAvailable, milestoneToday,
        shieldedDays,
        shieldsUsedThisWeek: shieldsUsed[isoWeek(today)] || 0,
    };
}

/**
 * Last-7-days view for the Today screen, oldest first, ending today.
 * Unplayed days are just "not played" — never failure (DESIGN §1: breaks are
 * framed externally); shield-covered misses are marked so the child can see
 * the app kept the streak safe.
 */
export function weekView(days, today, shieldedDays = []) {
    const shielded = new Set(shieldedDays);
    return Array.from({ length: 7 }, (_, i) => {
        const day = addDays(today, i - 6);
        return {
            day,
            dow: new Date(day + 'T12:00:00').getDay(),
            played: dayQualifies(days[day]),
            shielded: shielded.has(day),
            isToday: day === today,
        };
    });
}

function bestEver(days) {
    const played = Object.keys(days).filter(d => dayQualifies(days[d])).sort();
    if (!played.length) return 0;
    let best = 0;
    // Run the same shielded walk ending at each played day (cheap at n≈365).
    for (const end of played) {
        let run = 1, cursor = addDays(end, -1);
        const used = {};
        while (true) {
            if (dayQualifies(days[cursor])) run++;
            else {
                const wk = isoWeek(cursor);
                used[wk] = used[wk] || 0;
                if (used[wk] < DAY.SHIELDS_PER_WEEK && Object.keys(days).some(d => d < cursor && dayQualifies(days[d]))) used[wk]++;
                else break;
            }
            cursor = addDays(cursor, -1);
            if (run > 3660) break;
        }
        best = Math.max(best, run);
    }
    return best;
}

function anyPlayBefore(days, day) {
    return Object.keys(days).some(d => d <= day && dayQualifies(days[d]));
}

export function addDays(dayStr, n) {
    const d = new Date(dayStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    const p = x => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isoWeek(dayStr) {
    const d = new Date(dayStr + 'T12:00:00');
    const t = new Date(d);
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    const firstThu = new Date(t.getFullYear(), 0, 4);
    firstThu.setDate(firstThu.getDate() + 3 - ((firstThu.getDay() + 6) % 7));
    const week = 1 + Math.round((t - firstThu) / (7 * 86400000));
    return `${t.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
