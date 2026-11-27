// Service worker de IDD Music: la app abre rápido y funciona sin conexión con lo último que se vio.
// - Página (index.html): primero la red (siempre la versión nueva) y, sin conexión, la guardada.
// - /assets/ (archivos con hash): caché permanente.
// - Íconos e imágenes públicas: caché y se actualizan en segundo plano.
// - /api/: nunca se guarda (datos siempre frescos y privados).
const VERSION = 'idd-v3';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/flames-gold.png', '/logo-iglesia-original.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('/', copy)); return res; })
      .catch(() => caches.match('/')));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
