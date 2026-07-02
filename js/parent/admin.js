/**
 * Parent dashboard (docs/DESIGN.md §3). Password-gated. Fetches each child's
 * raw answer log from KV and derives state with the SAME engine the game
 * uses — the dashboard shows exactly what the app computed, plus the
 * parent-only layers: fluency index, growth slope, struggle flags with
 * evidence, playbook scripts, audit trail, and settings.
 */
import { deriveState } from '../data/derive.js';
import { deriveStreak } from '../game/streaks.js';
import { dayMedal, isEasyDay, validRounds } from '../game/medals.js';
import { evaluateFlags, flagType, themeOf } from '../engine/flags.js';
import { fluencyIndex, growthSlope } from '../engine/metrics.js';
import { tableFacts, parseFact, STRATEGY_LINES, ADD_FAMILIES, familyOf } from '../engine/facts.js';
import { RT, SCHEDULER } from '../config.js';

const app = () => document.getElementById('app');
const DEFAULT_PW_HASH = // sha256('laura') — bootstrap before profiles exist
    '5d702eb07928ed7b84626b777c86c39bf4cb403d4024f031d5f97a4b0664421f';

let PROFILES = [];
const KIDS = () => PROFILES.filter(p => p.role !== 'admin');

boot();

async function boot() {
    try {
        const res = await fetch('/api/profiles');
        PROFILES = (await res.json()).profiles || [];
    } catch {
        PROFILES = [];
    }
    renderLogin();
}

function renderLogin() {
    app().innerHTML = `
        <div class="screen dash-login">
            <h1>Parent dashboard</h1>
            <input type="password" id="pw" placeholder="password" autocomplete="current-password">
            <button class="primary" id="go">Open</button>
            <div class="pin-msg" id="msg"></div>
            <a class="link" href="index.html">‹ back to the game</a>
        </div>`;
    const tryLogin = async () => {
        const pw = document.getElementById('pw').value;
        const hash = await sha256(pw);
        const admin = PROFILES.find(p => p.role === 'admin');
        const ok = admin ? hash === admin.pinHash : hash === DEFAULT_PW_HASH;
        if (ok) render();
        else document.getElementById('msg').textContent = 'Not quite';
    };
    document.getElementById('go').addEventListener('click', tryLogin);
    document.getElementById('pw').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
}

async function render() {
    app().innerHTML = `<div class="screen dash"><h1>Loading…</h1></div>`;
    const kids = KIDS();
    if (!kids.length) {
        app().innerHTML = `<div class="screen dash">
            <h1>Parent dashboard</h1>
            <p class="dim">No player profiles yet — profiles appear after the game is opened once on any device.</p>
            <a class="link" href="index.html">‹ back to the game</a></div>`;
        return;
    }
    const sections = [];
    for (const kid of kids) sections.push(await kidSection(kid));
    app().innerHTML = `
        <div class="screen dash">
            <header class="dash-head">
                <h1>Parent dashboard</h1>
                <a class="link" href="index.html">game ›</a>
            </header>
            <div class="note dash-warning">Heads-up: mixed/interleaved practice makes
            scores dip in the first weeks — that is the method working, not failing.
            Judge trends at weeks 4–10 (30+ sessions). Habit formation ≈ 2 months.</div>
            ${sections.join('')}
        </div>`;
    wireSettings();
}

