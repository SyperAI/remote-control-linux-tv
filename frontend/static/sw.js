const CACHE_NAME = 'remote-v1';

self.addEventListener('install', (e) => {
    // Optional: caching basic UI assets if you want the app to open offline.
    // However, since we depend on the local backend to do anything,
    // we only do minimal network-first or pass-through.
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});

// Network-first policy to ensure they always get the latest layout,
// but fulfilling basic PWA criteria.
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request);
        })
    );
});
