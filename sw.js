// Vapertize Service Worker — PWA support
// Strategy: Cache-first for static assets, Network-first for HTML/JSON
const CACHE_VERSION = 'vpz-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Core assets — pre-cached on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/catalog.html',
  '/contact.html',
  '/member.html',
  '/faq.html',
  '/manifest.json',
  '/assets/img/logo-128.webp?v=5',
  '/assets/img/logo-128.png?v=5',
  '/assets/img/logo-192.png?v=5',
  '/assets/img/logo-512.png?v=5'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin (Google Fonts, WhatsApp, etc.) — let browser handle
  if (url.origin !== self.location.origin) return;

  // Skip products.json — always fresh
  if (url.pathname.includes('products.json')) return;

  // HTML: network-first (so updates are immediate)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(request, copy));
          return resp;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // Static assets (CSS, JS, fonts, images): cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(STATIC_CACHE).then(c => c.put(request, copy));
        }
        return resp;
      });
    })
  );
});