async function kidSection(kid) {
    let answers = [];
    try {
        const res = await fetch(`/api/answers?user=${encodeURIComponent(kid.user)}`);
        answers = Object.values((await res.json()).days || {}).flat();
    } catch { /* offline: show what we can */ }

    const derived = deriveState(answers, {});
    const { state, days, classified, audit } = derived;
    const today = todayStr();
    const streak = deriveStreak(days, today);

    // Week overview.
    const last14 = lastNDays(today, 14);
    const weekBars = last14.map(d => {
        const v = validRounds(days[d]);
        const easy = isEasyDay(kid.user, d, kid.settings || {});
        return `<div class="bar${easy ? ' easy' : ''}" style="height:${Math.min(v, 8) * 10 + 4}px"
                     title="${d}: ${v} rounds${easy ? ' (easy day)' : ''}"></div>`;
    }).join('');
    const medal = dayMedal(days[today], { easy: isEasyDay(kid.user, today, kid.settings || {}) });

    // Fluency index from sprint rounds (falls back to mixed-round rate).
    const sprint = sprintHistory(classified);
    const fi = sprint.latestPerMin !== null && kid.dob
        ? fluencyIndex(sprint.latestPerMin, 'mul', ageMonths(kid.dob, today))
        : null;
    const slope = growthSlope(sprint.weekly);

    // Struggle flags over the trailing 14 days.
    const winStart = lastNDays(today, 14)[0];
    const recent = classified.filter(a => a.day >= winStart && !a.void);
    const factStates = Object.fromEntries(Object.entries(state.facts).map(([id, r]) => [id, r.state]));
    const flags = evaluateFlags(recent, {}, factStates, today);
    const flagged = Object.entries(flags).filter(([, f]) => f.state === 'flagged');

    // Exclusion-rate alarm.
    const exclRate = recent.length
        ? recent.filter(a => a.cls.exclusion_reason && a.cls.exclusion_reason !== 'lapse_suspect').length / recent.length
        : 0;

    return `
        <section class="kid-card" data-user="${kid.user}">
            <header class="kid-head">
                <span class="kid-name">${kid.avatar || ''} ${kid.name}</span>
                <span class="kid-streak">🔥 ${streak.current} (best ${streak.best})</span>
                <span class="kid-medal">${{ gold: '🥇', silver: '🥈', bronze: '🥉' }[medal.medal] || '—'} today</span>
            </header>

            <div class="dash-row">
                <div class="panel">
                    <h3>Last 14 days</h3>
                    <div class="bars">${weekBars}</div>
                    <div class="dim small">bars = valid rounds/day · outlined = easy day</div>
                </div>
                <div class="panel">
                    <h3>Fluency index</h3>
                    ${fi ? `
                        <div class="fi-band">${fi.band[0]}–${fi.band[1]}${fi.extrapolated ? ' <span class="dim">(extrapolated)</span>' : ''}</div>
                        <div class="dim small">${fi.label}</div>`
                    : `<div class="dim">needs ${sprint.count}/3 sprint rounds${kid.dob ? '' : ' + date of birth (set below)'}</div>`}
                    <div class="slope ${slope.status}">trend: ${slope.status}${slope.slope !== null ? ` (${slope.slope > 0 ? '+' : ''}${(slope.slope || 0).toFixed(2)}/wk)` : ''}</div>
                </div>
            </div>

            <div class="panel">
                <h3>Times tables — fact map</h3>
                ${factGrid(state)}
                <div class="dim small">green fluent · amber slow (counting) · grey not settled · red stuck</div>
            </div>

            <div class="panel">
                <h3>Add / subtract ladder</h3>
                ${ladderView(state)}
            </div>

            <div class="panel">
                <h3>Flags ${flagged.length ? `(${flagged.length})` : ''}</h3>
                ${flagged.length ? flagged.map(([theme, f]) => flagView(kid, theme, f)).join('')
                    : `<div class="dim">Nothing flagged — flags need a persistent deficit vs ${kid.name}'s own baseline across 3+ days.</div>`}
                ${exclRate > RT.ALARM_EXCLUSION_RATE ? `
                    <div class="alarm">⚠ ${Math.round(exclRate * 100)}% of recent answers were discarded
                    (mashing/timeouts) — worth watching a session in person.</div>` : ''}
            </div>

            <details class="panel">
                <summary>Engine audit trail</summary>
                <div class="audit">${auditView(audit)}</div>
            </details>

            <div class="panel dash-settings">
                <h3>Settings</h3>
                <label><input type="checkbox" class="easy-toggle" ${kid.settings?.easyDaysOff ? '' : 'checked'}>
                    easy days on</label>
                <label>DOB <input type="date" class="dob" value="${kid.dob || ''}"></label>
                <label>new PIN <input type="text" class="new-pin" maxlength="4" placeholder="····"></label>
                <button class="save">save</button>
                <button class="csv">export CSV</button>
            </div>
        </section>`;
}

// ---------- views ----------

function factGrid(state) {
    const tables = SCHEDULER.TABLE_ORDER.slice().sort((a, b) => a - b);
    return `<div class="grid-wrap"><table class="fact-grid">
        <tr><th></th>${tables.map(n => `<th>${n}</th>`).join('')}</tr>
        ${tables.map(t => `<tr><th>${t}</th>${tables.map(n => {
            const rec = state.facts[`${t}x${n}`] || state.facts[`${n}x${t}`];
            const st = rec ? rec.state : 'UNSEEN';
            return `<td class="fs-${st.toLowerCase()}" title="${t}×${n}${rec ? ` · ${st} · ${Math.round(rec.medianRt / 100) / 10}s` : ''}"></td>`;
        }).join('')}</tr>`).join('')}
    </table></div>`;
}

function ladderView(state) {
    return `<div class="ladder">${ADD_FAMILIES.map(fam => {
        const unlocked = state.unlockedFamilies.includes(fam);
        const warm = (state.warmupFamilies || []).includes(fam);
        const ema = state.familyEMA[fam];
        return `<span class="lad ${unlocked ? 'open' : ''} ${warm ? 'warm' : ''}"
            title="${fam}${ema !== undefined ? ` · accuracy ${Math.round(ema * 100)}%` : ''}${warm ? ' · warming up' : ''}">
            ${fam.replace(/^add-/, '').replace(/-/g, ' ')}</span>`;
    }).join('')}</div>`;
}

function flagView(kid, theme, f) {
    const e = f.evidence || {};
    const type = flagType(e);
    const line = `${kid.name} — ${themeName(theme)}: ` + (
        type === 'slow'
            ? `accurate (${pct(e.accuracy)}) but ~${(e.rtRatio || 0).toFixed(1)}× slower than their other facts over ${e.attempts} attempts in ${e.days} days — probably counting, not recalling.`
            : type === 'conceptual'
                ? `a repeated error pattern (${e.repeatedBug || e.dominantError}) over ${e.attempts} attempts — this needs one concrete explanation, not more reps.`
                : `${pct(e.accuracy)} correct vs ${pct(e.overallAccuracy)} on everything else, over ${e.attempts} attempts in ${e.days} days.`);
    return `
        <div class="flag flag-${type}">
            <div class="flag-line">${line}</div>
            <details><summary>tonight's 10 minutes</summary>
                <div class="script">${playbook(kid, theme, type, e)}</div>
            </details>
        </div>`;
}

function playbook(kid, theme, type, e) {
    const facts = (e.worstFacts || []).map(f => pretty(f)).join(', ');
    const strat = STRATEGY_LINES[theme] || '';
    if (type === 'slow') return `
        <p><b>${kid.name} knows these — no teaching.</b> A 5-minute paced flashcard
        race: cards for ${facts || 'the flagged facts'} mixed with facts they're fast on.
        Flip at a steady 2-second beat; any hesitation → say the answer, they repeat
        it, card goes back in the pile. Stop at 5 minutes. Mostly: keep the daily
        rounds going — speed comes from volume.</p>`;
    if (type === 'conceptual') return `
        <p><b>One concrete model, no worksheet.</b> ${kid.name} keeps making the same
        slip (${e.repeatedBug || e.dominantError}). Use counters or drawn dots: build
        the fact physically, ask "how many rows? how many in each? how many
        altogether?" Do 2–3 related facts the same way. That's it — the app will
        drill them once the idea has landed (it has already dropped these facts
        back to untimed).</p>`;
    return `
        <p><b>~10 minutes tonight — stop sooner if it stops being fun.</b></p>
        <ol>
        <li>Say once: <i>"${strat || 'show them the trick for this family'}"</i>. Have
            ${kid.name} do ${facts || 'two of the flagged facts'} that way, out loud (~2 min).</li>
        <li>Flashcards (~8 min): the flagged fact first, then 5–9 facts they're solid
            on, folding the new one in again after each pass.</li>
        <li>Wrong or hesitates over 2 seconds → say the whole fact ("7 times 8 is 56 —
            you say it"), they repeat, carry on. No re-teaching mid-drill.</li>
        <li>Stop at 10 minutes, after 3 misses on the same fact, or the moment it gets
            tense — and finish on a fact they get right. The app keeps re-checking
            this theme; the flag clears itself from their play data.</li>
        </ol>`;
}

function auditView(audit) {
    const rows = audit.slice(-40).reverse().map(a => {
        const what = {
            family_unlocked: `unlocked ${a.family}${a.partnerOf ? ` (partner of ${a.partnerOf})` : ''}`,
            family_demoted: `demoted ${a.family} back to warm-up (ema ${round2(a.ema)})`,
            warmup_graduated: `${a.family} graduated warm-up (ema ${round2(a.ema)})`,
            off_day: `off-day detected — nothing written`,
            ema: null,
        }[a.type];
        return what ? `<div>${a.day} · ${what}</div>` : '';
    }).join('');
    return rows || '<div class="dim">no transitions yet</div>';
}

// ---------- settings ----------

function wireSettings() {
    document.querySelectorAll('.kid-card').forEach(card => {
        const user = card.dataset.user;
        card.querySelector('.save').addEventListener('click', async () => {
            const kid = PROFILES.find(p => p.user === user);
            kid.settings = kid.settings || {};
            kid.settings.easyDaysOff = !card.querySelector('.easy-toggle').checked;
            const dob = card.querySelector('.dob').value;
            if (dob) kid.dob = dob;
            const pin = card.querySelector('.new-pin').value.trim();
            if (/^\d{4}$/.test(pin)) kid.pinHash = await sha256(pin);
            kid.updated = Date.now();
            await fetch('/api/profiles', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(kid),
            });
            card.querySelector('.save').textContent = 'saved ✓';
            setTimeout(() => card.querySelector('.save').textContent = 'save', 1500);
        });
        card.querySelector('.csv').addEventListener('click', async () => {
            const res = await fetch(`/api/answers?user=${encodeURIComponent(user)}`);
            const answers = Object.values((await res.json()).days || {}).flat();
            const head = 'day,ts,round_type,fact,given,correct,initiation_ms,typing_ms,input,timeout';
            const rows = answers.map(a =>
                [a.day, a.ts, a.round_type, a.fact_id, a.given, a.correct, a.initiation_ms, a.typing_ms, a.input, a.timeout].join(','));
            const blob = new Blob([[head, ...rows].join('\n')], { type: 'text/csv' });
            const link = Object.assign(document.createElement('a'), {
                href: URL.createObjectURL(blob), download: `rewardmaths-${user}.csv`,
            });
            link.click();
        });
    });
}

// ---------- helpers ----------

function sprintHistory(classified) {
    const sprints = classified.filter(a => a.round_type === 'sprint' && !a.void);
    const byRound = {};
    for (const a of sprints) (byRound[a.round_id] ||= []).push(a);
    const rounds = Object.values(byRound).map(items => ({
        day: items[0].day,
        perMin: items.filter(a => a.correct && a.cls.counts_for_accuracy).length, // 60s round → count = per-min
    })).sort((a, b) => a.day < b.day ? -1 : 1);
    const weekly = [];
    for (const r of rounds) {
        const week = Math.floor(new Date(r.day) / (7 * 86400000));
        const prev = weekly.find(w => w.week === week);
        if (prev) prev.correctPerMin = Math.max(prev.correctPerMin, r.perMin);
        else weekly.push({ week, correctPerMin: r.perMin });
    }
    weekly.forEach((w, i) => w.week = i);
    return {
        count: rounds.length,
        weekly,
        latestPerMin: rounds.length >= 3 ? median(rounds.slice(-3).map(r => r.perMin)) : null,
    };
}

function themeName(theme) {
    return theme.startsWith('table-') ? `${theme.slice(6)}s table` : theme.replace(/-/g, ' ');
}

function pretty(factId) {
    const { a, op, b } = parseFact(factId);
    return `${a} ${{ mul: '×', add: '+', sub: '−' }[op]} ${b}`;
}

function ageMonths(dob, today) {
    return Math.floor((new Date(today) - new Date(dob)) / (30.44 * 86400000));
}

function lastNDays(today, n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(today + 'T12:00:00');
        d.setDate(d.getDate() - i);
        out.push(d.toISOString().slice(0, 10));
    }
    return out;
}

function todayStr(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function median(xs) {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
}

function pct(x) { return `${Math.round((x || 0) * 100)}%`; }
function round2(x) { return Math.round((x || 0) * 100) / 100; }

async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
