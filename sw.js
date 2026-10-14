/* App shell for FitLapse. Photos stay in the page and are never cached here. */
const CACHE = 'fitlapse-shell-v1';
const SHELL = [
    './',
    'index.html',
    'style.css',
    'script.js',
    'themes.js',
    'gif.js',
    'gif.worker.js',
    'manifest.json',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-192.png',
    'icons/icon-maskable-512.png',
    'apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    let url;
    try {
        url = new URL(request.url);
    } catch (error) {
        return;
    }
    if (url.origin !== self.location.origin) return;

    event.respondWith((async () => {
        try {
            const response = await fetch(request);
            if (response && response.ok && response.type === 'basic') {
                const cache = await caches.open(CACHE);
                cache.put(request, response.clone());
            }
            return response;
        } catch (error) {
            const cached = await caches.match(request);
            if (cached) return cached;
            if (request.mode === 'navigate') {
                const shell = await caches.match('index.html');
                if (shell) return shell;
            }
            throw error;
        }
    })());
});
