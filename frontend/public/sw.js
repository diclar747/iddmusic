// Service worker de IDD Music: la app abre rápido y funciona sin conexión con lo último que se vio.
// - Página (index.html): primero la red (siempre la versión nueva) y, sin conexión, la guardada.
// - /assets/ (archivos con hash): caché permanente.
// - Íconos e imágenes públicas: caché y se actualizan en segundo plano.
// - /api/: nunca se guarda (datos siempre frescos y privados).
// - Notificaciones push: versículo del día (al tocarla abre la app en esa pantalla).
const VERSION = 'sion-v8';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/sion-logo.png', '/icons/sion-mark.png'];

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
    e.respondWith(fetch(req).then(res => { if (url.pathname === '/' && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('/', copy)); } return res; })
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

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'SION Music', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: d.tag || 'sion',
    renotify: true,
    lang: 'es',
    data: { url: d.url || '/#/' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/#/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const app = list.find(c => new URL(c.url).origin === self.location.origin && !/#\/screen|cast=1/.test(c.url));
    if (app) return app.focus().then(c => c.navigate ? c.navigate(url) : c);
    return self.clients.openWindow(url);
  }));
});
