// Bump this version with every app-shell release. Never cache cloud/auth requests.
const CACHE = 'paramount-shell-academy-v3';
const ASSETS = ['./index.html', './index-3.html', './academy.js', './academy.css', './app-updates.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const shell = new Map(ASSETS.map(path => [new URL(path, self.registration.scope).pathname, new URL(path, self.registration.scope).href]));
shell.set(new URL('./', self.registration.scope).pathname, new URL('./index.html', self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // Wait for explicit user consent before replacing an active worker.
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key =>
    key !== CACHE && (key.startsWith('paramount-demo-') || key.startsWith('paramount-shell-'))
  ).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const canonical = shell.get(url.pathname);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !canonical) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request, {cache:'no-store'});
      if (!response.ok) return (await cache.match(canonical)) || response;
      // A quota/storage failure must not discard a successful download.
      try { await cache.put(canonical, response.clone()); } catch {}
      return response;
    } catch (error) {
      const cached = await cache.match(canonical);
      if (cached) return cached;
      throw error;
    }
  })());
});

