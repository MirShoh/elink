// ═══════════════════════════════════════════════════════════
//  SERVICE WORKER — Elink UZ PWA
//  Offline rejim + tezkor yuklanish uchun kesh
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'elink-v2';

// Darhol keshlanadigan asosiy fayllar
const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/data.js',
  '/script.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js'
];

// ── O'rnatish: asosiy fayllarni keshlash ─────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Faollashtirish: eski keshlarni tozalash ──────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Network first, keyin kesh ────────────────────
self.addEventListener('fetch', e => {
  // Faqat GET so'rovlarini boshqarish
  if(e.request.method !== 'GET') return;

  // Supabase / Netlify funksiyalarini keshlamaslik
  const url = e.request.url;
  if(url.includes('/.netlify/') || url.includes('supabase') ||
     url.includes('googletagmanager') || url.includes('gtag')) return;

  // Rasmlar va shriftlar: kesh birinchi
  if(url.includes('fonts.googleapis') || url.includes('fonts.gstatic') ||
     url.includes('s2/favicons') || url.includes('cdnjs.cloudflare')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if(cached) return cached;
        return fetch(e.request).then(res => {
          if(res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Asosiy sahifa va fayllar: network birinchi, offline uchun kesh
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if(res && res.status === 200 && e.request.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
