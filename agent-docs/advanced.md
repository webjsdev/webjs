# Advanced features

## Streaming SSR / Suspense

```js
import { html, Suspense } from '@webjsdev/core';

export default function Page() {
  return html`
    <h1>Catalogue</h1>
    ${Suspense({ fallback: html`<p>Loading…</p>`, children: fetchExpensive() })}
  `;
}
```

TTFB = time to render everything *outside* the Suspense boundary. The
fallback flushes immediately, and the resolved content streams in as a
`<template>` + inline `__webjsResolve('id')` script when the promise
lands. Nested Suspense supported.

## First-paint performance without a build step

Five stacked zero-build optimizations:

1. **`<link rel="modulepreload">` per used component + transitive deps.**
   The SSR pass knows every custom element in the final HTML. A startup
   module-graph scan adds their transitive import dependencies too. All
   preload hints are deduplicated and emitted in `<head>`.
2. **HTTP/2 multiplex at the edge.** The production server (`npm run start`) speaks plain
   HTTP/1.1. PaaS edges (Railway, Fly, Render, Vercel, Cloudflare Pages,
   Heroku) and reverse proxies (nginx, Caddy, Traefik) speak
   HTTP/2 to the browser and proxy 1.1 to the container, fetching many module
   fetches in parallel over one TCP+TLS connection.
3. **103 Early Hints.** Before SSR starts computing the response, the
   server sends `103 Interim Response` with the page's module URLs as
   `rel=modulepreload`. Chrome/Edge and edge proxies (Cloudflare, fly-proxy,
   Fastly) forward these.
4. **Lazy component loading (opt-in).** Components with `static lazy = true`
   are excluded from modulepreload and loaded on-demand via
   `IntersectionObserver` (200px root margin). The SSR-rendered DSD content
   is visible immediately. `static hydrate = 'visible'` further defers
   `connectedCallback` activation. Ideal for below-the-fold widgets.
5. **Auto-vendor via jspm.io (Rails 7 + importmap-rails posture).** At
   startup the server scans client-reachable source for bare npm import
   specifiers. Each `pkg@version` is resolved through `api.jspm.io/generate`
   to a CDN URL (`https://ga.jspm.io/npm:<pkg>@<version>/...`) and added
   to the import map; the browser fetches each package directly from
   the CDN. `webjs vendor pin` commits the resolved URLs + SHA-384
   integrity hashes to `.webjs/vendor/importmap.json` for reproducible
   deploys; `webjs vendor pin --download` also caches the bundle bytes
   locally under `.webjs/vendor/<pkg>@<version>.js` for air-gapped /
   strict-CSP deployments. No bundler runs at any point.

## No-build production model

webjs has no bundler and no `webjs build` step. The same `.js` / `.ts`
source files that run in dev are served as-is to the browser in
production. The Rails 7+ / Hotwire pattern:

- **Importmap-driven**: bare-specifier imports (`from "react"`) are
  resolved via `<script type="importmap">` emitted into the document
  head. By default each package resolves through `api.jspm.io/generate`
  to a `https://ga.jspm.io/npm:<pkg>@<version>/...` URL and the browser
  fetches it from the CDN directly. `webjs vendor pin` commits the
  resolved URLs + SHA-384 integrity hashes to `.webjs/vendor/importmap.json`
  for reproducible deploys; `webjs vendor pin --download` additionally
  caches each bundle to `.webjs/vendor/<pkg>@<version>.js` and rewrites
  the importmap to `/__webjs/vendor/<pkg>@<version>.js` so the server
  serves the bytes from disk (air-gapped / strict-CSP path). No bundler
  runs at any point.
- **Per-file ESM serving**: every app `.js` / `.ts` becomes its own HTTP
  resource. The browser walks the import graph and fetches each module
  on demand.
- **`<link rel="modulepreload">` hints at SSR time**: for every component
  the route uses + its transitive deps from the module graph. The
  browser parallelizes fetches instead of waterfalling through nested
  imports. This is what eliminates the perceived gap vs a bundle.
- **HTTP/2 multiplex** is what makes per-file serving competitive: one
  TCP+TLS handshake, many module fetches in parallel over the same
  connection. The production server (`npm run start`) speaks plain HTTP/1.1.
  TLS + HTTP/2 is the proxy's job. PaaS edges (Railway, Fly, Render, Vercel,
  Cloudflare Pages, Heroku) do this automatically. For bare-VM
  deploys, put nginx, Caddy, or Traefik in front.

Content-hashed cache-busting and granular cache invalidation come from
the same per-file model: edit one file, only that file's URL hash
changes, only that one re-downloads.


