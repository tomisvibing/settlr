/* settlr's service worker: shows push notifications and opens the app where they point. It doesn't
   cache anything, so the app always loads fresh */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d;
  try{ d = e.data ? e.data.json() : {}; }catch(err){ d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'settlr', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag, data: { url: d.url || '' },
  }));
});

/* Tapping a notification: bring an open settlr to the front at that page, or open one */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || '', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    if(open){ open.postMessage({ go: url }); return open.focus(); }
    return self.clients.openWindow(url);
  }));
});
