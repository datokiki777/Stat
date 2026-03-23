const CACHE_NAME = 'stat-app-v1.1.0';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './db.js',
    './manifest.json',
    './libs/papaparse.min.js',
    './libs/xlsx.full.min.js'
];

// Install event - cache core assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching core assets');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') {
        event.respondWith(fetch(event.request));
        return;
    }

    if (!event.request.url.startsWith(self.location.origin)) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;

                    const accept = event.request.headers.get('accept') || '';
                    if (accept.includes('text/html')) {
                        return caches.match('./index.html');
                    }

                    return new Response('Offline', {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                });
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames =>
            Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            )
        )
    );
});