## Rate limiting via `rateLimit()`

Fixed-window limiter shaped as middleware. Place in `middleware.ts` at
whatever level you want to protect:

```js
// app/api/auth/middleware.ts: protect login/signup from brute force
import { rateLimit } from '@webjsdev/server';
export default rateLimit({ window: '10s', max: 5 });

// Custom key: rate limit per authenticated user instead of IP
export default rateLimit({
  window: '1m', max: 30,
  key: async (req) => {
    const session = await auth(req);
    return session?.user?.id ?? 'anon';
  },
});
```

**Options:** `window` (`'10s'`, `'1m'`, `'1h'`, ms), `max` (default 60),
`key` (string prefix or `(req) => string`, defaulting to the
framework-stamped client IP from the TCP socket), `message`, `store`,
`trustProxy` (default `false`).

**`trustProxy`** controls how the default key is derived:

- **`false` (default, safe):** key on the framework-stamped
  `x-webjs-remote-ip` header, which `startServer` sets from the
  underlying TCP socket on every request (and strips any inbound
  copy of, so clients cannot spoof it). Forwarded-IP headers like
  `x-forwarded-for`, `cf-connecting-ip`, `x-real-ip` are ignored.
  Correct for direct deployments (bare Node, no proxy in front).
- **`true`:** honour forwarded-IP headers, preferring the leftmost
  entry of `x-forwarded-for`, then `cf-connecting-ip`, then
  `x-real-ip`. Production deploys MUST run behind a reverse proxy
  (nginx, Caddy, Cloudflare, Fly, Railway, Render edge) that STRIPS
  inbound `x-forwarded-for` before adding its own. If the proxy
  doesn't strip, the option reintroduces the per-request bucket
  rotation it exists to defend against.

```js
// Direct deploy (default): safe, ignores spoofable forwarded headers.
export default rateLimit({ window: '10s', max: 5 });

// Behind a trusted reverse proxy: opt in, MUST strip inbound XFF.
export default rateLimit({ window: '10s', max: 5, trustProxy: true });
```

The `clientIp(req, { trustProxy })` helper is exported separately so
custom `key` functions can reuse the same resolution:

```js
import { rateLimit, clientIp } from '@webjsdev/server';
export default rateLimit({
  window: '1m', max: 30,
  key: (req) => `${req.headers.get('x-tenant') || 'global'}:${clientIp(req, { trustProxy: true })}`,
});
```

**Embedded use** (`createRequestHandler` running under Express / Bun /
Deno / edge adapters): the host adapter is responsible for stripping
any inbound `x-webjs-remote-ip` from the wire AND stamping its own
from the trusted socket address, otherwise a malicious client forges
the header and the framework trusts it. Call the exported helper:

```js
// express adapter sketch
import express from 'express';
import { createRequestHandler, stampRemoteIp } from '@webjsdev/server';

const app = express();
const handler = await createRequestHandler({ appDir });

app.use(async (req, res) => {
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : req;
  const webReq = new Request(url, {
    method: req.method,
    headers: new Headers(req.headers),
    body,
    duplex: 'half',
  });
  // Strips any forged x-webjs-remote-ip, stamps the real socket address.
  const safe = stampRemoteIp(webReq, req.socket.remoteAddress);
  const webRes = await handler.handle(safe);
  res.status(webRes.status);
  webRes.headers.forEach((v, k) => res.setHeader(k, v));
  if (webRes.body) webRes.body.pipeTo(new WritableStream({ write: (c) => res.write(c) })).then(() => res.end());
  else res.end();
});
```

If the adapter cannot expose a trusted socket address, pass a custom
`key` function to `rateLimit()` that reads whatever client identifier
the host actually provides. The default rate-limit collapsing to
`_anon_` is preferable to silently trusting wire-set headers.

