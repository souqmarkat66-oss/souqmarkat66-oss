// Service Worker — Souq Ads Network
// v3 — Force cache bust 2026-05-09 — frontend redeployed

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Allow main.tsx to trigger skipWaiting from the page
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  // Pass all requests through — do NOT cache
  // index.html served with no-cache headers from Express
});

self.addEventListener('push', event => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'سوق للإعلانات', body: event.data.text() };
  }
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    data: { url: data.link || data.url || '/' },
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'close', title: 'إغلاق' },
    ],
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'سوق للإعلانات', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'close') return;
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) { client.focus(); return; }
      }
      clients.openWindow(url);
    })
  );
});
