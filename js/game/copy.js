/**
 * Every child-facing string lives here so the tone rules are enforced in one
 * place (docs/DESIGN.md §1): matter-of-fact, no gushing, no fake praise,
 * correction is information, lock-framing never completion-framing.
 */
import { parseFact } from '../engine/facts.js';
import { DAY } from '../config.js';

export const COPY = {
    whosPlaying: "Who's playing?",
    pinPrompt: name => `Hi ${name} — your PIN`,
    pwPrompt: name => `Hi ${name} — your password`,
    pinWrong: 'Not quite — try again',

    todayTitle: 'Today',
    goalReveal: n => `🥉 Bronze today = ${n} round${n === 1 ? '' : 's'}`,
    goalWhy: {
        focusTable: t => `Today has ${t}s practice — they're next on your list`,
        focusFamily: f => `Today: cracking ${f}`,
        review: t => `Plus a quick visit to your ${t}s`,
        process: n => `Just ${n} round${n === 1 ? '' : 's'} today`,
    },
    microProof: n => n > 0 ? `You did ${n} rounds in a day recently — this is well in reach` : '',
    bounceBack: 'Good to see you back — your streak is safe if you play today',

    roundNames: { review: 'Warm-up', focus: 'Challenge', mixed: 'Mix it up', sprint: 'Sprint!', placement: 'Explorer', free: 'Free play' },

    secondChance: '2nd chance',

    correction: (factId) => {
        const { a, op, b, answer } = parseFact(factId);
        const sym = { mul: '×', add: '+', sub: '−' }[op];
        return `${a} ${sym} ${b} = ${answer}`;
    },
    requeueNote: "it'll come round again in a minute",

    // End of round — celebration scales HONESTLY with the result (a perfect
    // round earns fanfare; a rough one gets straight talk, never confetti).
    endHeadline: (score, total) => {
        const r = score / total;
        if (r === 1) return { emoji: '🎯', line: 'Perfect round!' };
        if (r >= 0.8) return { emoji: '💪', line: 'Strong round' };
        if (r >= 0.6) return { emoji: '👍', line: 'Good going' };
        return { emoji: '', line: '' }; // badRound copy carries the honest version
    },
    secondChanceFixed: n =>
        `${n === 1 ? '1 fixed' : n + ' fixed'} on the 2nd chance ✅`,
    // The child never sees a big rounds-remaining number. Per-child gold can now
    // be 9+ (parent-set), and "7 more for 🥇" reads as a chore list to a
    // ten-year-old — the opposite of the light, game-like tone §1 requires. Past
    // MAX_SHOWN_ROUNDS_LEFT the digit is dropped and the medal is framed as
    // on its way, so the count the child actually reads stays in twos and
    // threes however long the parent has made the day.
    medalProgress: (rounds, next) => {
        const done = `${rounds} round${rounds === 1 ? '' : 's'} today`;
        if (!next) return `🥇🥈🥉 every medal earned today`;
        const icon = { bronze: '🥉', silver: '🥈', gold: '🥇' }[next.medal];
        return next.roundsLeft <= DAY.MAX_SHOWN_ROUNDS_LEFT
            ? `${done} — ${next.roundsLeft} more for ${icon}`
            : `${done} — ${icon} on its way`;
    },
    personalBest: (theme, delta) => `New personal best on the ${theme} — ${delta} faster than last week`,
    badRound: (hardThing) =>
        `That was a tough set — ${hardThing} are the hard ones, and you stuck with the whole round. They'll show up again tomorrow.`,
    goodRound: (score, total) => `${score} out of ${total}`,

    breakPrompt: 'Nice run. Rounds count more with a gap — come back after school or tea and they\'ll be waiting.',
    stopLock: "Gold! Today's medals are full — tomorrow's rounds unlock in the morning.",
    stopPreview: t => `Tomorrow: ${t}`,
    victoryLap: 'One quick favourite-round before you go?',

    streakDay: n => `Day ${n}`,
    // Last-7-days strip. Unplayed days stay neutral (never "missed"/failure);
    // a shield is framed externally — the app protected the streak.
    dayLetters: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], // indexed by Date.getDay()
    weekPlayed: 'played',
    weekShielded: 'shield kept your streak safe',
    weekToday: 'today',
    streakMilestone: n => `${n} days — that's a real habit`,
    streakSafe: 'The app paused your streak — it\'s safe, play today to keep it going',

    // Anti-licensing nudge on an easy day (bronze = 1 round, so a child can hit
    // it and stop). "only" is the whole mechanism — and it has to be TRUE.
    // With gold at 8, silver is 5, so after the easy-day bronze this said
    // "silver is only 4 more rounds", overselling a 4× jump on the day the
    // child was told to take it easy. Keep "only" where the step really is
    // short; state it plainly otherwise. Tone rule: no fake framing (DESIGN §1).
    easyBronzeDone: next => {
        const r = next.roundsLeft;
        return r <= 2
            ? `Bronze done early — ${next.medal} is only ${r} more round${r === 1 ? '' : 's'}`
            : `Bronze done early — ${next.medal} is there if you fancy it`;
    },

};
