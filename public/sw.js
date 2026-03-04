const CACHE = 'klok-v4';

// Core app shell resources to cache on install
const PRECACHE = [
    '/',
    '/landing',
    '/manifest.json',
    '/icon-192x192.png',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    // Remove old caches
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        ).then(() => clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Bypass cache for ALL API calls - always go to network
    if (url.pathname.startsWith('/api/') ||
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('upsahostels.com') ||
        url.hostname.includes('upsasip.com')) {
        e.respondWith(fetch(e.request));
        return;
    }

    // Network-first for HTML pages (don't cache HTML to avoid stale content)
    if (e.request.headers.get('accept')?.includes('text/html')) {
        e.respondWith(
            fetch(e.request).catch(() => caches.match('/'))
        );
        return;
    }

    // Cache-first for static assets (JS, CSS, images)
    e.respondWith(
        caches.match(e.request).then((cached) => {
            if (cached) return cached;
            return fetch(e.request).then((res) => {
                if (e.request.method === 'GET' && res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE).then((c) => c.put(e.request, clone));
                }
                return res;
            });
        })
    );
});
