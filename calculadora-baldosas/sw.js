const CACHE = 'nexa-v20260806-user-skip';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/auth/supabase-config.js',
  './js/auth/auth.js',
  './js/core/tile-calc.js',
  './js/core/plan-viewer.js',
  './js/core/photo-measure.js',
  './js/data/storage.js',
  './js/data/cloud-storage.js',
  './js/export/export-excel.js',
  './js/app/main.js',
  './manifest.json',
  './assets/icons/icon.svg',
  './assets/icons/nexa-logo.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/images/piso-rejilla.jpg',
  './assets/images/piso-rejilla-foto2.jpg',
  './assets/images/piso-trama.jpg',
  './assets/images/piso-trama-v2.jpg',
  './assets/images/piso-moneda.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => cached)
    )
  );
});
