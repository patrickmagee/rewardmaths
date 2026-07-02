/**
 * IndexedDB layer (browser-only; the pure logic lives in derive.js/sync.js).
 * Stores: answers (by user+day), profiles, meta (typing baselines, sync
 * cursors, cached derived state).
 */
const DB_NAME = 'RewardMathsV5';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('answers')) {
                const s = db.createObjectStore('answers', { keyPath: 'id' });
                s.createIndex('user_day', ['user', 'day']);
                s.createIndex('user', 'user');
            }
            if (!db.objectStoreNames.contains('profiles')) {
                db.createObjectStore('profiles', { keyPath: 'user' });
            }
            if (!db.objectStoreNames.contains('meta')) {
                db.createObjectStore('meta', { keyPath: 'key' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

function tx(db, store, mode, fn) {
    return new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const result = fn(t.objectStore(store));
        t.oncomplete = () => resolve(result?.result ?? result);
        t.onerror = () => reject(t.error);
    });
}

/** Unique, sortable answer id: timestamp + random suffix. */
export function makeId(ts = Date.now()) {
    return `${ts.toString(36).padStart(9, '0')}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Today's local day string (device-local calendar day). */
export function todayStr(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function putAnswers(answers) {
    const db = await openDb();
    return tx(db, 'answers', 'readwrite', s => { for (const a of answers) s.put(a); });
}

export async function getAnswers(user, { sinceDay = null } = {}) {
    const db = await openDb();
    const all = await tx(db, 'answers', 'readonly', s => {
        return new Promise((resolve, reject) => {
            const out = [];
            const idx = s.index('user');
            const req = idx.openCursor(IDBKeyRange.only(user));
            req.onsuccess = () => {
                const c = req.result;
                if (!c) return resolve(out);
                out.push(c.value);
                c.continue();
            };
            req.onerror = () => reject(req.error);
        });
    });
    const list = await all;
    return sinceDay ? list.filter(a => a.day >= sinceDay) : list;
}

/** Delete every stored answer for one user (test-account reset). */
export async function deleteAnswers(user) {
    const db = await openDb();
    return tx(db, 'answers', 'readwrite', s => new Promise((resolve, reject) => {
        const req = s.index('user').openCursor(IDBKeyRange.only(user));
        req.onsuccess = () => {
            const c = req.result;
            if (!c) return resolve();
            c.delete();
            c.continue();
        };
        req.onerror = () => reject(req.error);
    }));
}

export async function getProfiles() {
    const db = await openDb();
    return tx(db, 'profiles', 'readonly', s => new Promise((resolve, reject) => {
        const req = s.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    })).then(p => p);
}

export async function putProfile(profile) {
    const db = await openDb();
    return tx(db, 'profiles', 'readwrite', s => s.put(profile));
}

export async function getMeta(key, fallback = null) {
    const db = await openDb();
    const v = await tx(db, 'meta', 'readonly', s => new Promise((resolve, reject) => {
        const req = s.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    }));
    return v ? v.value : fallback;
}

export async function putMeta(key, value) {
    const db = await openDb();
    return tx(db, 'meta', 'readwrite', s => s.put({ key, value }));
}
