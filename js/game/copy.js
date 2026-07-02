/**
 * Every child-facing string lives here so the tone rules are enforced in one
 * place (docs/DESIGN.md §1): matter-of-fact, no gushing, no fake praise,
 * correction is information, lock-framing never completion-framing.
 */
import { parseFact } from '../engine/facts.js';

export const COPY = {
    whosPlaying: "Who's playing?",
    pinPrompt: name => `Hi ${name} — your PIN`,
    pinWrong: 'Not quite — try again',

    todayTitle: 'Today',
    goalReveal: n => `Bronze today = ${n} round${n === 1 ? '' : 's'}`,
    goalWhy: {
        focusTable: t => `Today has ${t}s practice — they're next on your list`,
        focusFamily: f => `Today: cracking ${f}`,
        review: t => `Plus a quick visit to your ${t}s`,
        process: n => `Just ${n} round${n === 1 ? '' : 's'} today`,
    },
    microProof: n => n > 0 ? `You did ${n} rounds in a day recently — this is well in reach` : '',
    bounceBack: 'Good to see you back — your streak is safe if you play today',

    roundNames: { review: 'Warm-up', focus: 'Challenge', mixed: 'Mix it up', sprint: 'Sprint!', placement: 'Explorer', free: 'Free play' },

    correction: (factId) => {
        const { a, op, b, answer } = parseFact(factId);
        const sym = { mul: '×', add: '+', sub: '−' }[op];
        return `${a} ${sym} ${b} = ${answer}`;
    },
    requeueNote: "it'll come round again in a minute",

    // End of round — score line is plain; enthusiasm only for verified improvement.
    medalProgress: (rounds, next) => next
        ? `${rounds} round${rounds === 1 ? '' : 's'} today — ${next.roundsLeft} more for ${next.medal}`
        : `Gold — every medal earned today`,
    personalBest: (theme, delta) => `New personal best on the ${theme} — ${delta} faster than last week`,
    factsToWatch: '2 to watch',
    badRound: (hardThing) =>
        `That was a tough set — ${hardThing} are the hard ones, and you stuck with the whole round. They'll show up again tomorrow.`,
    goodRound: (score, total) => `${score} out of ${total}`,

    breakPrompt: 'Nice run. Rounds count more with a gap — come back after school or tea and they\'ll be waiting.',
    stopLock: "Gold! Today's medals are full — tomorrow's rounds unlock in the morning.",
    stopPreview: t => `Tomorrow: ${t}`,
    victoryLap: 'One quick favourite-round before you go?',

    streakDay: n => `Day ${n}`,
    streakMilestone: n => `${n} days — that's a real habit`,
    streakSafe: 'The app paused your streak — it\'s safe, play today to keep it going',

    easyBronzeDone: next =>
        `Bronze done early — ${next.medal} is only ${next.roundsLeft} more round${next.roundsLeft === 1 ? '' : 's'}`,

    freePlayUnlock: 'Free play ▸',
};
