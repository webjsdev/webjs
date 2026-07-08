# Service worker / offline primitive (opt-in, #271)

webjs ships a hand-authored service worker and an offline fallback into the UI
scaffolds (`public/sw.js`, `public/offline.html`; the full-stack and saas
templates, since the api template has no UI). It adds an offline experience
and an asset cache **without changing the JavaScript-disabled baseline**: the
worker only ever registers from JavaScript, so with JS off no worker exists and
pages, links, and forms behave exactly as before. It is **opt-in**: the files
ship dormant and do nothing until the app registers the worker.

This is a thin, hand-readable worker built directly on the native Service
Worker and Cache Storage APIs. There is no Workbox, no precache framework, and
no bundler step, matching webjs's no-build, close-to-web-standards posture.

## Enabling it (the opt-in registration snippet)

Add this inline script to the root layout's `<head>` (`app/layout.{js,ts}`). It
registers the worker after load, and only when JS is present, so it is
progressive-enhancement-safe:

```html
<script>
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
      // Tie the worker version to the deploy: read the importmap build id and
      // register /sw.js?v=<build>, so a new deploy registers a "new" worker.
      const tag = document.querySelector('script[type="importmap"]');
      const build = (tag && tag.dataset.webjsBuild) || '';
      navigator.serviceWorker.register('/sw.js' + (build ? '?v=' + build : ''));
    });
  }
</script>
```

With webjs's CSP enabled (`webjs.csp` in package.json), stamp the nonce on the
script. Read it in the layout with `import { cspNonce } from '@webjsdev/core'`
and emit `<script nonce="${cspNonce()}">…`.

## What the worker does (scope + strategy)

Registered from `/sw.js`, the worker's scope is the site root (`/`), so it sees
every navigation and same-origin asset request. Your worker file lives at
`public/sw.js`, and although most `public/*` assets serve at `/public/<name>`,
the framework serves this one (and `public/offline.html`) at the SITE ROOT with a
`Service-Worker-Allowed: /` header, so `register('/sw.js')` resolves to a 200 and
the worker controls the whole origin (#830).

- **Navigations are network-first.** The worker always tries the network first,
  so the user sees fresh server-rendered HTML, and caches each successful page
  (the SSR shell). When the network fails, it serves the cached page if you have
  visited it, otherwise `/offline.html`. Network-first means the cache never
  makes a page go stale; it is purely an offline safety net.
- **Static assets are stale-while-revalidate.** Same-origin modules (the per-file
  ESM the no-build runtime serves), the framework runtime under `/__webjs/core/`,
  vendor bundles under `/__webjs/vendor/`, and `public/` assets are served from
  cache when present and refreshed in the background. In production these URLs
  carry a `?v=<hash>` content fingerprint (#243), so a changed file gets a new
  URL and the cache can never serve stale bytes.

**Never cached:** non-GET requests (writes), cross-origin requests, the action
RPC endpoint (`/__webjs/action/`), and the dev-only `/__webjs/events` (SSE) and
`/__webjs/reload.js`.

## Versioning ties to the deploy (`data-webjs-build`)

The cache name is `webjs-<build>`, where `<build>` is the `?v=` query the
registration passes (the importmap build id read from
`data-webjs-build`). When a deploy changes the build id:

1. the page registers `/sw.js?v=<new-build>`, a different worker URL, so the
   browser fetches and installs the new worker;
2. the new worker's `activate` deletes every cache whose name is not the current
   `webjs-<new-build>`, evicting the prior deploy's cache.

So a deploy refreshes the offline cache automatically, with no manual cache
busting. Without a `?v=` (e.g. a dev registration), the cache name is
`webjs-dev`.

## Updating the worker itself

The browser re-checks `/sw.js` on navigation and replaces the worker when its
bytes change. Because the registration URL carries the build id, a deploy always
changes that URL and triggers the update. The worker calls `skipWaiting()` +
`clients.claim()`, so a new version takes control promptly. To change the
caching strategy, edit `public/sw.js`; it is your file, not a framework
internal.

## Removing it

Delete the registration snippet (and optionally `public/sw.js` /
`public/offline.html`). To also un-register an already-installed worker on
clients, ship a one-line `navigator.serviceWorker.getRegistrations().then(rs =>
rs.forEach(r => r.unregister()))` for a release, or rely on the worker's own
update lifecycle.

## Tests

`test/service-worker/sw.test.mjs` runs the REAL `public/sw.js` source in a
`node:vm` sandbox with mocked service-worker globals and drives its handlers:
the install precache, the activate cache eviction, the network-first navigation
(fresh + cached), the offline-cached + offline-fallback paths, and the
never-cache rules (non-GET, cross-origin, the RPC endpoint), plus
stale-while-revalidate. `test/scaffolds/scaffold-integration.test.js` asserts
both files ship into a scaffolded app.
