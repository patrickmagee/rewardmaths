/**
 * Service worker: network-first for everything (a deploy is visible on the
 * very next load), falling back to cache only when offline. /api is
 * network-only — sync must never serve stale data (the app already degrades
 * gracefully offline via IndexedDB).
 */
const CACHE = 'rewardmaths-v5-2';

self.addEventListener('install', (e) => {
    e.waitUntil(self.skipWaiting());
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
    if (e.request.method !== 'GET' || url.origin !== location.origin) return;
    e.respondWith(
        fetch(e.request).then(res => {
            if (res.ok) {
                const copy = res.clone();
                caches.open(CACHE).then(c => c.put(e.request, copy));
            }
            return res;
        }).catch(() =>
            caches.match(e.request).then(hit => hit ||
                caches.match('./index.html')) // offline navigation fallback
        )
    );
});
