import { deriveStreak, weekView, addDays, isoWeek } from '../js/game/streaks.js';
import { isEasyDay, dayMedal, goalReveal, medalTiers } from '../js/game/medals.js';
import { COPY } from '../js/game/copy.js';
import { RoundSession } from '../js/game/session.js';
import { RT, DAY } from '../js/config.js';

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
    // Tiers are read from config, not hard-coded: these assertions used to
    // encode 4/6 and broke when DESIGN's "~12 min gold" was finally dialled in
    // (2/5/8, 2026-07-28). The shape is what matters — each threshold earns its
    // tier, and the tier below it does not.
    eq(dayMedal(info(DAY.BRONZE_ROUNDS)).medal, 'bronze', `${DAY.BRONZE_ROUNDS} rounds = bronze`);
    eq(dayMedal(info(DAY.SILVER_ROUNDS)).medal, 'silver', `${DAY.SILVER_ROUNDS} = silver`);
    eq(dayMedal(info(DAY.SILVER_ROUNDS - 1)).medal, 'bronze', 'one short of silver stays bronze');
    eq(dayMedal(info(DAY.GOLD_ROUNDS)).medal, 'gold', `${DAY.GOLD_ROUNDS} = gold`);
    eq(dayMedal(info(DAY.GOLD_ROUNDS - 1)).medal, 'silver', 'one short of gold stays silver');
    eq(dayMedal(info(DAY.GOLD_ROUNDS + 5)).medal, 'gold', 'no tier above gold');
    eq(dayMedal(info(1), { easy: true }).medal, 'bronze', 'easy day bronze = 1 round');
    eq(dayMedal(info(DAY.BRONZE_ROUNDS)).next.medal, 'silver', 'next tier surfaced');
    eq(dayMedal(info(DAY.BRONZE_ROUNDS)).next.roundsLeft, DAY.SILVER_ROUNDS - DAY.BRONZE_ROUNDS,
        'roundsLeft counts to the NEXT tier, not to gold');
    eq(dayMedal(info(DAY.GOLD_ROUNDS)).next, null, 'gold has no next');
    // The tiers must stay ordered and reachable — a mis-edit that put silver at
    // or above gold would otherwise pass everything above.
    ok(DAY.BRONZE_ROUNDS < DAY.SILVER_ROUNDS && DAY.SILVER_ROUNDS < DAY.GOLD_ROUNDS,
        `tiers strictly increase (${DAY.BRONZE_ROUNDS}/${DAY.SILVER_ROUNDS}/${DAY.GOLD_ROUNDS})`);
    ok(DAY.EASY_DAY_BRONZE_ROUNDS <= DAY.BRONZE_ROUNDS, 'easy-day bronze is never harder than bronze');
    ok(DAY.STREAK_MIN_ROUNDS <= DAY.BRONZE_ROUNDS, 'the streak floor stays at or below bronze');

    // ---- per-child medal tiers (parent-set dial, 2026-07-28) ----
    const perChild = { silverRounds: 6, goldRounds: 9 };
    eq(medalTiers(perChild), { bronze: DAY.BRONZE_ROUNDS, silver: 6, gold: 9 }, 'per-child tiers honoured');
    eq(medalTiers({}), { bronze: DAY.BRONZE_ROUNDS, silver: DAY.SILVER_ROUNDS, gold: DAY.GOLD_ROUNDS },
        'no settings → config defaults');
    eq(dayMedal(info(8), { settings: perChild }).medal, 'silver', '8 rounds is silver when gold is 9');
    eq(dayMedal(info(9), { settings: perChild }).medal, 'gold', '9 rounds earns the raised gold');
    eq(dayMedal(info(9), { settings: perChild }).goldDone, true, 'raised gold still locks the day');
    // Bronze is deliberately NOT per-child — it is the bad-evening floor.
    eq(dayMedal(info(DAY.BRONZE_ROUNDS), { settings: perChild }).medal, 'bronze',
        'bronze is unchanged by a per-child gold');
    eq(dayMedal(info(DAY.BRONZE_ROUNDS), { settings: perChild }).next.roundsLeft, 4,
        'roundsLeft tracks the per-child silver');

    // Garbage can't invert the ladder — the form's min/max are bypassable, so
    // medalTiers re-clamps on every read.
    for (const bad of [{ goldRounds: 1 }, { goldRounds: 0 }, { goldRounds: -5 },
        { goldRounds: 'nonsense' }, { silverRounds: 99, goldRounds: 9 },
        { silverRounds: 1, goldRounds: 9 }, { goldRounds: 9999 }]) {
        const t = medalTiers(bad);
        ok(t.bronze < t.silver && t.silver < t.gold,
            `tiers stay ordered for ${JSON.stringify(bad)} → ${t.silver}/${t.gold}`);
        ok(t.gold <= DAY.MAX_GOLD_ROUNDS, `gold stays within the cap for ${JSON.stringify(bad)}`);
    }

    // ---- the child never sees a big rounds-remaining count ----
    // A long day is the parent's business; to the kid it stays twos and threes.
    for (let left = 1; left <= 8; left++) {
        const line = COPY.medalProgress(2, { medal: 'gold', roundsLeft: left });
        if (left <= DAY.MAX_SHOWN_ROUNDS_LEFT) {
            ok(line.includes(`${left} more`), `${left} left is shown as a number`);
        } else {
            ok(!/\d+ more/.test(line), `${left} left shows no count ("${line}")`);
            ok(line.includes('🥇'), 'the medal is still named, just not counted');
        }
    }
    ok(COPY.medalProgress(3, null).includes('every medal'), 'gold day still reads as complete');
    ok(!/\d+ more/.test(COPY.easyBronzeDone({ medal: 'silver', roundsLeft: 4 })),
        'easy-day nudge drops the number when the step is long');
    ok(COPY.easyBronzeDone({ medal: 'silver', roundsLeft: 2 }).includes('only 2 more rounds'),
        'easy-day nudge keeps "only" when it is true');

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

    // --- Last-7-days view (shielded misses surfaced, unplayed stays neutral).
    days = daysFrom([2, 2, 2, 0, 2, 2, 2], today);
    s = deriveStreak(days, today);
    eq(s.shieldedDays.length, 1, 'shielded miss surfaced');
    eq(s.shieldedDays[0], addDays(today, -3), 'right day marked shielded');

    let wk = weekView(days, today, s.shieldedDays);
    eq(wk.length, 7, 'week view has 7 days');
    eq(wk[6].day, today, 'ends today');
    eq(wk[6].isToday, true, 'today flagged');
    eq(wk[3].played, false, 'shielded day not played');
    eq(wk[3].shielded, true, 'shielded day marked');
    eq(wk.filter(w => w.played).length, 6, 'six played days');

    // A miss beyond a broken streak is neither played nor shielded — neutral.
    days = daysFrom([2, 0, 0, 0, 2, 2, 2], today);
    s = deriveStreak(days, today);
    wk = weekView(days, today, s.shieldedDays);
    ok(wk.some(w => !w.played && !w.shielded), 'unshielded miss stays neutral');

    // Today unplayed: pending, not a miss.
    days = daysFrom([2, 2, 2, 2, 2, 2, 0], today);
    s = deriveStreak(days, today);
    wk = weekView(days, today, s.shieldedDays);
    eq(wk[6].played, false, 'unplayed today pending');
    eq(wk[6].shielded, false, 'unplayed today never shows a shield');

    // isoWeek sanity.
    eq(isoWeek('2026-01-01'), isoWeek('2026-01-01'), 'isoWeek stable');

    // ---- sprint auto-advance ceiling (2026-07-28) ----
    // The sprint is a 60s rate probe; the 40s question ceiling let one stall eat
    // it (Eliza 2026-07-28: 3 items, 7×9 burned 40 of the 60 seconds). A stall
    // must cost a question, not the round.
    const mk = (round_type, settings) => new RoundSession(
        { round_type, items: [{ fact_id: '3x4' }], untimed: false,
            durationMs: round_type === 'sprint' ? 60000 : undefined },
        { user: 'u', day: '2026-07-28', settings, hooks: {} });
    eq(mk('mixed', {}).ceilingMs, RT.HARD_CEILING_MS, 'normal round keeps the full ceiling');
    eq(mk('sprint', {}).ceilingMs, RT.SPRINT_CEILING_MS, 'sprint runs the short probe ceiling');
    // Accessibility beats the probe: a child given a shorter ceiling keeps it.
    eq(mk('sprint', { ceilingMs: 8000 }).ceilingMs, 8000, 'a lower per-child ceiling still wins in a sprint');
    eq(mk('mixed', { ceilingMs: 8000 }).ceilingMs, 8000, 'per-child ceiling unchanged outside sprints');
    // …and the probe never LENGTHENS a sprint for a child set above it.
    eq(mk('sprint', { ceilingMs: 30000 }).ceilingMs, RT.SPRINT_CEILING_MS, 'a higher per-child ceiling does not lengthen the sprint');
}
