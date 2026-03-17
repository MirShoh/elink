

const CACHE_NAME = 'elink-v4';


const PRECACHE = [
  '/style.css',
  '/manifest.json'
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
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});


self.addEventListener('fetch', e => {

  if(e.request.method !== 'GET') return;


  const url = e.request.url;
  if(url.includes('/.netlify/') || url.includes('supabase') ||
     url.includes('googletagmanager') || url.includes('gtag')) return;


     if(url.includes('/data.js') || url.includes('/script.js') || url.endsWith('/') || url.includes('/index.html')) return;


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