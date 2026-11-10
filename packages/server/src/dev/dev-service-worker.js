/**
 * The service worker `webjs dev` serves at `/sw.js` (#1689): a kill switch,
 * the default of next-pwa and vite-plugin-pwa in development.
 *
 * A caching worker on a dev origin makes every edit look like it did nothing.
 * The scaffold's `public/sw.js` serves `.js` and `.css` stale-while-revalidate,
 * so a tab that once registered it (a `webjs start` on the same port, an app
 * that registers on every load) is one edit behind forever, and the reload
 * client's own probes go through it too. So under `webjs dev` the `/sw.js` URL
 * answers with this worker whether or not the app has one. It takes over at
 * once, deletes every cache it can see, unregisters itself, and claims the open
 * tabs so the next request goes to the network. It has no `fetch` listener, so
 * it never answers a request even in the moment before it unregisters.
 *
 * Production serves the app's own `public/sw.js` unchanged. Offline behaviour
 * is tested with `npm run start`, which the log line says.
 */
export const DEV_SERVICE_WORKER_SOURCE = `// webjs dev: the service worker is switched off (#1689)
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (_) { /* no CacheStorage: nothing to clear */ }
    try { await self.registration.unregister(); } catch (_) { /* already gone */ }
    try { await self.clients.claim(); } catch (_) { /* no clients */ }
    console.info('[webjs] the service worker is off under webjs dev; test offline behaviour with npm run start');
  })());
});
`;

/**
 * The `/sw.js` response under `webjs dev`. `no-store`, so a browser never runs
 * a cached copy, and `Service-Worker-Allowed: /` so it can replace a worker
 * registered at the root scope.
 * @returns {Response}
 */
export function devServiceWorkerResponse() {
  return new Response(DEV_SERVICE_WORKER_SOURCE, {
    status: 200,
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
      'service-worker-allowed': '/',
    },
  });
}
