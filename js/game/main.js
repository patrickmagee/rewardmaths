/**
 * v5 child-app bootstrap: profiles → PIN → today loop.
 * State derives from the local answer log (docs/REWRITE.md §2); sync is
 * best-effort in the background.
 */
import { SCHEDULER, DAY } from '../config.js';
import { buildDailyRounds, blockedRound, workingTable } from '../engine/scheduler.js';
import { tableFacts, familyFacts, sampleFamily } from '../engine/facts.js';
import { deriveState } from '../data/derive.js';
import * as db from '../data/db.js';
import { syncAll, syncDay, syncProfiles, pushProfile } from '../data/sync.js';
import { deriveStreak } from './streaks.js';
import { dayMedal, goalReveal, isEasyDay } from './medals.js';
import { COPY } from './copy.js';
import * as ui from './screens.js';

const S = {
    profiles: [],
    user: null,
    profile: null,
    derived: null,     // { state, audit, days, classified }
    todayPlan: null,
    consecutiveRounds: 0,
    rng: mulberry(Date.now() >>> 0),
};

const DEFAULT_PROFILES = [
    { user: 'tom', name: 'Tom', avatar: '🦖', role: 'player', pin: '1111', settings: { accent: 'a' } },
    { user: 'eliza', name: 'Eliza', avatar: '🎨', role: 'player', pin: '2222', settings: { accent: 'b' } },
    { user: 'patrick', name: 'Patrick', avatar: '🔧', role: 'admin', pin: 'laura', settings: {} },
];

boot();

async function boot() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    let local = await db.getProfiles();
    if (!local.length) {
        for (const p of DEFAULT_PROFILES) {
            const prof = { ...p, pinHash: await sha256(p.pin), updated: Date.now() };
            delete prof.pin;
            await db.putProfile(prof);
            pushProfile(prof); // best-effort
        }
        local = await db.getProfiles();
    }
    S.profiles = await syncProfiles(local);
    for (const p of S.profiles) await db.putProfile(p);
    showWho();
}

function showWho() {
    S.user = null;
    ui.renderWho(S.profiles, {
        onPick: (user) => {
            S.profile = S.profiles.find(p => p.user === user);
            ui.renderPin(S.profile, {
                onOk: async (pin) => {
                    const ok = (await sha256(pin)) === S.profile.pinHash;
                    if (ok) { S.user = user; await enter(); }
                    return ok;
                },
                onBack: showWho,
            });
        },
        onParent: () => { window.location.href = 'admin.html'; },
    });
}

async function enter() {
    syncAll(S.user).then(refreshDerived); // background catch-up
    await refreshDerived();
    // Typing baseline: run the warm-up if we've never measured this child.
    const baselines = await db.getMeta(`typing:${S.user}`, null);
    if (!baselines) {
        ui.renderTyping({
            onDone: async ({ typing_ms }) => {
                await db.putMeta(`typing:${S.user}`, { tap: typing_ms, measured: Date.now() });
                showToday();
            },
        });
        return;
    }
    showToday();
}

async function refreshDerived() {
    const answers = await db.getAnswers(S.user);
    const baselines = await db.getMeta(`typing:${S.user}`, {});
    S.derived = deriveState(answers, { typingBaselines: baselines });
    return S.derived;
}

function todayCtx() {
    const day = db.todayStr();
    const todayAnswers = S.derived.classified.filter(a => a.day === day && !a.void);
    const retrievalsToday = {};
    for (const a of todayAnswers) {
        if (a.cls.counts_as_retrieval && a.correct) {
            retrievalsToday[a.fact_id] = (retrievalsToday[a.fact_id] || 0) + 1;
        }
    }
    const daysPlayed = Object.keys(S.derived.days).length;
    const factsSeen = Object.keys(S.derived.state.facts).length;
    const placementActive = daysPlayed < 12 && factsSeen < 80;
    const lastSprint = S.derived.classified.filter(a => a.round_type === 'sprint').map(a => a.day).sort().pop();
    const sprintDue = !placementActive && (!lastSprint || daysApart(lastSprint, day) >= 7);
    return { day, retrievalsToday, placementActive, sprintDue };
}

