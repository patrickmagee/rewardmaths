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
 * @param {object} opts { now, idleMs, maxStaleMs }
 * @returns {Promise<{now,idleMs,results:Array}>}
 *   Each result: { user, name, action:'notify'|'skip', reason?, session? }
 */
export async function sweep(kv, opts = {}) {
    const now = opts.now ?? Date.now();
    const idleMs = opts.idleMs ?? DEFAULT_IDLE_MS;
    const maxStaleMs = opts.maxStaleMs ?? DEFAULT_MAX_STALE_MS;
    const results = [];

    for (const kid of await realKids(kv)) {
        const base = { user: kid.user, name: kid.name };
        const session = currentSession(await recentAnswers(kv, kid.user), idleMs);

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

/** Answers from the two most recent day-keys (covers a session straddling midnight). */
async function recentAnswers(kv, user) {
    const prefix = `answers:${user}:`;
    const dayKeys = [];
    for await (const key of listKeys(kv, prefix)) dayKeys.push(key);
    dayKeys.sort();                       // yyyy-mm-dd sorts lexically = chronologically
    const recent = dayKeys.slice(-2);
    const out = [];
    for (const key of recent) {
        const arr = await kv.get(key, 'json');
        if (Array.isArray(arr)) out.push(...arr);
    }
    return out;
}

/**
 * The current (latest) session: the maximal trailing run of answers whose
 * consecutive gaps are all ≤ idleMs. Returns null if there are no answers.
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
    return { startTs, lastTs: ts[ts.length - 1], rounds, answered, correct };
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
    const time = session.startTs === session.lastTs
        ? fmt(session.lastTs)
        : `${fmt(session.startTs)} – ${new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(session.lastTs))}`;
    const acc = session.answered ? Math.round(100 * session.correct / session.answered) : 0;
    const dash = opts.dashboardUrl || 'https://rewardmaths.com/admin.html';
    return [
        `${kid.name} finished a maths session.`,
        ``,
        `  When:    ${time}`,
        `  Rounds:  ${session.rounds}`,
        `  Answers: ${session.answered} (${session.correct} right, ${acc}%)`,
        ``,
        `Full picture: ${dash}`,
        ``,
        `— RewardMaths`,
    ].join('\n');
}
