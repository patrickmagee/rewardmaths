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
import { ceilingMs } from '../engine/classify.js';
import { tableFacts, parseFact, STRATEGY_LINES, ADD_FAMILIES, familyOf, canonicalKey } from '../engine/facts.js';
import { RT, SCHEDULER } from '../config.js';

const app = () => document.getElementById('app');
const DEFAULT_PW_HASH = // sha256('slieveleague') — bootstrap before profiles exist
    'b8dd947fabbf5c08006da0bd63500d411cc555a23ebc6d72a720b609dac6f3e0';

let PROFILES = [];
const KIDS = () => PROFILES.filter(p => p.role !== 'admin');

// Genuine DISENGAGEMENT only — mirrors classify.js's DISENGAGED set (the source
// of truth; not exported, so replicated here). Since b5a51a5 a timeout is
// COUNTED negative evidence (counts_for_accuracy:true), not discarded, so it
// must never inflate the "discarded" alarm; lapse_suspect is also counted, not
// discarded. Only anticipation/rapid_guess are the child mashing.
const DISENGAGED_REASONS = new Set(['anticipation', 'rapid_guess']);

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
    // Real kids first, the test account last.
    const kids = KIDS().sort((a, b) => (a.user === 'test') - (b.user === 'test'));
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
            <nav class="kid-tabs">
                ${kids.map(k => `
                    <button class="kid-tab" data-user="${k.user}">${k.avatar || ''} ${k.name}</button>`).join('')}
            </nav>
            <div class="note dash-warning">Heads-up: mixed/interleaved practice makes
            scores dip in the first weeks — that is the method working, not failing.
            Judge trends at weeks 4–10 (30+ sessions). Habit formation ≈ 2 months.</div>
            ${sections.join('')}
        </div>`;
    // One child at a time; last-viewed child remembered across visits.
    const stored = localStorage.getItem('dash-kid');
    const select = (user) => {
        localStorage.setItem('dash-kid', user);
        document.querySelectorAll('.kid-tab').forEach(t => t.classList.toggle('active', t.dataset.user === user));
        document.querySelectorAll('.kid-card').forEach(c => c.classList.toggle('hidden', c.dataset.user !== user));
    };
    document.querySelectorAll('.kid-tab').forEach(t =>
        t.addEventListener('click', () => select(t.dataset.user)));
    select(kids.some(k => k.user === stored) ? stored : kids[0].user);
    wireActivity();
    wireSettings();
}

// ---------- activity tooltip ----------

let tipEl = null;

function tip() {
    if (!tipEl) {
        tipEl = document.createElement('div');
        tipEl.className = 'viz-tip';
        document.body.appendChild(tipEl);
    }
    return tipEl;
}

function wireActivity() {
    document.querySelectorAll('.acol').forEach(col => {
        const show = () => {
            const data = JSON.parse(col.dataset.tip);
            const t = tip();
            t.replaceChildren();
            const head = document.createElement('div');
            head.className = 'tip-head';
            head.textContent = data.head;
            t.appendChild(head);
            for (const row of data.rows) {
                const div = document.createElement('div');
                div.className = 'tip-row';
                if (row.b) {
                    const b = document.createElement('b');
                    b.textContent = row.b;
                    div.appendChild(b);
                }
                if (row.t) div.appendChild(document.createTextNode(row.t));
                t.appendChild(div);
            }
            t.style.display = 'block';
            const r = col.getBoundingClientRect();
            const tr = t.getBoundingClientRect();
            const x = Math.max(8, Math.min(r.left + r.width / 2 - tr.width / 2, innerWidth - tr.width - 8));
            const y = r.top - tr.height - 8;
            t.style.left = `${x}px`;
            t.style.top = `${y < 8 ? r.bottom + 8 : y}px`;
        };
        const hide = () => { if (tipEl) tipEl.style.display = 'none'; };
        col.addEventListener('pointerenter', show);
        col.addEventListener('pointerleave', hide);
        col.addEventListener('focus', show);
        col.addEventListener('blur', hide);
    });
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

    // Activity strip: one labelled, hoverable column per day.
    const last14 = lastNDays(today, 14);
    const yesterday = lastNDays(today, 2)[0];
    const activity = last14.map(d => {
        const v = validRounds(days[d]);
        const voided = days[d]?.voidRounds || 0;
        const easy = isEasyDay(kid.user, d, kid.settings || {});
        const m = dayMedal(days[d], { easy }).medal;
        const dayAns = classified.filter(a => a.day === d && !a.void && a.cls.counts_for_accuracy);
        const correct = dayAns.filter(a => a.correct).length;
        const dt = new Date(d + 'T12:00:00');
        const nice = dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
        const rel = d === today ? 'Today' : d === yesterday ? 'Yesterday' : null;

        // Played-but-all-discarded is NOT "no play" — say what actually happened.
        const played = (days[d]?.rounds || 0);
        const rows = [];
        if (v > 0) {
            rows.push({ b: `${v} round${v === 1 ? '' : 's'}`, t: m ? ` · ${{ bronze: '🥉 bronze', silver: '🥈 silver', gold: '🥇 gold' }[m]}` : '' });
            if (dayAns.length) rows.push({ t: `${correct}/${dayAns.length} answers correct` });
        } else if (played > 0) {
            rows.push({ b: `${played} round${played === 1 ? '' : 's'} played`, t: ' · not counted' });
        } else {
            rows.push({ b: 'No play', t: '' });
        }
        // Name the real reason rather than asserting one: a round is only
        // voided by mashing/anticipations, but slow answers and timeouts are
        // genuine effort and must never be reported as guessing.
        if (voided) {
            const slow = classified.filter(a => a.day === d && a.cls.exclusion_reason === 'timeout').length;
            rows.push({ t: `${voided} round${voided === 1 ? '' : 's'} not counted (too many very fast answers)` });
            if (slow) rows.push({ t: `${slow} answer${slow === 1 ? '' : 's'} ran out of time — counted as effort` });
        } else if (classified.some(a => a.day === d && a.cls.exclusion_reason === 'timeout')) {
            const slow = classified.filter(a => a.day === d && a.cls.exclusion_reason === 'timeout').length;
            rows.push({ t: `${slow} answer${slow === 1 ? '' : 's'} ran out of time` });
        }
        if (easy) rows.push({ t: 'Easy day — bronze needs just 1 round' });
        const tip = { head: rel ? `${rel} — ${nice}` : nice, rows };
        const aria = `${tip.head}: ` + rows.map(r => `${r.b || ''}${r.t}`.trim()).join('; ');

        return `
            <div class="acol${d === today ? ' today' : ''}" tabindex="0" role="img"
                 aria-label="${aria.replace(/"/g, '&quot;')}"
                 data-tip='${JSON.stringify(tip).replace(/'/g, '&#39;')}'>
                <div class="acol-plot">
                    ${m ? `<span class="acol-medal">${{ bronze: '🥉', silver: '🥈', gold: '🥇' }[m]}</span>` : ''}
                    ${v ? `<div class="acol-bar" style="height:${6 + Math.min(v, 8) / 8 * 66}px"></div>` : ''}
                </div>
                <span class="acol-dow">${'SMTWTFS'[dt.getDay()]}</span>
                <span class="acol-date${easy ? ' easy' : ''}">${d === today ? 'now' : dt.getDate()}</span>
            </div>`;
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
    // Full fact RECORDS, not bare states: evaluateFlags needs cumulative
    // attempts to tell "measured and failing" from "barely met" (DESIGN §3).
    const flags = evaluateFlags(recent, {}, state.facts, today);
    const flagged = Object.entries(flags).filter(([, f]) => f.state === 'flagged');

    // Disengagement-rate alarm: only genuine mashing/very-fast guesses count as
    // "discarded". Timeouts (negative evidence) and lapse_suspect (counted) are
    // NOT discarded — see DISENGAGED_REASONS.
    const exclRate = recent.length
        ? recent.filter(a => DISENGAGED_REASONS.has(a.cls.exclusion_reason)).length / recent.length
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
                    <div class="activity">${activity}</div>
                    <div class="dim small">bar height = rounds that day · 🥉🥈🥇 medal earned · amber date = easy day · hover a day for detail</div>
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
                ${factGrid(state, classified)}
                <div class="dim small">
                    <span class="fs-key fs-fluent"></span>recalled ·
                    <span class="fs-key fs-slow"></span>right, but working it out ·
                    <span class="fs-key fs-unsettled"></span>too few attempts to judge yet ·
                    <span class="fs-key fs-unknown"></span>not secure yet ·
                    <span class="fs-key fs-stuck"></span>stuck ·
                    <span class="fs-key fs-unseen"></span>not shown yet</div>
                <div class="dim small">Most of a new grid is “too few attempts” — that is missing
                    evidence, not weakness. A fact needs 5 attempts across 2 days before its speed
                    is judged at all. Hover a square for that fact's thinking time.</div>
                <div class="dim small">Speed is shown here for your information only: it never
                    changes what ${kid.name} is given to practise, and working an answer out is
                    never treated as a mistake. Of ~200 12-year-olds studied (Hopkins &amp; Bayliss,
                    2017), fewer than half were fluent with simple addition and about a third were
                    still predominantly counting.</div>
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
                    <div class="alarm">⚠ ${Math.round(exclRate * 100)}% of recent answers were very fast
                    guesses or mashing (not counted) — worth watching a session in person.</div>` : ''}
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
                <label>question timeout
                    <input type="number" class="ceiling" min="${RT.HARD_CEILING_MIN_MS / 1000}"
                        max="${RT.HARD_CEILING_MAX_MS / 1000}" step="1"
                        value="${ceilingMs(kid.settings) / 1000}">s</label>
                <button class="save">save</button>
                <button class="csv">export CSV</button>
                <div class="dim small">Timeout is how long ${kid.name} gets on a question
                    before it moves on (untimed rounds are unaffected). Takes effect next
                    time they open the app. Each answer records the timeout it was played
                    against, so changing this never rewrites past results.</div>
            </div>
        </section>`;
}

// ---------- views ----------

// Parent-facing words for engine states. The grid is judged on thinking time
// (question shown → first keypress), so the tooltip reports that, not total.
const STATE_WORDS = {
    FLUENT: 'recalled',
    SLOW: 'counting',
    UNSETTLED: 'too few attempts to judge yet',
    UNKNOWN: 'not secure yet',
    STUCK: 'stuck',
    UNSEEN: 'not shown yet',
};

// Commuted multiplication facts (7×8 and 8×7) are stored as two DIRECTED
// records but are one real fact — facts.js canonicalKey pools them. The grid
// must show ONE colour per real fact, not two contradictory ones (e.g. 10×9
// FLUENT next to 9×10 UNKNOWN). We show the MORE-ADVANCED of the two states:
// commutativity means if the child demonstrably retrieves the fact in either
// direction they know it, and the weaker direction is just fewer/less-lucky
// samples (genuine conceptual struggle is caught separately by the flags
// panel). Attempts are summed; thinking time is the direction that set the
// colour, so the tooltip is internally consistent.
const STATE_RANK = { STUCK: 0, UNKNOWN: 1, UNSETTLED: 2, SLOW: 3, FLUENT: 4 };
function pooledFact(a, b) {
    if (!a && !b) return null;
    if (!a) return b;
    if (!b) return a;
    const best = (STATE_RANK[b.state] ?? -1) > (STATE_RANK[a.state] ?? -1) ? b : a;
    return { ...best, totalAttempts: (a.totalAttempts || 0) + (b.totalAttempts || 0) };
}

function factGrid(state, classified = []) {
    const tables = SCHEDULER.TABLE_ORDER.slice().sort((a, b) => a - b);
    // Timeouts per canonical (commuted) fact. Since b5a51a5 a square can be
    // COLOURED by timeouts (negative evidence) while its thinking time —
    // computed from valid attempts only — still looks fast, which reads as a
    // contradiction. Surface the count so the tooltip explains the colour.
    const timeoutsByKey = {};
    for (const a of classified) {
        if (!a.void && a.cls.exclusion_reason === 'timeout') {
            const k = canonicalKey(a.fact_id);
            timeoutsByKey[k] = (timeoutsByKey[k] || 0) + 1;
        }
    }
    return `<div class="grid-wrap"><table class="fact-grid">
        <tr><th></th>${tables.map(n => `<th>${n}</th>`).join('')}</tr>
        ${tables.map(t => `<tr><th>${t}</th>${tables.map(n => {
            const rec = pooledFact(state.facts[`${t}x${n}`], state.facts[`${n}x${t}`]);
            const st = rec ? rec.state : 'UNSEEN';
            const think = rec && rec.medianInit
                ? ` · ${Math.round(rec.medianInit / 100) / 10}s thinking` : '';
            const tries = rec && rec.totalAttempts ? ` · ${rec.totalAttempts} tries` : '';
            const to = timeoutsByKey[canonicalKey(`${t}x${n}`)] || 0;
            const timedOut = to ? ` · ${to} timed out` : '';
            return `<td class="fs-${st.toLowerCase()}" title="${t}×${n} · ${STATE_WORDS[st]}${think}${tries}${timedOut}"></td>`;
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
            // Seconds in the UI, ms in the profile. Re-clamped here because a
            // number input's min/max are trivially bypassed.
            const secs = Number(card.querySelector('.ceiling').value);
            if (Number.isFinite(secs) && secs > 0) {
                kid.settings.ceilingMs = ceilingMs({ ceilingMs: secs * 1000 });
            }
            kid.updated = Date.now();
            const btn = card.querySelector('.save');
            try {
                const res = await fetch('/api/profiles', {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(kid),
                });
                const body = await res.json();
                if (!res.ok || body.kept === 'existing') {
                    btn.textContent = 'not saved — retry';
                    return;
                }
                btn.textContent = 'saved ✓';
            } catch {
                btn.textContent = 'offline — not saved';
                return;
            }
            setTimeout(() => btn.textContent = 'save', 1500);
        });
        card.querySelector('.csv').addEventListener('click', async () => {
            const res = await fetch(`/api/answers?user=${encodeURIComponent(user)}`);
            const answers = Object.values((await res.json()).days || {}).flat();
            const head = 'day,ts,round_type,fact,given,correct,initiation_ms,typing_ms,input,timeout,ceiling_ms';
            const rows = answers.map(a =>
                [a.day, a.ts, a.round_type, a.fact_id, a.given, a.correct, a.initiation_ms, a.typing_ms, a.input, a.timeout, a.ceiling_ms ?? ''].join(','));
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
