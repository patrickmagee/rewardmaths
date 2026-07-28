/**
 * Core "a kid finished a session" logic, kept free of any Cloudflare globals so
 * it can be unit-tested against real logs with a fake KV (see ../test.mjs).
 *
 * A session is "finished" when a child who played today has now gone quiet for
 * IDLE_MS. We email the parent ONCE per session: a per-user watermark
 * (notify:<user> → { lastTs }) records the last answer we've already emailed
 * about, so a later session (whose lastTs is newer) triggers a fresh email but
 * the same session never does twice, no matter how often the cron runs.
 *
 * Everything works off the answer `ts` (epoch ms), so timezones never enter.
 */

export const DEFAULT_IDLE_MS = 20 * 60 * 1000;
// Day keys are written with the DEVICE's local calendar day (js/data/db.js
// todayStr) — the family's devices are all UK.
export const DEFAULT_TIME_ZONE = 'Europe/London';
// A finished session is only worth an email for a while. Beyond this we skip it
// (it's history, not "just finished") — which also stops first-activation from
// emailing about sessions already sitting in the log.
export const DEFAULT_MAX_STALE_MS = 3 * 60 * 60 * 1000;

/**
 * DECIDE who should be emailed — pure read, NO writes. The caller sends the
 * email and only then records the watermark, so a failed send is retried rather
 * than silently swallowed. The `notify:<user>` watermark (last emailed lastTs)
 * is read here to suppress repeats for a session already handled.
 *
 * @param {object} kv   KV-like: list({prefix,cursor}), get(key,'json')
 * @param {object} opts { now, idleMs, maxStaleMs, timeZone }
 * @returns {Promise<{now,idleMs,results:Array}>}
 *   Each result: { user, name, action:'notify'|'skip', reason?, session? }
 */
export async function sweep(kv, opts = {}) {
    const now = opts.now ?? Date.now();
    const idleMs = opts.idleMs ?? DEFAULT_IDLE_MS;
    const maxStaleMs = opts.maxStaleMs ?? DEFAULT_MAX_STALE_MS;
    const timeZone = opts.timeZone ?? DEFAULT_TIME_ZONE;
    const results = [];

    for (const kid of await realKids(kv)) {
        const base = { user: kid.user, name: kid.name };
        const session = currentSession(await recentAnswers(kv, kid.user, now, timeZone), idleMs);

        if (!session) { results.push({ ...base, action: 'skip', reason: 'no activity' }); continue; }
        const idle = now - session.lastTs;
        if (idle < idleMs) { results.push({ ...base, action: 'skip', reason: 'still playing', session }); continue; }
        if (idle > maxStaleMs) { results.push({ ...base, action: 'skip', reason: 'session too old', session }); continue; }

        const wm = await kv.get(`notify:${kid.user}`, 'json');
        if (wm && wm.lastTs >= session.lastTs) { results.push({ ...base, action: 'skip', reason: 'already emailed', session }); continue; }

        results.push({ ...base, action: 'notify', session });
    }
    return { now, idleMs, results };
}

/** Watermark key for a user's last-emailed session. */
export const notifyKey = user => `notify:${user}`;

/** Every player profile (includes the test account; excludes the parent/admin). */
async function realKids(kv) {
    const kids = [];
    for await (const key of listKeys(kv, 'profile:')) {
        const p = await kv.get(key, 'json');
        if (p && p.user && p.role !== 'admin') {
            kids.push({ user: p.user, name: p.name || p.user });
        }
    }
    return kids;
}

/**
 * Who a given child's email goes to. Everyone goes to NOTIFY_TO; EXTRA_TO is a
 * JSON map of per-user *additional* addresses ({"eliza":["x@y"]}). The base
 * address is always first — the caller treats it as primary (its success
 * decides the watermark), so a blocked extra can't stop the main email or wedge
 * the session into endless retries.
 * @param {string} user
 * @param {{notifyTo?:string, extraTo?:string}} env
 * @returns {string[]}
 */
export function recipientsFor(user, { notifyTo, extraTo } = {}) {
    const base = notifyTo ? [notifyTo] : [];
    let extra = [];
    try { extra = (JSON.parse(extraTo || '{}')[user]) || []; } catch { /* bad JSON → no extras */ }
    return [...new Set([...base, ...extra.filter(Boolean)])];
}

