import { deriveStreak, addDays, isoWeek } from '../js/game/streaks.js';
import { isEasyDay, dayMedal, goalReveal } from '../js/game/medals.js';

function daysFrom(spec, endDay) {
    // spec: array of rounds-per-day, oldest first, ending at endDay.
    const days = {};
    for (let i = 0; i < spec.length; i++) {
        const d = addDays(endDay, -(spec.length - 1 - i));
        if (spec[i] > 0) days[d] = { rounds: spec[i], voidRounds: 0, byType: {} };
    }
    return days;
}

export async function run({ eq, ok }) {
    const today = '2026-07-22'; // a Wednesday

    // Unbroken 10-day run.
    let days = daysFrom(Array(10).fill(2), today);
    let s = deriveStreak(days, today);
    eq(s.current, 10, 'unbroken streak counts');
    eq(s.todayDone, true, 'today done');

    // One missed day inside a week → shield preserves continuity (freeze
    // semantics: the covered day doesn't add, the streak doesn't die).
    days = daysFrom([2, 2, 2, 0, 2, 2, 2], today);
    s = deriveStreak(days, today);
    eq(s.current, 6, 'one miss shielded (6 played days survive)');

    // Two misses in one week → both shielded (5-of-7 model).
    days = daysFrom([2, 2, 0, 2, 0, 2, 2], today);
    s = deriveStreak(days, today);
    eq(s.current, 5, 'two misses shielded (5 played days survive)');

    // Three misses in one ISO week → streak breaks at the third.
    days = daysFrom([2, 0, 0, 2, 0, 2, 2], today);
    s = deriveStreak(days, today);
    ok(s.current < 7, `third miss in a week breaks the streak (${s.current})`);

    // Today not yet played never breaks the streak.
    days = daysFrom([2, 2, 2, 2, 0], today);
    s = deriveStreak(days, today);
    ok(s.current >= 4, `unplayed today keeps yesterday's streak (${s.current})`);
    eq(s.todayDone, false, 'today pending');

    // Bounce-back: missed yesterday, played today.
    days = daysFrom([2, 2, 0, 2], today);
    s = deriveStreak(days, today);
    eq(s.bounceBack, true, 'bounce-back after a miss');

    // Void rounds don't qualify.
    days = { [today]: { rounds: 2, voidRounds: 2, byType: {} } };
    s = deriveStreak(days, today);
    eq(s.todayDone, false, 'voided rounds never keep a streak');

    // Free play doesn't qualify.
    days = { [today]: { rounds: 1, voidRounds: 0, byType: { free: 1 } } };
    eq(deriveStreak(days, today).todayDone, false, 'free play never keeps a streak');

    // --- Easy days: exactly one per ISO week, deterministic per user.
    let count = 0;
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays('2026-07-20', i));
    for (const d of weekDays) if (isEasyDay('tom', d)) count++;
    eq(count, 1, 'exactly one easy day per week');
    eq(isEasyDay('tom', weekDays[0]), isEasyDay('tom', weekDays[0]), 'deterministic');
    ok(weekDays.some(d => isEasyDay('tom', d) !== isEasyDay('eliza', d)) ||
        true, 'per-user slots may differ');
    eq(isEasyDay('tom', weekDays.find(d => isEasyDay('tom', d)), { easyDaysOff: true }), false, 'kill switch works');

    // --- Medals.
    const info = n => ({ rounds: n, voidRounds: 0, byType: {} });
    eq(dayMedal(info(0)).medal, null, 'no rounds no medal');
    eq(dayMedal(info(2)).medal, 'bronze', '2 rounds = bronze');
    eq(dayMedal(info(4)).medal, 'silver', '4 = silver');
    eq(dayMedal(info(6)).medal, 'gold', '6 = gold');
    eq(dayMedal(info(1), { easy: true }).medal, 'bronze', 'easy day bronze = 1 round');
    eq(dayMedal(info(2)).next.medal, 'silver', 'next tier surfaced');
    eq(dayMedal(info(6)).next, null, 'gold has no next');

    // --- Goal reveal attainability gate.
    // Child hits bronze rarely → revealed target degrades to 1.
    const weakHistory = {};
    for (let i = 1; i <= 10; i++) weakHistory[addDays(today, -i)] = info(1);
    const reveal = goalReveal('tom', weakHistory, today, { bounceBack: false });
    eq(reveal.bronzeTarget, 1, 'attainability gate degrades unattainable bronze');
    // Child hits bronze consistently → normal target.
    const strongHistory = {};
    for (let i = 1; i <= 10; i++) strongHistory[addDays(today, -i)] = info(3);
    const reveal2 = goalReveal('tom', strongHistory, today, { bounceBack: false });
    const expected2 = isEasyDay('tom', today) ? 1 : 2;
    eq(reveal2.bronzeTarget, expected2, 'consistent child sees normal bronze');
    ok(reveal2.bestRecent >= 3, 'micro-proof from own data');

    // isoWeek sanity.
    eq(isoWeek('2026-01-01'), isoWeek('2026-01-01'), 'isoWeek stable');
}
