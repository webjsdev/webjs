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

## Client router — Turbo Drive-style

`import '@webjskit/core/client-router'` enables SPA-style navigation. Intercepts same-origin `<a>` clicks (incl. inside shadow DOM via `composedPath()`), fetches target HTML, swaps DOM.

### How it works

1. Fetches the URL via `fetch()`.
2. Parses with `Document.parseHTMLUnsafe()` (preserves Declarative Shadow DOM).
3. If both pages share the same layout shell (e.g. `<blog-shell>`), swap only slot content — layout stays mounted.
4. Otherwise replace entire `<body>` and merge `<head>`.
5. Upgrade custom elements, re-run scripts, `pushState`, scroll to top.
6. Dispatch `webjs:navigate` event on `document`.

### Programmatic navigation

```js
import { navigate } from '@webjskit/core/client-router';
await navigate('/about');                    // push history
await navigate('/login', { replace: true }); // replace
```

### Opt out per link

```html
<a href="/legacy" data-no-router>Full reload</a>
```

Use `data-no-router` for:
- **Auth flows** — `/logout`, OAuth redirects. Full reload wipes in-memory module state (cached user data, tokens). Surviving state after logout is a real bug class.
- **Print views / embed pages**.
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