async function showToday() {
    const ctx = todayCtx();
    const { day } = ctx;
    const days = S.derived.days;
    const streak = deriveStreak(days, day);
    const easy = isEasyDay(S.user, day, S.profile.settings || {});
    const reveal = goalReveal(S.user, days, day, streak, S.profile.settings || {});
    const medal = dayMedal(days[day], { easy, bounceBack: reveal.bounceBack });

    S.todayPlan = buildDailyRounds(S.derived.state, ctx, S.rng);

    // Which of today's planned round types are already done?
    const playedTypes = { ...(days[day]?.byType || {}) };
    const roundCards = S.todayPlan.map((r, idx) => {
        const doneCount = playedTypes[r.round_type] || 0;
        const priorSame = S.todayPlan.slice(0, idx).filter(x => x.round_type === r.round_type).length;
        return {
            idx,
            name: COPY.roundNames[r.round_type] || 'Round',
            done: doneCount > priorSame,
        };
    });
    // Extra rounds beyond the daily set (toward silver/gold): offer a mix card.
    if (roundCards.every(c => c.done) && !medal.goldDone) {
        roundCards.push({ idx: 2, name: 'Extra round', done: false });
    }

    const wt = workingTable(S.derived.state);
    const whyLine = ctx.placementActive
        ? 'Explorer week — the app is learning what you know'
        : (wt ? COPY.goalWhy.focusTable(wt) : COPY.goalWhy.process(reveal.bronzeTarget));

    ui.renderToday({
        profile: S.profile, streak, medal, reveal, whyLine,
        roundCards,
        playedTypes,
        goldLocked: medal.goldDone,
        tomorrowHint: wt ? `${wt}s and a mix` : 'a fresh mix',
        freePlayOpen: medal.rounds >= reveal.bronzeTarget,
        onRound: (idx) => startRound(S.todayPlan[Math.min(idx, S.todayPlan.length - 1)]),
        onFree: () => showFree(),
        onLogout: () => showWho(),
    });
}

function startRound(plan) {
    const ctx = todayCtx();
    ui.renderRound(plan, {
        user: S.user,
        day: ctx.day,
        factAccuracy: (factId) => {
            const rec = S.derived.state.facts[factId];
            if (!rec || !rec.attempts.length) return 0;
            const last = rec.attempts.slice(-5);
            return last.filter(a => a.correct).length / last.length;
        },
        onDone: async (result) => {
            await db.putAnswers(result.answers);
            syncDay(S.user, ctx.day); // best-effort background
            await refreshDerived();
            S.consecutiveRounds++;
            afterRound(result);
        },
    });
}

function afterRound(result) {
    const ctx = todayCtx();
    const days = S.derived.days;
    const streak = deriveStreak(days, ctx.day);
    const easy = isEasyDay(S.user, ctx.day, S.profile.settings || {});
    const reveal = goalReveal(S.user, days, ctx.day, streak, S.profile.settings || {});
    const medal = dayMedal(days[ctx.day], { easy, bounceBack: reveal.bounceBack });

    const easyBronzeLine = easy && medal.medal === 'bronze' && medal.next
        ? COPY.easyBronzeDone(medal.next) : null;

    ui.renderEnd(result, {
        medal,
        improvementLine: null, // wired to sprint history in the parent phase
        easyBronzeLine,
        onNext: () => {
            if (S.consecutiveRounds >= DAY.BREAK_AFTER_ROUNDS && !medal.goldDone) {
                S.consecutiveRounds = 0;
                ui.renderBreak({ onDone: showToday });
                return;
            }
            showToday();
        },
    });
}

function showFree() {
    ui.renderFree({
        onBack: showToday,
        onPick: (pick) => {
            let items;
            if (pick.startsWith('mul:')) {
                const t = Number(pick.split(':')[1]);
                items = shuffle(tableFacts(t), S.rng).slice(0, SCHEDULER.QUESTIONS_PER_ROUND);
            } else {
                const fams = S.derived.state.unlockedFamilies.filter(f =>
                    pick === 'add' ? !f.startsWith('sub') : f.startsWith('sub'));
                items = Array.from({ length: SCHEDULER.QUESTIONS_PER_ROUND }, () => {
                    const fam = fams[Math.floor(S.rng() * fams.length)] || 'add-0-1';
                    const members = familyFacts(fam);
                    return members ? members[Math.floor(S.rng() * members.length)] : sampleFamily(fam, S.rng);
                });
            }
            const plan = {
                round_type: 'free', untimed: false,
                items: items.map(f => ({ fact_id: f, model: false })),
            };
            startRound(plan);
        },
    });
}

// ---------- utils ----------

async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function daysApart(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function shuffle(xs, rng) {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function mulberry(seed) {
    let s = seed;
    return () => {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