/**
 * Answers from yesterday's/today's/tomorrow's day-keys, COMPUTED from `now`
 * rather than discovered via list(): KV list ops are capped at 1000/day on the
 * free tier and a list-per-child-per-cron blew through it (Cloudflare alert
 * 2026-07-22). Yesterday covers a session straddling midnight; tomorrow covers
 * a device clock ahead of the worker. Anything older is beyond maxStaleMs
 * anyway. Gets are effectively free (100k/day).
 */
async function recentAnswers(kv, user, now, timeZone) {
    const out = [];
    for (const offset of [-1, 0, 1]) {
        const day = dayStr(now + offset * 86400000, timeZone);
        const arr = await kv.get(`answers:${user}:${day}`, 'json');
        if (Array.isArray(arr)) out.push(...arr);
    }
    return out;
}

/** yyyy-mm-dd for an epoch-ms instant in a time zone (en-CA formats ISO-style). */
function dayStr(ts, timeZone) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(ts));
}

/**
 * The current (latest) session: the maximal trailing run of answers whose
 * consecutive gaps are all ≤ idleMs. Returns null if there are no answers.
 *
 * `answered` counts every RECORD, which is why it rarely equals rounds×10:
 *  - a timeout is a record (correct:false, given:null) — it is a miss, not an
 *    unanswered question, so it sits in both numerator-denominator of accuracy;
 *  - every missed fact comes back once in the same round (`requeued`), adding a
 *    record above the 10 planned items;
 *  - a sprint round is 60s of whatever fits, not 10 items.
 * The email prints `timeouts`/`retries` so the parent can reconstruct that
 * arithmetic instead of guessing at it.
 */
export function currentSession(answers, idleMs) {
    const ts = answers.map(a => a.ts).filter(Number.isFinite).sort((a, b) => a - b);
    if (!ts.length) return null;

    let startTs = ts[ts.length - 1];
    for (let i = ts.length - 1; i > 0; i--) {
        if (ts[i] - ts[i - 1] <= idleMs) startTs = ts[i - 1];
        else break;
    }
    const inSession = answers.filter(a => a.ts >= startTs);
    const rounds = new Set(inSession.map(a => a.round_id)).size;
    const answered = inSession.length;
    const correct = inSession.filter(a => a.correct === true).length;
    const timeouts = inSession.filter(a => a.timeout === true).length;
    const retries = inSession.filter(a => a.requeued === true).length;
    return { startTs, lastTs: ts[ts.length - 1], rounds, answered, correct, timeouts, retries };
}

/** Async generator over all key names for a prefix, following the list cursor. */
async function* listKeys(kv, prefix) {
    let cursor;
    do {
        const page = await kv.list({ prefix, cursor });
        for (const k of page.keys) yield k.name;
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
}

/** Plain-text email body — a nudge, not a report. Dashboard is the full picture. */
export function renderEmail(kid, session, opts = {}) {
    const tz = opts.timeZone || 'Europe/London';
    const fmt = ts => new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, weekday: 'short', day: 'numeric', month: 'short',
        hour: 'numeric', minute: '2-digit',
    }).format(new Date(ts));
    // Plain ASCII only — fancy dashes (—/–) can arrive as � depending on the
    // send path, and this is a throwaway nudge, so there's nothing to gain.
    const time = session.startTs === session.lastTs
        ? fmt(session.lastTs)
        : `${fmt(session.startTs)} to ${new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(session.lastTs))}`;
    const acc = session.answered ? Math.round(100 * session.correct / session.answered) : 0;
    const dash = opts.dashboardUrl || 'https://rewardmaths.com/admin.html';
    // Missed = everything not right. Split it, because "ran out of time" and
    // "gave the wrong number" read very differently to a parent — and both are
    // inside the % above, which was the thing that looked wrong from outside.
    const timeouts = session.timeouts || 0;
    const retries = session.retries || 0;
    const missed = session.answered - session.correct;
    const missedLine = missed === 0
        ? `  Missed:  0`
        : timeouts === 0
            ? `  Missed:  ${missed} (all answered, none timed out)`
            : `  Missed:  ${missed} (${missed - timeouts} answered wrong, ${timeouts} ran out of time)`;
    return [
        `${kid.name} finished a maths session.`,
        ``,
        `  When:    ${time}`,
        `  Rounds:  ${session.rounds}`,
        `  Answers: ${session.answered} (${session.correct} right, ${acc}%)`,
        missedLine,
        ...(retries ? [
            ``,
            `${retries} of those ${session.answered} were second goes: a missed fact comes`,
            `straight back once in the same round, so a round can log more than 10.`,
        ] : []),
        ``,
        `Full picture: ${dash}`,
        ``,
        `- RewardMaths`,
    ].join('\n');
}
