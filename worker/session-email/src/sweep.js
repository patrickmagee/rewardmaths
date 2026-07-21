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

/**
 * @param {object} kv   KV-like: list({prefix,cursor}), get(key,'json'), put(key,str)
 * @param {object} opts { now, idleMs, dryRun }
 * @returns {Promise<{now,dryRun,idleMs,results:Array}>}
 *   Each result: { user, name, action:'notified'|'skipped', reason?, session? }
 */
export async function sweep(kv, opts = {}) {
    const now = opts.now ?? Date.now();
    const idleMs = opts.idleMs ?? DEFAULT_IDLE_MS;
    const dryRun = !!opts.dryRun;
    const results = [];

    for (const kid of await realKids(kv)) {
        const answers = await recentAnswers(kv, kid.user);
        const session = currentSession(answers, idleMs);

        if (!session) { results.push({ user: kid.user, name: kid.name, action: 'skipped', reason: 'no activity' }); continue; }
        if (now - session.lastTs < idleMs) {
            results.push({ user: kid.user, name: kid.name, action: 'skipped', reason: 'still playing', session });
            continue;
        }
        const wm = await kv.get(`notify:${kid.user}`, 'json');
        if (wm && wm.lastTs >= session.lastTs) {
            results.push({ user: kid.user, name: kid.name, action: 'skipped', reason: 'already emailed', session });
            continue;
        }

        if (!dryRun) {
            await kv.put(`notify:${kid.user}`, JSON.stringify({ lastTs: session.lastTs, emailedAt: now }));
        }
        results.push({ user: kid.user, name: kid.name, action: 'notified', session });
    }
    return { now, dryRun, idleMs, results };
}

/** Real children only — no admin, no test account. */
async function realKids(kv) {
    const kids = [];
    for await (const key of listKeys(kv, 'profile:')) {
        const p = await kv.get(key, 'json');
        if (p && p.user && p.role !== 'admin' && p.user !== 'test') {
            kids.push({ user: p.user, name: p.name || p.user });
        }
    }
    return kids;
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
