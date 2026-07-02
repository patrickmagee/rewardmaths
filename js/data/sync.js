/**
 * KV sync: local-first, best-effort, append-only union merge.
 * The server unions by answer id per (user, day); the client writes the
 * merged result back locally. State is never synced — it derives from the
 * merged log identically on every device (js/data/derive.js).
 */
import { putAnswers, getAnswers, getMeta, putMeta } from './db.js';
import { mergeAnswers } from './derive.js';

const API = '/api';
const TIMEOUT_MS = 4000;

async function fetchWithTimeout(url, options = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { ...options, signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Push a day's local answers, receive the server's merged day back, store it.
 * Safe to call repeatedly (idempotent). Returns false when offline.
 */
export async function syncDay(user, day) {
    try {
        const local = (await getAnswers(user)).filter(a => a.day === day);
        const merged = await fetchWithTimeout(`${API}/answers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, day, answers: local }),
        });
        if (Array.isArray(merged.answers)) await putAnswers(merged.answers);
        return true;
    } catch (err) {
        console.warn(`sync ${user}/${day} deferred:`, err.message);
        return false;
    }
}

/**
 * Full catch-up sync: pull every remote day, union with local, push any days
 * where local had records the server lacked. Called at app start and after
 * a period offline.
 */
export async function syncAll(user) {
    try {
        const remote = await fetchWithTimeout(`${API}/answers?user=${encodeURIComponent(user)}`);
        const local = await getAnswers(user);
        const remoteAnswers = Object.values(remote.days || {}).flat();
        const merged = mergeAnswers(local, remoteAnswers);
        await putAnswers(merged);

        // Push days where local knows more than the server.
        const remoteIds = new Set(remoteAnswers.map(a => a.id));
        const daysToPush = new Set(local.filter(a => !remoteIds.has(a.id)).map(a => a.day));
        for (const day of daysToPush) await syncDay(user, day);

        await putMeta(`lastSync:${user}`, Date.now());
        return true;
    } catch (err) {
        console.warn('syncAll deferred:', err.message);
        return false;
    }
}

/** Profiles: KV is authoritative (any-device login); local is the mirror. */
export async function syncProfiles(localProfiles) {
    try {
        const remote = await fetchWithTimeout(`${API}/profiles`);
        return Array.isArray(remote.profiles) ? remote.profiles : localProfiles;
    } catch {
        return localProfiles;
    }
}

export async function pushProfile(profile) {
    try {
        await fetchWithTimeout(`${API}/profiles`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile),
        });
        return true;
    } catch {
        return false;
    }
}

export { getMeta, putMeta };
