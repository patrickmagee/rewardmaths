/**
 * Cloudflare Pages Function: profiles in KV so avatar+PIN login works from
 * any device (v4 kept profiles device-local; that limitation dies in v5).
 *
 * Key scheme: profile:<user> → { user, name, avatar, pinHash, role, dob,
 *                                settings: {...}, updated }
 * PIN/password stored as SHA-256 hex (home-app threat model).
 *
 * Routes:
 *   GET /api/profiles          → { profiles: [...] }
 *   PUT /api/profiles          → upsert one profile (last-write-wins by `updated`)
 */

const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const USER_RE = /^[\w.-]{1,40}$/;

export async function onRequestGet({ env }) {
    const profiles = [];
    let cursor;
    do {
        const page = await env.SCORES.list({ prefix: 'profile:', cursor });
        for (const k of page.keys) {
            try {
                const v = await env.SCORES.get(k.name, 'json');
                if (v && v.user) profiles.push(v);
            } catch { /* skip corrupt value */ }
        }
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return json({ profiles });
}

export async function onRequestPut({ request, env }) {
    let p;
    try {
        p = await request.json();
    } catch {
        return json({ error: 'bad json' }, 400);
    }
    if (!p || !p.user || !USER_RE.test(p.user)) return json({ error: 'bad user' }, 400);

    const key = `profile:${p.user}`;
    const existing = await env.SCORES.get(key, 'json').catch(() => null);
    // Clamp client timestamps to server time (+small skew) — one device with
    // a future clock must never wedge a profile against all later edits.
    const maxUpdated = Date.now() + 60000;
    p.updated = Math.min(Number(p.updated) || Date.now(), maxUpdated);
    const existingUpdated = existing
        ? Math.min(Number(existing.updated) || 0, maxUpdated) : 0;
    // Last-write-wins on the `updated` stamp; never regress.
    if (existing && existingUpdated > p.updated) {
        return json({ profile: existing, kept: 'existing' });
    }
    await env.SCORES.put(key, JSON.stringify(p));
    return json({ profile: p });
}
