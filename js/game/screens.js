/**
 * Child-app screens. Each render function owns #app's content; navigation is
 * driven by main.js. All strings come from copy.js (tone rules in one place).
 */
import { COPY } from './copy.js';
import { Keypad } from './keypad.js';
import { RoundSession } from './session.js';
import { parseFact } from '../engine/facts.js';
import { DAY } from '../config.js';

const app = () => document.getElementById('app');

const AVATARS = ['🦖', '🎨', '🚀', '⚽', '🐙', '🎸', '🦊', '🛹'];

const BACK_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>`;

export function renderWho(profiles, { onPick, onParent }) {
    // The kids get big avatar cards; the test account is a quiet corner link.
    const kids = profiles.filter(p => p.role !== 'admin' && p.user !== 'test');
    const test = profiles.find(p => p.user === 'test');
    app().innerHTML = `
        <div class="screen who">
            <h1>${COPY.whosPlaying}</h1>
            <div class="who-grid">
                ${kids.map(p => `
                    <button class="who-card" data-user="${p.user}">
                        <span class="who-avatar">${p.avatar || AVATARS[0]}</span>
                        <span class="who-name">${p.name}</span>
                    </button>`).join('')}
            </div>
            ${test ? `<button class="link test-link" data-user="test">test 🧪</button>` : ''}
            <button class="link parent-link">parent area 🔒</button>
        </div>`;
    app().querySelectorAll('.who-card, .test-link').forEach(b =>
        b.addEventListener('click', () => onPick(b.dataset.user)));
    app().querySelector('.parent-link').addEventListener('click', onParent);
}

export function renderPin(profile, { onOk, onBack }) {
    app().innerHTML = `
        <div class="screen pin">
            <button class="icon-btn back" aria-label="back">${BACK_ICON}</button>
            <div class="pin-avatar">${profile.avatar}</div>
            <h2>${COPY.pinPrompt(profile.name)}</h2>
            <div class="pin-dots"></div>
            <div class="pin-msg"></div>
            <div class="keypad-host"></div>
        </div>`;
    const dots = app().querySelector('.pin-dots');
    const msg = app().querySelector('.pin-msg');
    const pad = new Keypad(app().querySelector('.keypad-host'), {
        maxLen: 4,
        onSubmit: async (entry) => {
            const ok = await onOk(entry.value);
            if (!ok) {
                msg.textContent = COPY.pinWrong;
                dots.textContent = '';
            }
        },
    });
    const origPress = pad.press.bind(pad);
    pad.press = (k, m) => { origPress(k, m); dots.textContent = '●'.repeat(pad.value.length); };
    app().querySelector('.back').addEventListener('click', () => { pad.destroy(); onBack(); });
    return pad;
}

/**
 * Today screen: streak, goal reveal, round cards, medal ladder, free play.
 * ctx: { profile, streak, medal, reveal, roundsPlan, playedTypes, whyLine,
 *        goldLocked, tomorrowHint, freePlayOpen, onRound, onFree, onLogout }
 */
export function renderToday(ctx) {
    const { profile, streak, medal, reveal } = ctx;
    const flame = streak.current > 0 ? `🔥 ${COPY.streakDay(streak.current)}` : '🔥 Day 1 starts today';
    const medals = ['bronze', 'silver', 'gold'];
    const medalIdx = medal.medal ? medals.indexOf(medal.medal) : -1;

    app().innerHTML = `
        <div class="screen today" data-accent="${profile.settings?.accent || 'a'}">
            <header class="today-head">
                <span class="streak">${flame}</span>
                <span class="best">best ${streak.best}</span>
                <button class="link logout">switch</button>
            </header>
            ${streak.bounceBack ? `<div class="note">${COPY.bounceBack}</div>` : ''}
            <section class="goal-card">
                <div class="goal-main">${COPY.goalReveal(reveal.bronzeTarget)}</div>
                ${ctx.whyLine ? `<div class="goal-why">${ctx.whyLine}</div>` : ''}
                ${reveal.bestRecent > 0 && !medal.medal ? `<div class="goal-proof">${COPY.microProof(reveal.bestRecent)}</div>` : ''}
            </section>
            <section class="medal-ladder">
                ${medals.map((m, i) => `
                    <span class="medal ${i <= medalIdx ? 'earned' : ''}" title="${m}">
                        ${{ bronze: '🥉', silver: '🥈', gold: '🥇' }[m]}
                    </span>`).join('')}
                <span class="medal-note">${COPY.medalProgress(medal.rounds, medal.next)}</span>
            </section>
            ${ctx.goldLocked ? `
                <section class="lock-card">
                    <div>${COPY.stopLock}</div>
                    ${ctx.tomorrowHint ? `<div class="lock-preview">${COPY.stopPreview(ctx.tomorrowHint)}</div>` : ''}
                </section>` : `
                <section class="rounds">
                    ${ctx.roundCards.map(c => c.big ? `
                        <button class="round-card play-big" data-idx="${c.idx}">${c.name} ▶</button>` : `
                        <button class="round-card ${c.done ? 'done' : ''}" data-idx="${c.idx}" ${c.done ? 'disabled' : ''}>
                            <span class="rc-name">${c.name}</span>
                            <span class="rc-state">${c.done ? '✓' : '▶'}</span>
                        </button>`).join('')}
                </section>`}
            ${ctx.isTest ? `<button class="link reset-test">reset test data</button>` : ''}
        </div>`;

    app().querySelectorAll('.round-card:not(.done)').forEach(b =>
        b.addEventListener('click', () => ctx.onRound(Number(b.dataset.idx))));
    app().querySelector('.logout').addEventListener('click', ctx.onLogout);
    app().querySelector('.reset-test')?.addEventListener('click', ctx.onReset);
}

/** Round screen: question, keypad, feedback states, clock. */
export function renderRound(plan, opts) {
    app().innerHTML = `
        <div class="screen round">
            <header class="round-head">
                <span class="round-name">${COPY.roundNames[plan.round_type] || 'Round'}</span>
                <span class="round-progress"></span>
                <span class="round-clock"></span>
            </header>
            <div class="q-zone">
                <div class="q-badge"></div>
                <div class="q-fact"></div>
                <div class="q-feedback"></div>
            </div>
            <div class="keypad-host"></div>
        </div>`;

    const factEl = app().querySelector('.q-fact');
    const badgeEl = app().querySelector('.q-badge');
    const fbEl = app().querySelector('.q-feedback');
    const progEl = app().querySelector('.round-progress');
    const clockEl = app().querySelector('.round-clock');

    let clockTimer = null;
    if (!plan.untimed && plan.round_type !== 'sprint') {
        const t0 = Date.now();
        clockTimer = setInterval(() => {
            const s = Math.floor((Date.now() - t0) / 1000);
            clockEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        }, 1000);
    } else if (plan.round_type === 'sprint') {
        const end = Date.now() + plan.durationMs;
        clockTimer = setInterval(() => {
            const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
            clockEl.textContent = `⏱ ${s}`;
        }, 250);
    }

    const showFact = (factId) => {
        const { a, op, b } = parseFact(factId);
        const sym = { mul: '×', add: '+', sub: '−' }[op];
        factEl.innerHTML = `${a} ${sym} ${b} = <span class="q-answer-slot">?</span>`;
    };

    // One dot per question: green = right, amber = missed. A miss schedules a
    // retry at the end of the round, shown as a small pending dot DIRECTLY
    // BENEATH its amber dot — the pairing is visible at a glance.
    // Retries happen in miss order, so the k-th retry outcome belongs to the
    // k-th missed column.
    const results = [];        // first-attempt outcomes
    const retryResults = [];   // requeued-attempt outcomes, in miss order
    const dotClass = v => v === true ? 'ok' : v === false ? 'miss' : '';
    const renderDots = () => {
        if (plan.round_type === 'sprint') { progEl.innerHTML = ''; return; }
        let missIdx = 0;
        progEl.innerHTML = Array.from({ length: plan.items.length }, (_, i) => {
            const sub = results[i] === false
                ? `<span class="dot sub ${dotClass(retryResults[missIdx++])}"></span>` : '';
            return `<span class="dotcol"><span class="dot ${dotClass(results[i])}"></span>${sub}</span>`;
        }).join('');
    };

    const session = new RoundSession(plan, {
        user: opts.user, day: opts.day, factAccuracy: opts.factAccuracy,
        hooks: {
            showModel: (factId, line) => new Promise(res => {
                pad.setEnabled(false); // no input during the reveal
                factEl.textContent = line;
                fbEl.textContent = 'now you…';
                setTimeout(() => { fbEl.textContent = ''; res(); }, 2200);
            }),
            showQuestion: (factId, fact, meta) => {
                showFact(factId);
                badgeEl.textContent = meta.requeued ? COPY.secondChance : '';
                fbEl.textContent = '';
                renderDots();
                pad.reset();
                pad.setEnabled(true);
            },
            showCorrect: (factId, meta = {}) => new Promise(res => {
                pad.setEnabled(false);
                (meta.requeued ? retryResults : results).push(true);
                renderDots();
                fbEl.textContent = '✓';
                fbEl.className = 'q-feedback good';
                setTimeout(() => { fbEl.className = 'q-feedback'; res(); }, 350);
            }),
            showWrong: (factId, correction, cue, meta = {}) => new Promise(res => {
                pad.setEnabled(false);
                (meta.requeued ? retryResults : results).push(false);
                renderDots();
                fbEl.innerHTML = `<span class="correction">${correction}</span>` +
                    (cue ? `<span class="cue">${cue}</span>` : '');
                fbEl.className = 'q-feedback fix';
                setTimeout(() => { fbEl.className = 'q-feedback'; res(); }, cue ? 2600 : 2000);
            }),
            done: (result) => {
                clearInterval(clockTimer);
                pad.destroy();
                opts.onDone(result);
            },
        },
    });

    const pad = new Keypad(app().querySelector('.keypad-host'), {
        onSubmit: (entry) => session.submit(entry),
    });

    session.start();
    return session;
}

/** Round-end: score + medal progress. (No revision recap — kids don't
 *  engage with it; the learning moment is the in-round 2nd chance.) */
export function renderEnd(result, ctx) {
    const { score, total, hardTheme, retriesFixed } = result;
    const bad = score / total <= 0.5;
    const head = COPY.endHeadline(score, total);
    app().innerHTML = `
        <div class="screen end">
            ${head.emoji ? `<div class="end-emoji">${head.emoji}</div>` : ''}
            ${head.line ? `<div class="end-headline">${head.line}</div>` : ''}
            <div class="end-score">${COPY.goodRound(score, total)}</div>
            ${retriesFixed ? `<div class="end-fixed">${COPY.secondChanceFixed(retriesFixed)}</div>` : ''}
            ${bad && hardTheme ? `<div class="end-note">${COPY.badRound(hardTheme)}</div>` : ''}
            ${ctx.improvementLine ? `<div class="end-improve">${ctx.improvementLine}</div>` : ''}
            <div class="end-medal">${COPY.medalProgress(ctx.medal.rounds, ctx.medal.next)}</div>
            ${ctx.easyBronzeLine ? `<div class="end-note">${ctx.easyBronzeLine}</div>` : ''}
            <button class="primary next">Done</button>
        </div>`;
    app().querySelector('.next').addEventListener('click', ctx.onNext);
}

export function renderBreak({ onDone }) {
    app().innerHTML = `
        <div class="screen break">
            <div class="break-msg">${COPY.breakPrompt}</div>
            <button class="primary">OK</button>
        </div>`;
    app().querySelector('.primary').addEventListener('click', onDone);
}

