const CACHE = 'klok-v2';

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

    // Always fetch Firestore API calls from network (let Firestore SDK handle offline)
    if (url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('upsasip.com')) {
        return; // let browser/Firestore SDK handle these
    }

    // Cache-first for everything else (app shell, JS, CSS)
    e.respondWith(
        caches.match(e.request).then((cached) => {
            if (cached) return cached;
            return fetch(e.request).then((res) => {
                // Cache successful GET responses
                if (e.request.method === 'GET' && res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE).then((c) => c.put(e.request, clone));
                }
                return res;
            }).catch(() => {
                // Offline fallback — return cached index
                return caches.match('/') || new Response('You are offline.', {
                    headers: { 'Content-Type': 'text/plain' }
                });
            });
        })
    );
});
