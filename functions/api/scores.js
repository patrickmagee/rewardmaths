/**
 * Cloudflare Pages Function: /api/scores
 *
 * Shared score history backed by Cloudflare KV so scores persist across devices.
 * KV binding: env.SCORES (see wrangler.toml).
 *
 * Key scheme: `scores:<category>:<user_id>` -> JSON array of score objects,
 * kept best-first and capped, so a per-user history read is a single KV get.
 *
 * Score object shape (matches js/storage.js):
 *   { user_id, category, score, time_ms, played_at }
 *
 * Routes:
 *   GET  /api/scores?user_id=&category=  -> that user's history for the category
 *   GET  /api/scores?all=1               -> every score (admin dashboard stats)
 *   POST /api/scores  { user_id, category, score, time_ms, played_at? }
 */

const PER_USER_CAP = 50; // max stored scores per user+category

const JSON_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

/**
 * Build the KV key for a user's scores in a category.
 * @param {string} category
 * @param {string} userId
 * @returns {string}
 */
function userKey(category, userId) {
    return `scores:${category}:${userId}`;
}

/**
 * List every score key, following the KV list cursor to completion.
 * @param {{ SCORES: KVNamespace }} env
 * @returns {Promise<Array<{name: string}>>}
 */
async function listAllScoreKeys(env) {
    const keys = [];
    let cursor;
    do {
        const page = await env.SCORES.list({ prefix: 'scores:', cursor });
        keys.push(...page.keys);
        cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return keys;
}

/**
 * Sort scores best-first: higher score, then faster time.
 * @param {Array<Object>} scores
 * @returns {Array<Object>}
 */
function sortBest(scores) {
    return scores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.time_ms || 0) - (b.time_ms || 0);
    });
}

/**
 * @param {Object} data
 * @param {number} [status=200]
 * @returns {Response}
 */
function json(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

/** CORS preflight. */
export function onRequestOptions() {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
}

/**
 * GET handler - per-user category history, or the full admin dump (?all=1).
 * @param {{ request: Request, env: { SCORES: KVNamespace } }} context
 */
export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const userId = url.searchParams.get('user_id');

    try {
        // Admin dump: every score across all users/categories, for dashboard stats.
        // Corrupt values are skipped so one bad key can't 500 the whole response.
        if (url.searchParams.get('all')) {
            const keys = await listAllScoreKeys(env);
            const all = [];
            for (const k of keys) {
                const raw = await env.SCORES.get(k.name);
                if (!raw) continue;
                try {
                    all.push(...JSON.parse(raw));
                } catch {
                    /* skip corrupt entry */
                }
            }
            return json(all);
        }

        if (!category || !userId) {
            return json({ error: 'category and user_id are required' }, 400);
        }

        // Per-user history: single KV read.
        const raw = await env.SCORES.get(userKey(category, userId));
        const scores = raw ? JSON.parse(raw) : [];
        return json(sortBest(scores));
    } catch (err) {
        return json({ error: err.message }, 500);
    }
}

/**
 * POST handler - append a score to a user's category list.
 * @param {{ request: Request, env: { SCORES: KVNamespace } }} context
 */
export async function onRequestPost({ request, env }) {
    let body;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'invalid JSON body' }, 400);
    }

    const { user_id, category } = body;
    if (!user_id || !category) {
        return json({ error: 'user_id and category are required' }, 400);
    }

    const entry = {
        user_id,
        category,
        score: Number(body.score) || 0,
        time_ms: Number(body.time_ms) || 0,
        played_at: body.played_at || new Date().toISOString()
    };

    try {
        const key = userKey(category, user_id);
        const raw = await env.SCORES.get(key);
        const scores = raw ? JSON.parse(raw) : [];
        scores.push(entry);
        const trimmed = sortBest(scores).slice(0, PER_USER_CAP);
        await env.SCORES.put(key, JSON.stringify(trimmed));
        return json({ ok: true, saved: entry });
    } catch (err) {
        return json({ error: err.message }, 500);
    }
}
