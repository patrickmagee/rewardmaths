/**
 * Cloudflare Pages Function: shared per-answer log over KV (binding: SCORES).
 *
 * Key scheme: answers:<user>:<yyyy-mm-dd> → JSON array of answer records.
 * Union-merge by answer id — append-only, idempotent, order-independent.
 *
 * Routes:
 *   GET  /api/answers?user=X            → { days: { day: [answers] } } (all days)
 *   GET  /api/answers?user=X&day=D      → { day, answers }
 *   POST /api/answers { user, day, answers } → merged { day, answers }
 *
 * No auth (home use, no PII beyond first names — same stance as v4).
 */

const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const keyFor = (user, day) => `answers:${user}:${day}`;

const USER_RE = /^[\w.-]{1,40}$/;

/** Real calendar date, not just the right shape (rejects 2026-99-99). */
function validDay(day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const d = new Date(day + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const user = url.searchParams.get('user');
    const day = url.searchParams.get('day');
    if (!user || !USER_RE.test(user)) return json({ error: 'bad user' }, 400);

    if (day) {
        if (!validDay(day)) return json({ error: 'bad day' }, 400);
        const answers = await readDay(env, user, day);
        return json({ day, answers });
    }

    // All days for the user: follow the list cursor to completion; skip
    // corrupt values (one bad key must not 500 the response).
    const days = {};
    let cursor;
    do {
        const page = await env.SCORES.list({ prefix: `answers:${user}:`, cursor });
        for (const k of page.keys) {
            const d = k.name.slice(`answers:${user}:`.length);
            try {
                const v = await env.SCORES.get(k.name, 'json');
                if (Array.isArray(v)) days[d] = v;
            } catch { /* skip corrupt value */ }
        }
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return json({ user, days });
}

export async function onRequestPost({ request, env }) {
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'bad json' }, 400);
    }
    const { user, day, answers } = body || {};
    if (!user || !USER_RE.test(user)) return json({ error: 'bad user' }, 400);
    if (!day || !validDay(day)) return json({ error: 'bad day' }, 400);
    if (!Array.isArray(answers)) return json({ error: 'answers must be an array' }, 400);

    const existing = await readDay(env, user, day);
    const merged = unionById(existing, answers.filter(validAnswer));
    await env.SCORES.put(keyFor(user, day), JSON.stringify(merged));
    return json({ day, answers: merged });
}

async function readDay(env, user, day) {
    try {
        const v = await env.SCORES.get(keyFor(user, day), 'json');
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

function unionById(a, b) {
    const seen = new Map();
    for (const x of [...a, ...b]) if (x && x.id && !seen.has(x.id)) seen.set(x.id, x);
    return [...seen.values()].sort((x, y) => (x.ts - y.ts) || (x.id < y.id ? -1 : 1));
}

function validAnswer(a) {
    return a && typeof a.id === 'string' && typeof a.fact_id === 'string' &&
        Number.isFinite(a.ts) && Number.isFinite(a.initiation_ms);
}
