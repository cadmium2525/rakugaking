// Build replaces these markers with a content hash and the complete static asset list.
const VERSION = '__BUILD_VERSION__';
const FILES = __PRECACHE_FILES__;
const PREFIX = `rakuga:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;
const urls = FILES.map((path) => new URL(path, self.registration.scope).href);
const home = new URL('./', self.registration.scope).href;

self.addEventListener('install', (event) => {
  // Atomic installation: failed downloads leave the previous worker in place.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(urls)));
  // No skipWaiting: a new release never takes over a running game.
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isHome =
    request.mode === 'navigate' &&
    (url.origin + url.pathname === home || url.origin + url.pathname === home + 'index.html');
  if (!isHome && !urls.includes(url.href)) return;
  // Cache only this release's app shell. Ranking API requests are never intercepted.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(isHome ? home : request);
      return cached || fetch(request);
    })(),
  );
});
