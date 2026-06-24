const CACHE_NAME = 'arz-mart-cache-v4';
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.png',
  '/logo.png'
];

// Install Event - cache core static resources and skip waiting
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activate Event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network-First Strategy for HTML/pages, Cache-First/Network-Fallback for other GET requests
self.addEventListener('fetch', (event) => {
  const isTargetApi = event.request.method === 'GET' && (
    event.request.url.includes('/api/products') ||
    event.request.url.includes('/api/categories')
  );

  if (isTargetApi) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Bypass other API requests, non-GET requests, and Chrome extensions/external sources
  if (
    event.request.method !== 'GET' || 
    event.request.url.includes('/api/') ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }

  const isHtmlRequest = event.request.headers.get('accept')?.includes('text/html') || 
                        event.request.url === self.location.origin + '/' ||
                        event.request.url.endsWith('.html');

  if (isHtmlRequest) {
    // Network-First strategy for HTML document requests to avoid caching outdated script/css hashes
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
  } else {
    // Cache-First, fall back to network for other static assets
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          });
        })
    );
  }
});
