// service-worker.js - improved caching strategy
const CACHE_NAME = 'ingredients-pwa-v2'; // bump this when you change cached assets
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './icons/icon-92.png',
  './icons/icon-12.png',
];

// install -> pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  // Activate new SW immediately (skip waiting)
  self.skipWaiting();
});

// activate -> cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
        return Promise.resolve();
      }))
    ).then(() => {
      // Take control of uncontrolled clients as soon as the SW activates
      return self.clients.claim();
    })
  );
});

// fetch -> network-first for HTML/CSS/JS, cache-first for others
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET requests via cache
  if (req.method !== 'GET') return;

  // network-first for HTML/CSS/JS (helps during development & deploys)
  if (
    req.destination === 'document' ||
    req.destination === 'script' ||
    req.destination === 'style' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          // update cache with fresh response (clone first)
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return networkRes;
        })
        .catch(() => caches.match(req).then((cached) => cached || Promise.reject('no-match')))
    );
    return;
  }

  // For images and other assets: cache-first, fallback to network
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((networkRes) => {
        // optionally cache the new resource for next time
        return caches.open(CACHE_NAME).then((cache) => {
          // try/catch to avoid failing fetch if cache.put rejects
          try { cache.put(req, networkRes.clone()); } catch (e) {}
          return networkRes;
        });
      });
    }).catch(() => {
      // final fallback: if nothing, return an offline image/response if you have one
      return new Response('', { status: 504, statusText: 'Offline' });
    })
  );
});

// notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});
