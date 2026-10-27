// Bump this version with every app-shell release. Never cache cloud/auth requests.
const CACHE = 'paramount-mark-full-showcase-v1';
const ASSETS = ["./index.html", "./index-3.html", "./academy.js", "./academy.css", "./app-updates.js", "./main-app.js", "./main-app.css", "./showcase.css", "./showcase-guard.js", "./showcase-seed.js", "./manifest.webmanifest", "./icon-192.png", "./templates/Paramount_Invoice_Editable.docx", "./templates/Paramount_Quotation_Editable.docx", "./templates/Paramount_Quotation_Fillable.pdf", "./templates/Paramount_Invoice_Fillable.pdf"];
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
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const canonical = shell.get(url.pathname);
  if (url.origin !== self.location.origin) { event.respondWith(Promise.resolve(new Response('External access disabled', {status:403}))); return; }
  if (event.request.method !== 'GET' || !canonical) return;
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



