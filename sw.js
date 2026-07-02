/**
 * Service worker: cache-first for the static shell (offline play),
 * network-only for /api (sync must never serve stale data — the app already
 * degrades gracefully offline via IndexedDB).
 */
const CACHE = 'rewardmaths-v5-1';
const SHELL = [
    './', './index.html', './manifest.json', './favicon.svg', './css/v5.css',
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    if (url.pathname.startsWith('/api/')) return; // network-only
    if (e.request.method !== 'GET') return;
    e.respondWith(
        caches.match(e.request).then(hit => {
            const fetched = fetch(e.request).then(res => {
                if (res.ok && url.origin === location.origin) {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, copy));
                }
                return res;
            }).catch(() => hit);
            return hit || fetched;
        })
    );
});
