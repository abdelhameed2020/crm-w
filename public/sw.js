// CRM Awlad Yahya - Progressive Web App Service Worker
// Version: 1.0.0 (Build shell precache)

const CACHE_NAME = 'crm-awlad-yahya-v1';

// Static App Shell assets only - NEVER cache dynamic CRM data, Firebase queries, or Gateway messages
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg'
];

// Domains and paths that must ALWAYS bypass the cache (Network Only)
const NETWORK_ONLY_PATTERNS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'googleapis.com',
  'firebaseio.com',
  'google-analytics.com',
  '/api/',
  ':5001',
  'wa-gateway'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Precache skipped optional assets:', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Only process GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 2. Only handle http and https schemes
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
    return;
  }

  // 3. Strict security: Bypass any Firebase, Auth, CRM API, or Gateway endpoints
  const isNetworkOnly = NETWORK_ONLY_PATTERNS.some((pattern) => request.url.includes(pattern));
  if (isNetworkOnly) {
    return; // Handled directly by native browser network
  }

  // 4. Navigation requests (HTML pages): Network-First
  // Ensures user always gets the latest deployed code when online
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 5. Hashed Vite assets (/assets/*): Cache-First since filenames are immutable
  if (request.url.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 6. Icons & Fonts: Stale-While-Revalidate
  if (
    request.url.includes('/icons/') ||
    request.url.includes('fonts.googleapis.com') ||
    request.url.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default: Network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
