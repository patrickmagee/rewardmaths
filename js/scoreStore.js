/**
 * Remote Score Store
 *
 * Thin adapter over the /api/scores Pages Function (Cloudflare KV backed).
 * Lets score history persist across devices. Callers (js/storage.js) use this
 * as the primary store and fall back to local IndexedDB when the fetch fails
 * (e.g. offline or running the static files without the Function).
 */

const API_BASE = '/api/scores';
const FETCH_TIMEOUT_MS = 4000;

/**
 * fetch with a timeout so an unreachable API fails fast to the local fallback.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Append a score to the shared store.
 * @param {{user_id: string, category: string, score: number, time_ms: number, played_at?: string}} score
 * @returns {Promise<boolean>} true if the remote write succeeded
 */
export async function remoteSaveScore(score) {
    const res = await fetchWithTimeout(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(score)
    });
    if (!res.ok) throw new Error(`POST /api/scores ${res.status}`);
    return true;
}

/**
 * Get a user's score history for a category, best-first.
 * @param {string} userId
 * @param {string} category
 * @returns {Promise<Array<Object>>}
 */
export async function remoteGetScores(userId, category) {
    const url = `${API_BASE}?category=${encodeURIComponent(category)}&user_id=${encodeURIComponent(userId)}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`GET /api/scores ${res.status}`);
    return res.json();
}

/**
 * Get every stored score across all users/categories (admin dashboard stats).
 * @returns {Promise<Array<Object>>}
 */
export async function remoteGetAllScores() {
    const res = await fetchWithTimeout(`${API_BASE}?all=1`);
    if (!res.ok) throw new Error(`GET /api/scores?all ${res.status}`);
    return res.json();
}