**Exceeded:** returns `429 Too Many Requests` with JSON `{ error: "Too Many Requests" }` and headers `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `retry-after`.

**Scaling:** in-memory by default. `setStore(redisStore({ url: process.env.REDIS_URL }))` shares limits across instances.

## Client router: nested-layout-aware partial swap

`import '@webjsdev/core/client-router'` enables SPA-style navigation that
preserves outer-layout DOM identity at any depth. Intercepts same-origin
`<a>` clicks (incl. inside shadow DOM via `composedPath()`), fetches the
target HTML, and replaces only the inside of the deepest shared layout.
Outer header / sidenav / footer DOM nodes are never re-rendered, so
scroll positions, input values, and `<details>` open state survive
navigation automatically.

### How it works

1. SSR injects `<!--wj:children:<segment-path>-->...<!--/wj:children-->`
   comment markers around each layout's `${children}` interpolation,
   one pair per layout in the chain. Auto-derived from folder
   structure. Layout authors write nothing extra.
2. On click, the router walks both the live DOM and the incoming HTML
   for these markers and builds `Map<path, {start, end}>`.
3. Picks the **longest shared path**, the deepest layout boundary
   both pages have in common.
4. Replaces nodes between that marker pair using a keyed `data-key`
   reconciler. Elements with matching tag + matching key are reused
   with in-place attribute diffing. **Live attributes** (`value`,
   `checked`, `selected`, `indeterminate`, `disabled`, `open`,
   `popover`) are NEVER overwritten by the server HTML.
5. Merges `<head>` (add-only on partial swaps so runtime-injected
   styles like Tailwind survive, with a full merge on the
   root-layout-change fallback), re-runs `<script>` elements,
   `customElements.upgrade()`s the swapped subtree, `pushState`s the
   URL, scrolls.
6. Dispatches `webjs:navigate` event on `document`.

### Wire-byte optimization

The router sends `X-Webjs-Have: <paths>` listing the marker paths it
already has rendered. The server walks the target route's layout chain
innermost → outermost and **short-circuits at the first match**. The
inner tree is wrapped in that layout's marker pair and returned. Outer
layouts are not loaded, not rendered, not re-serialized. Real savings
on every same-shell navigation.

### Cross-deploy hard-reload signals

Two complementary mechanisms tell the client when a partial swap is
unsafe and a hard reload is required:

1. **Importmap drift** (the common case after a vendor pin change).
   Server stamps a SHA-256 of the importmap on `<script type="importmap"
   data-webjs-build="…">` AND emits the same hash as `X-Webjs-Build`
   on every response, including X-Webjs-Have partial responses with no
   head. Client compares the response header against the live
   document's `data-webjs-build`; mismatch triggers `location.href =
   target` instead of partial swap. Works for every nav, including
   partial-response navs.

2. **Generic `data-webjs-track="reload"`** (for non-importmap concerns,
   e.g. a CSS bundle hash, a build-id meta tag). Any head element with
   the attribute joins a signature computed from concatenated outerHTML.
   On nav, mismatched signatures trigger reload. Mirrors hotwired/turbo's
   `data-turbo-track="reload"`.

```html
<link rel="stylesheet" href="/build/main-abc123.css" data-webjs-track="reload">
<meta name="build-id" content="rev-42" data-webjs-track="reload">
```

Both paths share a one-shot `sessionStorage` reload guard so a
genuinely-churning resource doesn't loop reloads.

### Snapshot cache + revalidation

URL-keyed `Map<url, snapshot>` (LRU, cap 16). Back/forward via
popstate restores from cache instantly, then refetches in the
background.

```js
import { revalidate } from '@webjsdev/core';
revalidate('/products/123');  // evict one URL
revalidate();                 // clear the entire cache
```

Call `revalidate(path)` after a server action mutates data that
affects a cached page.

### Per-segment loading skeletons

Each `loading.{js,ts}` in the route chain is rendered into a hidden
`<template id="wj-loading:<segment-path>">`. On nav-start, the client
clones the deepest matching template into the swap slot. Users see
an instant per-segment skeleton during the fetch.

### Programmatic navigation

```js
import { navigate } from '@webjsdev/core';
await navigate('/about');                    // push history
await navigate('/login', { replace: true }); // replace
```

### Form submissions

`<form action="..." method="...">` submissions are intercepted alongside
link clicks and routed through the same partial-swap pipeline.
Submitter attributes (`formmethod` / `formaction` / `formenctype` on a
clicked `<button>`) take precedence over the form's own, per the HTML5
form-submission algorithm.

- **GET**: `FormData` is promoted to the URL query string (replacing
  any existing `?...` on `action`), then the URL is fetched and applied
  exactly like a link click.
- **POST / PUT / PATCH / DELETE**: `FormData` is sent as the request
  body. After a successful response the snapshot cache is cleared (the
  submission may have mutated server state that other cached URLs
  depend on, so back/forward must refetch instead of restoring stale).

Forms calling a server action via `@submit=${e => this.handleSubmit(e)}`
+ `e.preventDefault()` are unaffected: the router only intercepts when
`event.defaultPrevented` is false. Opt out per form or per submitter
with `data-no-router`:

```html
<form action="/legacy" data-no-router>...</form>
<form action="/x"><button data-no-router>Full reload</button></form>
```

Auto-skipped (no `data-no-router` needed):
- `method="dialog"` (browser-native dialog dismissal)
- `target` / `formtarget` ≠ `_self` (iframe / popup)
- Cross-origin `action`
- Non-HTML extensions on `action` (`.pdf`, etc.)

### Non-2xx HTML responses are rendered in place

A response with a `text/html` body is applied to the DOM regardless of
status code:

- **2xx**: normal navigation.
- **4xx (e.g. 422)**: server-rendered validation errors. The form is
  re-rendered with `value` attributes preserving what the user typed,
  inline error messages visible, no full-page reload. Standard Rails /
  Django / Laravel / Phoenix pattern.
- **5xx with HTML**: error page rendered in place (not a flash of
  blank then reload).

Non-HTML responses (JSON error envelopes, downloads, opaque) fall back
to `location.href = url` and let the browser handle them.

**204 No Content** = "stay on current page" (autosave-style
submissions). DOM is untouched. History records the requested URL.

**Server-side redirects** (3xx that `fetch()` follows automatically)
record the **final** URL in history, not the originally-requested one.
The Post-Redirect-Get pattern works correctly.

### Concurrent navigations + cancellation

Each navigation/submission `abort()`s any in-flight fetch from the prior
one (Turbo Drive's `navigator.stop()` pattern). Rapid clicks won't
produce N parallel requests competing to be applied last. A monotonic
nav-token additionally short-circuits any response that arrives after a
newer navigation has settled, so a slow first request that races past
its abort cannot revert the newer page.

### Scroll restoration on back/forward

On snapshot, the router records `{ window.scrollX, window.scrollY }`
alongside the HTML. On popstate cache-hit, the cached DOM is applied
and scroll is restored to where the user left it. The background
revalidation fetch that follows does **not** scroll, so the restored
position survives the refresh. Cache miss → browser-native scroll
restoration takes over.

Inner scroll containers (e.g. `.docs-sidenav`) are preserved
automatically by the outer-layout-DOM-identity invariant. They stay
mounted across nav and keep their `scrollTop` natively.

### `<webjs-frame>` escape hatch

For partial-swap regions NOT tied to a folder layout (a marketing-page
widget, tabbed UI, etc.), wrap the region in a frame:

```ts
html`<webjs-frame id="activity">…contents…</webjs-frame>`
```

On click, the router walks `closest('webjs-frame')` from the click
target. If a frame is found AND the response contains a matching
`<webjs-frame id="...">`, the swap is scoped to that frame's children,
which takes precedence over the layout-marker mechanism. Otherwise the
router falls through to the layout-marker path.

### Opt out per link

```html
<a href="/legacy" data-no-router>Full reload</a>
```

Use `data-no-router` for:
- **Auth flows**: `/logout`, OAuth redirects. Full reload wipes in-memory module state.
- **Print views / embed pages.**
- **Experimental routes** with a different client runtime.

### Auto-skipped (no `data-no-router` needed)

- `download`, non-`_self` target, modifier-key click.
- Cross-origin hrefs.
- Pure hash fragments on same page.
- Non-HTML extensions (`.pdf`, `.zip`, `.json`, images, media): browser handles.
- Response `Content-Type` not `text/html`: falls back to full nav.

### Loading indicator

`<html>` gets `data-navigating` during fetch. Style a progress bar off that attribute.

## WebSockets

### Server: `WS` export in `route.{js,ts}`

```js
export function WS(ws, req, { params }) {
  ws.on('message', (data) => ws.send('echo:' + data));
  ws.on('close', () => { /* cleanup */ });
}
```

In **dev mode** the module re-imports per connection to pick up edits.
Store shared state on `globalThis`:

```js
const clients = globalThis.__my_clients ?? (globalThis.__my_clients = new Set());
```

### Client: `connectWS`

`connectWS(url, { onOpen, onMessage, onClose, onError, reconnect })` from `@webjsdev/core`. Auto-reconnects with exponential backoff, JSON parse/stringify, queues sends while disconnected.

### Broadcast (single-instance)

```js
import { broadcast } from '@webjsdev/server';

export function WS(ws, req) {
  ws.on('message', (data) => {
    broadcast('/api/chat', data);  // → all connected clients on this path
  });
}
```

For multi-instance, the user adds Redis pub/sub themselves. No framework magic.

## Per-segment middleware

`middleware.js` can live at any level under `app/` and only applies to
its subtree. Chain runs outermost → innermost, root-sibling → app-root
first, then segment-scoped files.

## Raw-text templates

`<script>` and `<style>` are parsed as raw-text. `<` and `>` inside them aren't tag starts. Holes interpolate verbatim (no HTML escaping).
