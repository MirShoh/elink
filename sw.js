const CACHE_NAME = 'elink-v7';

const PRECACHE = [
  '/style.css',
  '/widgets-style.css',
  '/manifest.json',
];

const NO_CACHE = [
  '/.netlify/',
  'supabase',
  'googletagmanager',
  'gtag',
  '/data.js',
  '/index.html',
  '/core.js',
  '/render.js',
  '/builder.js',
  '/widgets.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  if (NO_CACHE.some(p => url.includes(p))) return;

  const isExternal = (
    url.includes('fonts.googleapis') ||
    url.includes('fonts.gstatic') ||
    url.includes('s2/favicons') ||
    url.includes('cdnjs.cloudflare')
  );

  if (isExternal) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});