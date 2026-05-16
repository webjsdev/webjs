# Advanced features

## Streaming SSR / Suspense

```js
import { html, Suspense } from '@webjskit/core';

export default function Page() {
  return html`
    <h1>Catalogue</h1>
    ${Suspense({ fallback: html`<p>Loading…</p>`, children: fetchExpensive() })}
  `;
}
```

TTFB = time to render everything *outside* the Suspense boundary. The
fallback flushes immediately; the resolved content streams in as a
`<template>` + inline `__webjsResolve('id')` script when the promise
lands. Nested Suspense supported.

## First-paint performance without a build step

Five stacked zero-build optimizations:

1. **`<link rel="modulepreload">` per used component + transitive deps.**
   The SSR pass knows every custom element in the final HTML; a startup
   module-graph scan adds their transitive import dependencies too. All
   preload hints are deduplicated and emitted in `<head>`.
2. **HTTP/2 (ALPN over TLS).** `webjs start --http2 --cert … --key …` serves
   everything over one multiplexed connection.
3. **103 Early Hints.** Before SSR starts computing the response, the
   server sends `103 Interim Response` with the page's module URLs as
   `rel=modulepreload`. Chrome/Edge and edge proxies (Cloudflare, fly-proxy,
   Fastly) forward these.
4. **Lazy component loading (opt-in).** Components with `static lazy = true`
   are excluded from modulepreload and loaded on-demand via
   `IntersectionObserver` (200px root margin). The SSR-rendered DSD content
   is visible immediately. `static hydrate = 'visible'` further defers
   `connectedCallback` activation. Ideal for below-the-fold widgets.
5. **Auto-vendor bundling (Vite-style optimizeDeps).** At startup the server
   scans client-reachable source for bare npm import specifiers. Each
   package is bundled into a single ESM file via esbuild and served at
   `/__webjs/vendor/<pkg>.js`. The import map is populated automatically.

## Bundling — `webjs build` (optional)

Runs esbuild over every client-facing module and writes
`.webjs/bundle.js`. Prod serves the bundle with
`Cache-Control: immutable, max-age=1y`. One bundle per app (no per-route
split in v1).

```sh
webjs build                        # default: minified + sourcemap
webjs build --no-minify            # debugging
webjs build --no-sourcemap         # smaller deploy
```

## Rate limiting — `rateLimit()`

Fixed-window limiter shaped as middleware. Place in `middleware.ts` at
whatever level you want to protect:

```js
// app/api/auth/middleware.ts — protect login/signup from brute force
import { rateLimit } from '@webjskit/server';
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
`key` (string prefix or `(req) => string`; default: client IP from
`x-forwarded-for`/`cf-connecting-ip`/`x-real-ip`), `message`, `store`.

**Exceeded:** returns `429 Too Many Requests` with JSON `{ error: "Too Many Requests" }` and headers `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `retry-after`.

**Scaling:** in-memory by default. `setStore(redisStore({ url: process.env.REDIS_URL }))` shares limits across instances.

## Client router — nested-layout-aware partial swap

`import '@webjskit/core/client-router'` enables SPA-style navigation that
preserves outer-layout DOM identity at any depth. Intercepts same-origin
`<a>` clicks (incl. inside shadow DOM via `composedPath()`), fetches the
target HTML, and replaces only the inside of the deepest shared layout —
outer header / sidenav / footer DOM nodes are never re-rendered, so
scroll positions, input values, and `<details>` open state survive
navigation automatically.

### How it works

1. SSR injects `<!--wj:children:<segment-path>-->...<!--/wj:children-->`
   comment markers around each layout's `${children}` interpolation —
   one pair per layout in the chain. Auto-derived from folder
   structure; layout authors write nothing extra.
2. On click, the router walks both the live DOM and the incoming HTML
   for these markers and builds `Map<path, {start, end}>`.
3. Picks the **longest shared path** — the deepest layout boundary
   both pages have in common.
