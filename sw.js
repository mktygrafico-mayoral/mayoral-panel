const CACHE_NAME = 'mayoral-v1';
const ASSETS = [
  '/mayoral-panel/dashboard.html',
  '/mayoral-panel/manifest.json'
];

// ── INSTALL: cache assets ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── FETCH: network first, fallback to cache ──
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// ── PUSH NOTIFICATIONS ──
self.addEventListener('push', e => {
  let data = { title: 'Mayoral Dashboard', body: 'Nueva actividad en tu panel.' };
  try { data = e.data.json(); } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/mayoral-panel/icon-192.png',
      badge: '/mayoral-panel/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: '/mayoral-panel/dashboard.html' }
    })
  );
});

// ── NOTIFICATION CLICK: open app ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('dashboard.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/mayoral-panel/dashboard.html');
      }
    })
  );
});

// ── BACKGROUND SYNC: check for new solicitudes ──
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-solicitudes') {
    e.waitUntil(checkNewSolicitudes());
  }
});

async function checkNewSolicitudes() {
  try {
    const SUPABASE_URL = 'https://icynathbxulsmzvkgzse.supabase.co';
    const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljeW5hdGhieHVsc216dmtnenNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTUzODMsImV4cCI6MjA5NTQ5MTM4M30.W9AsPH2rzm1aZaNsKiYzcrscJ6Be0jlZq2tW11GpVmY';
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/solicitudes?estado=eq.Pendiente&order=created_at.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_ANON, 'Authorization': 'Bearer ' + SUPABASE_ANON } }
    );
    const data = await r.json();
    if (data && data.length > 0) {
      const last = data[0];
      // Check if we already notified about this one
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match('last-notified-id');
      const lastId = cached ? await cached.text() : null;
      if (lastId !== String(last.id)) {
        await self.registration.showNotification('Nueva solicitud — Muebles Mayoral', {
          body: `${last.solicitante || 'Alguien'} solicitó: ${last.descripcion}`,
          icon: '/mayoral-panel/icon-192.png',
          badge: '/mayoral-panel/icon-192.png',
          vibrate: [200, 100, 200],
          data: { url: '/mayoral-panel/dashboard.html' }
        });
        await cache.put('last-notified-id', new Response(String(last.id)));
      }
    }
  } catch(err) {
    console.log('Sync error:', err);
  }
}