4. Replaces nodes between that marker pair using a keyed `data-key`
   reconciler — elements with matching tag + matching key are reused
   with in-place attribute diffing. **Live attributes** (`value`,
   `checked`, `selected`, `indeterminate`, `disabled`, `open`,
   `popover`) are NEVER overwritten by the server HTML.
5. Merges `<head>` (add-only on partial swaps so runtime-injected
   styles like Tailwind survive; full merge on root-layout-change
   fallback), re-runs `<script>` elements, `customElements.upgrade()`s
   the swapped subtree, `pushState`s the URL, scrolls.
6. Dispatches `webjs:navigate` event on `document`.

### Wire-byte optimization

The router sends `X-Webjs-Have: <paths>` listing the marker paths it
already has rendered. The server walks the target route's layout chain
innermost → outermost and **short-circuits at the first match** — the
inner tree is wrapped in that layout's marker pair and returned. Outer
layouts are not loaded, not rendered, not re-serialized. Real savings
on every same-shell navigation.

### Snapshot cache + revalidation

URL-keyed `Map<url, snapshot>` (LRU, cap 16) — back/forward via
popstate restores from cache instantly, then refetches in the
background.

```js
import { revalidate } from '@webjskit/core';
revalidate('/products/123');  // evict one URL
revalidate();                 // clear the entire cache
```

Call `revalidate(path)` after a server action mutates data that
affects a cached page.

### Per-segment loading skeletons

Each `loading.{js,ts}` in the route chain is rendered into a hidden
`<template id="wj-loading:<segment-path>">`. On nav-start, the client
clones the deepest matching template into the swap slot — users see
an instant per-segment skeleton during the fetch.

### Programmatic navigation

```js
import { navigate } from '@webjskit/core';
await navigate('/about');                    // push history
await navigate('/login', { replace: true }); // replace
```

### `<webjs-frame>` escape hatch

For partial-swap regions NOT tied to a folder layout (a marketing-page
widget, tabbed UI, etc.), wrap the region in a frame:

```ts
html`<webjs-frame id="activity">…contents…</webjs-frame>`
```

On click, the router walks `closest('webjs-frame')` from the click
target. If a frame is found AND the response contains a matching
`<webjs-frame id="...">`, the swap is scoped to that frame's children
— takes precedence over the layout-marker mechanism. Otherwise the
router falls through to the layout-marker path.

### Opt out per link

```html
<a href="/legacy" data-no-router>Full reload</a>
```

Use `data-no-router` for:
- **Auth flows** — `/logout`, OAuth redirects. Full reload wipes in-memory module state.
- **Print views / embed pages.**
- **Experimental routes** with a different client runtime.

### Auto-skipped (no `data-no-router` needed)

- `download`, non-`_self` target, modifier-key click.
- Cross-origin hrefs.
- Pure hash fragments on same page.
- Non-HTML extensions (`.pdf`, `.zip`, `.json`, images, media) — browser handles.
- Response `Content-Type` not `text/html` — falls back to full nav.

### Loading indicator

`<html>` gets `data-navigating` during fetch — style a progress bar.

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

`connectWS(url, { onOpen, onMessage, onClose, onError, reconnect })` from `@webjskit/core` — auto-reconnect with exponential backoff, JSON parse/stringify, queues sends while disconnected.

### Broadcast (single-instance)

```js
import { broadcast } from '@webjskit/server';

export function WS(ws, req) {
  ws.on('message', (data) => {
    broadcast('/api/chat', data);  // → all connected clients on this path
  });
}
```

For multi-instance, the user adds Redis pub/sub themselves — no framework magic.

## Per-segment middleware

`middleware.js` can live at any level under `app/` and only applies to
its subtree. Chain runs outermost → innermost, root-sibling → app-root
first, then segment-scoped files.

## Raw-text templates

`<script>` and `<style>` are parsed as raw-text — `<` and `>` inside them aren't tag starts. Holes interpolate verbatim (no HTML escaping).
