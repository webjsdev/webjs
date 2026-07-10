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

### Component-level streaming: `<webjs-suspense>` (#471)

`Suspense({ fallback, children })` above is the page/region-level primitive (a promise passed as `children`). With **async render** (`agent-docs/components.md`), a COMPONENT is the suspending unit: a component doing `async render() { const u = await getUser(this.uid); … }` BLOCKS the first byte by default (real data in the first paint). To STREAM a slow component, wrap it in the renderer-recognized `<webjs-suspense>` element:

```js
html`
  <webjs-suspense .fallback=${html`<p>Loading section…</p>`}>
    <user-profile uid="42"></user-profile>
    <user-activity uid="42"></user-activity>
  </webjs-suspense>
`;
```

`.fallback` is read at SSR as the inline placeholder (`render-server.js`'s `processSuspenseElements` carries it via `data-webjs-fallback`, since a `TemplateResult` is not serializer-safe) and flushed on the first byte; the children push to `ctx.pending` and stream in via the same `<template data-webjs-resolve>` engine. Multiple boundaries resolve via `Promise.all`, so they fetch concurrently (no server waterfall). One boundary groups several components under one fallback (the boundary `.fallback` wins over a contained component's `renderFallback()`), and a throwing component inside is isolated to its own error state while siblings stream. Without a streaming context (`renderToString`) the children render inline (blocking).

### Progressive soft-nav streaming (#473)

On a client-router navigation to a streamed page, the router applies the response PROGRESSIVELY: the SSR stream flushes the shell (with fallbacks) plus a `<!--wj-stream-shell-->` sentinel, the router's `readStreamedShell` swaps the shell in immediately and advances the URL, then `streamBoundariesProgressively` applies each resolved boundary into the live DOM as it streams (fast-before-slow), upgrading the custom elements inside. So a soft nav matches the initial-load experience instead of buffering the whole response. A non-streaming page is read to completion and applied once; a navigation superseded mid-stream stops and cancels the reader; a mid-stream transport failure leaves the applied boundaries in place (non-destructive).

## First-paint performance without a build step

Five stacked zero-build optimizations:

1. **`<link rel="modulepreload">` per used component + transitive deps + reached vendors.**
   The SSR pass knows every custom element in the final HTML. A startup
   module-graph scan adds their transitive import dependencies too, AND the
   npm vendor URLs those shipped modules import (#754, flattening the
   cross-origin CDN waterfall one level; see the no-build model below for the
   shallow-dependency caveat). All preload hints are deduplicated and emitted
   in `<head>`, vendor hints carrying their SRI `integrity` + `crossorigin`.
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
   specifiers. The WHOLE scanned set is resolved in ONE
   `api.jspm.io/generate` call (a single `install[]` array) so jspm
   computes one mutually-consistent dependency graph: a directly-imported
   package and a transitive that needs a newer version of the same package
   agree on one CDN URL, instead of skewing (a direct dep pinned to its
   local version while a transitive floats to jspm-latest, which crashed
   the browser with a missing export). Each resolved entry is a CDN URL
   (`https://ga.jspm.io/npm:<pkg>@<version>/...`) added to the import map;
   the browser fetches each package directly from the CDN. If the unified
   call fails because some install is unresolvable (a 401 for a private or
   server-only dep), the resolver falls back to per-package isolation for
   the offending install(s) and re-resolves the resolvable survivors as one
   graph, so one bad dep can never collapse the whole map.
   **SRI integrity (SHA-384) is computed on BOTH paths.** A
   live-resolved (unpinned) app hashes each cross-origin bundle at warmup
   and emits `integrity` + `crossorigin` on the importmap and modulepreload
   tags, so a swapped or compromised CDN response is rejected by the browser
   even with no pin file (#235). The hashing is bounded (parallel fetches
   with a small concurrency cap and a per-fetch timeout) and FAIL-OPEN: a
   bundle fetch failure skips that one URL's integrity (it loads without SRI,
   the same as before) and emits a one-time warning, so a CDN hiccup never
   takes the app down. Added warmup cost is one HEAD-like GET per distinct
   cross-origin bundle, cached per process by URL so a re-resolve does not
   re-fetch. `webjs vendor pin` still commits the resolved URLs + integrity
   hashes to `.webjs/vendor/importmap.json` for reproducible deploys (and a
   stable boot-time build id with no warmup fetch); `webjs vendor pin
   --download` also caches the bundle bytes locally under
   `.webjs/vendor/<pkg>@<version>.js` for air-gapped / strict-CSP
   deployments. No bundler runs at any point. **`webjs doctor` validates
   importmap coherence** (#450): for each resolved package it checks that the
   version pinned for every OTHER resolved package it depends on satisfies the
   declared dependency / peer range, and WARNS naming both packages, the range,
   and the pinned version when they skew (the class of bug where a pinned
   package needs a newer minor of another pinned package than is pinned, so a
   symbol it expects is missing at runtime). It is a validation over the
   produced importmap, not a re-resolution and not bundling, and it runs the
   SAME check with the SAME verdict over the live importmap and the vendored
   `.webjs/vendor/importmap.json` (vendoring freezes the runtime-resolved
   graph, so a coherent live graph stays coherent vendored). It reads
   dependency metadata from the installed `node_modules` (no network of its
   own) and degrades to "could not verify" when a manifest is unavailable.

## No-build production model

WebJs has no bundler and no `webjs build` step. The same `.js` / `.ts`
source files that run in dev are served as-is to the browser in
production. The Rails 7+ / Hotwire pattern:

- **Importmap-driven**: bare-specifier imports (`from "react"`) are
  resolved via `<script type="importmap">` emitted into the document
  head. By default the whole scanned set resolves through one
  `api.jspm.io/generate` call (one consistent graph, see point 5 above)
  to `https://ga.jspm.io/npm:<pkg>@<version>/...` URLs and the browser
  fetches them from the CDN directly, with an `integrity` SRI hash on every
  cross-origin entry (computed live at warmup for an unpinned app, or read
  from the pin file for a pinned one). `webjs vendor pin` commits the
  resolved URLs + SHA-384 integrity hashes to `.webjs/vendor/importmap.json`
  for reproducible deploys; `webjs vendor pin --download` additionally
  caches each bundle to `.webjs/vendor/<pkg>@<version>.js` and rewrites
  the importmap to `/__webjs/vendor/<pkg>@<version>.js` so the server
  serves the bytes from disk (air-gapped / strict-CSP path). No bundler
  runs at any point. Because the pins are meant to be committed,
  `webjs vendor pin` makes its output committable: the scaffold already
  un-ignores `.webjs/vendor/`, and if a `.gitignore` would swallow the
  pins it heals it (or prints how to commit them when the ignore is not
  in the app's own `.gitignore`). A no-vendor app, which never pins, is
  unaffected.
- **Per-file ESM serving**: every app `.js` / `.ts` becomes its own HTTP
  resource. The browser walks the import graph and fetches each module
  on demand.
- **`<link rel="modulepreload">` hints at SSR time**: for every component
  the route uses + its transitive deps from the module graph, AND for the
  npm **vendor** URLs those shipped modules reach (#754). The browser
  parallelizes fetches instead of waterfalling through nested imports. This
  is what closes most of the perceived gap vs a bundle. **The honest caveat:**
  a bundle still wins on a DEEP vendor tree. WebJs flattens the FIRST level
  (the vendor entries your code imports are hinted up front, with their SRI
  `integrity`, byte-identical to the importmap target so there is no double
  fetch), but a vendor's OWN transitive deps are still discovered by parsing
  each fetched CDN module in turn, level by level, over the cross-origin CDN
  connection. So the complementary mitigation is **shallow-dependency
  discipline**: prefer few, shallow ESM dependencies (a library with a flat
  or one-level graph fully benefits; a deep tree still waterfalls past level
  one). Only REACHED vendors are hinted: a vendor imported solely by an
  elided display-only component, by a page/layout module dropped from the boot
  (an inert or import-only page whose binding vendor import is used only during
  SSR, the canonical SSR-only-dependency case), by a `.server.*` file, or
  pinned-but-unimported, is never preloaded (no over-fetch).
- **HTTP/2 multiplex** is what makes per-file serving competitive: one
  TCP+TLS handshake, many module fetches in parallel over the same
  connection. The production server (`npm run start`) speaks plain HTTP/1.1.
  TLS + HTTP/2 is the proxy's job. PaaS edges (Railway, Fly, Render, Vercel,
  Cloudflare Pages, Heroku) do this automatically. For bare-VM
  deploys, put nginx, Caddy, or Traefik in front.

Content-hashed cache-busting and granular cache invalidation come from
the same per-file model: edit one file, only that file's URL hash
changes, only that one re-downloads.

## Content-hash asset caching: `?v=<digest>` immutable URLs (prod) (#243)

In PRODUCTION the framework appends a per-file content hash to every
SAME-ORIGIN asset URL it emits (the importmap targets, the
`<link rel="modulepreload">` hrefs, the boot script's module specifiers).
The hash is a short prefix of a sha-256 over the file's BYTES, computed at
serve time (no build step) and memoized. A request whose URL carries that
`?v=<digest>` query is served `Cache-Control: public, max-age=31536000,
immutable` instead of the 1-hour fallback, so a browser / CDN holds it for
a year without revalidating.

This is safe precisely because the hash IS the version: a deploy that
changes a module's bytes changes its hash, so its emitted URL changes, so a
returning client fetches the NEW URL rather than serving a stale immutable
copy. The framework's own `@webjsdev/core` runtime (`/__webjs/core/*`) is
fingerprinted too, which fixes the exact regression an un-versioned
`immutable` would otherwise cause (a year-pinned old core renderer running
against a server emitting the new SSR shape after a version bump).

- **Per-file digest, not the build id.** The importmap build id
  (`data-webjs-build`) does not change on an app-module byte change, so it
  cannot be the per-asset fingerprint; each file carries its own hash.
- **Cross-origin URLs are NEVER fingerprinted.** A `https://ga.jspm.io/...`
  vendor target keeps its exact URL: jspm already versions it, and #235's
  SRI integrity is keyed by the un-hashed cross-origin URL. A downloaded
  `/__webjs/vendor/<pkg>@<ver>.js` bundle is already version-named, so it is
  left unchanged too.
- **Composes with `webjs.basePath` (#256).** A sub-path deploy emits
  `<basePath>/app/foo.js?v=<digest>`: the base path is prefixed first, the
  `?v` query appended after, and the ingress base-path strip never touches a
  query.
- **DEV is byte-identical to before.** Fingerprinting is enabled only in
  `webjs start` (prod). `webjs dev` emits no `?v` and serves every module
  `no-cache`, so the dev wire is unchanged.
- **Un-fingerprinted requests keep the 1-hour fallback.** Only the presence
  of a `?v` query flips the cache header; a hand-typed bare URL still
  resolves and serves `public, max-age=3600`.

## Connection-warming hints: `preconnect` / `dnsPrefetch` + auto vendor preconnect (#243)

A page can warm a cross-origin connection it is about to use (an API host,
a font / image CDN) by declaring it in `metadata`:

```ts
export const metadata = {
  preconnect: ['https://api.example.com', { url: 'https://fonts.gstatic.com', crossorigin: true }],
  dnsPrefetch: 'https://analytics.example.com',
};
```

Each emits a head hint: `<link rel="preconnect" href="..." [crossorigin]>`
(warms DNS + TLS + TCP) and `<link rel="dns-prefetch" href="...">` (DNS
only). Each field takes a URL string, `{ url, crossorigin? }`, or an array;
hrefs are HTML-escaped. See `agent-docs/metadata.md`.

**Auto vendor preconnect.** For an UNPINNED app resolving vendors live from
a cross-origin CDN, the framework auto-emits ONE
`<link rel="preconnect" href="<cdn-origin>" crossorigin>` (the resolved
vendor CDN origin, e.g. `https://ga.jspm.io`, derived from the importmap, so
a `--from jsdelivr` app preconnects to jsdelivr) so the browser warms that
connection before the importmap resolves. It is DEDUPED against an
author-declared preconnect to the same origin, and emits NOTHING for a
same-origin pinned app (vendors served from the app's own origin) or an app
with no cross-origin vendors.


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
import { createRequestHandler, stampRemoteIp } from '@webjsdev/server';
const handler = await createRequestHandler({ appDir });

// Inside the host adapter's per-request callback. `nodeReq` is the
// host's request object (Express req, Node IncomingMessage, etc.).
// `webReq` is whatever Request you constructed from the wire (URL,
// method, headers, body); building that is host-specific. The
// security-relevant line is the one that wraps it in stampRemoteIp:
const safe = stampRemoteIp(webReq, nodeReq.socket.remoteAddress);
const webRes = await handler.handle(safe);
// Pipe webRes back through the host's response API.
```

The host-specific Request construction has its own gotchas (Node `Readable` to WHATWG `ReadableStream` for bodies; coalescing array-valued raw headers into comma-joined strings; URL synthesis from host + path). The `stampRemoteIp` line is what makes the result safe to hand off to webjs's rate limit; it MUST come after the inbound headers land in `webReq` and before `handler.handle(safe)` is called.

If the adapter cannot expose a trusted socket address, pass a custom
`key` function to `rateLimit()` that reads whatever client identifier
the host actually provides. The default rate-limit collapsing to
`_anon_` is preferable to silently trusting wire-set headers.

**Exceeded:** returns `429 Too Many Requests` with JSON `{ error: "Too Many Requests" }` and headers `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `retry-after`.

**Scaling:** in-memory by default. `setStore(redisStore({ url: process.env.REDIS_URL }))` shares limits across instances.

## Sub-path deployment: `webjs.basePath` (#256)

An app served under a sub-path (`example.com/app/`) behind a proxy that does NOT strip the prefix needs every framework-emitted absolute URL to carry that prefix, or module resolution 404s and the page never hydrates. Set the prefix in `package.json`:

```jsonc
{ "webjs": { "basePath": "/app" } }
```

`'app'`, `'/app'`, and `'/app/'` all normalize to `'/app'`; a nested `'/foo/bar'` is allowed; the empty default (or absence) is a root mount and a pure no-op (an unconfigured app is byte-identical to before this feature). An unsafe value (a `..`, a protocol, a `//host` network-path reference, whitespace, a backslash) is rejected to the empty default so a typo fails safe.

**The model is strip-at-ingress + prefix-on-emit, two seams only.** At the very start of request handling, when the request path is under the base path, the framework STRIPS the prefix and rewrites the request, so all downstream logic (route matching, the `/__webjs/*` checks, the source-file gate, redirects, trailing-slash, the `webjs.headers` path config, the HTML cache key) sees a root-relative path and works unchanged. A request whose path is NOT under the base path is not for this mounted app, so it 404s. On the way out, every framework-emitted same-origin absolute URL gets the prefix prepended: the importmap targets (the `/__webjs/core/*` runtime entries and any same-origin `/__webjs/vendor/*` local target; a cross-origin `https://` CDN vendor URL is left untouched), the `<link rel="modulepreload">` hrefs, the boot script's per-route module specifiers and lazy-loader entries, the dev reload `src`, and the 103 Early Hints preloads. So a sub-path deploy serves `<basePath>/__webjs/core/*` and resolves every module under the prefix.

The whole config surface (`webjs.redirects` / `webjs.trailingSlash` / `webjs.headers` `source` patterns) is authored app-root-relative, exactly as without a base path, because the ingress strip runs first.

**OUT OF SCOPE (a documented follow-up).** Author-written `<a href="/about">` links and client-router navigation are NOT auto-prefixed under a base path. This is the same boundary Next draws between basePath auto-prefixing its `<Link>` component and a raw `<a href>`: WebJs links are plain `<a href>`, so an author targeting a sub-path deploy writes the prefix into their own hrefs (or a future helper does) until client-side prefixing lands. The acceptance for #256 covers the server-emitted-URL + matching surface only.

## CORS via `cors()`

`cors()` is a middleware factory (same `(req, next) => Response` contract as `rateLimit()`), usable in `middleware.js` (root or per-segment) or wrapped around a `route.js` handler. It handles origin reflection, the `OPTIONS` preflight, `Vary: Origin`, and the credentials rule, so route handlers do not hand-roll any of it. The `--template api` scaffold ships a root `middleware.ts` demonstrating it.

```js
// middleware.js (applies to every request)
import { cors } from '@webjsdev/server';
export default cors({
  origin: ['https://app.example.com', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['content-type', 'authorization'],
  maxAge: 86400,
});
```

Wrap a single handler instead of going app-wide:

```js
// app/api/widgets/route.js
import { cors } from '@webjsdev/server';
const corsMw = cors({ origin: '*' });
export async function GET(req) {
  return corsMw(req, async () => Response.json({ widgets: [] }));
}
```

### Options

| Option | Meaning |
|---|---|
| `origin` | A string (exact), `string[]` allow-list, a `RegExp`, a function `(origin) => boolean`, or `'*'` / `true` (any). Entries in an array may mix strings and RegExps. Defaults to `'*'`. |
| `credentials` | Sets `Access-Control-Allow-Credentials: true` for an allowed specific origin. |
| `methods` | Advertised on a preflight (`Access-Control-Allow-Methods`). |
| `allowedHeaders` | Advertised on a preflight; defaults to reflecting `Access-Control-Request-Headers`. |
| `exposedHeaders` | `Access-Control-Expose-Headers` on the actual response. |
| `maxAge` | Preflight cache lifetime in seconds. |

### Behavior

- **Preflight.** An `OPTIONS` request carrying `Access-Control-Request-Method` short-circuits with a `204` carrying the Allow-Methods / Allow-Headers / Max-Age headers. `next()` is NOT called. A disallowed-origin preflight returns a bare `204` with no CORS headers, so the browser blocks the follow-up.
- **Actual request.** `next()` runs, then `Access-Control-Allow-Origin` (plus credentials / exposed headers) is attached. A disallowed origin gets NO `Access-Control-Allow-Origin`, and the browser blocks the cross-origin read, but the server still serves the response (CORS is browser-enforced, not a server gate, so a mismatched actual request is never 403'd server-side).
- **`Vary: Origin`.** Appended (never clobbering an existing `Vary`) whenever the allowed origin is dynamic (a reflected, per-origin value), so a shared cache keys on `Origin` and cannot poison one origin's response onto another. A constant `*` (no credentials) does not vary, so no `Vary` is added.

### `credentials: true` requires an explicit origin allowlist (spec, enforced, warned)

**For any credentialed endpoint, pass an explicit `origin` allowlist (string / array / RegExp / function). Never combine `credentials: true` with a wildcard `origin` (`'*'` / `true`).**

`Access-Control-Allow-Origin: *` is INVALID together with `Access-Control-Allow-Credentials: true`, and the browser rejects the pair. Worse, the usual workaround (reflecting the request origin) under credentials effectively grants credentialed access (cookies, `Authorization`) to EVERY origin, a real footgun.

`cors()` keeps the request working rather than failing it: when `credentials: true` meets a wildcard `origin` it NARROWS to the reflected request origin instead of sending `*` (and appends `Vary: Origin`). With no `Origin` header under that combination it refuses entirely (no ACAO). Because that reflects any origin with credentials, it ALSO emits a one-time `console.warn` (deduped, not per-request):

```
cors(): credentials with a wildcard origin reflects ANY origin with credentials.
Use an explicit origin allowlist for credentialed requests.
```

The warning is informational; the request still proceeds. Treat it as a prompt to replace the wildcard with a real allowlist. An explicit allowlist with `credentials: true` is the safe, silent path.

## Client router: nested-layout-aware partial swap

The client router auto-enables when `@webjsdev/core` loads in the browser (any page that ships a component), no import needed (#620). It gives SPA-style navigation that
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

### In-place navigation-error recovery (`webjs:navigation-error`)

A successful swap (2xx/3xx) applies in place, and an HTML error body of any
status (a 4xx/5xx page, e.g. a `422` re-rendered form) is ALSO applied in
place. The remaining failure cases are a **non-HTML error response** (a
`500` carrying a JSON body) and a **transport/parse failure** (the `fetch`
rejected, or the body claimed HTML but did not parse). For those the router
no longer abandons the SPA with a destructive full `location.href` reload
(which would discard the partial-swap shell, scroll, focus, and in-flight
client state, and eat a second round-trip that may itself fail to the
browser's default error page).

Instead the router dispatches a cancelable, bubbling
`webjs:navigation-error` CustomEvent on `document`, with detail
`{ url, status, error }`: `status` is the HTTP status when a response
arrived (else `null`), and `error` is the `Error` for a transport/parse
failure (else `null`).

- **`preventDefault()` hands recovery to the app.** The router does NOTHING
  further: the current page is left exactly as it is (shell, scroll, focus,
  and client state all preserved), so the app can show its own toast, retry,
  or navigate elsewhere.
- **Not cancelled (the default)** renders a MINIMAL in-place error surface,
  a `<div role="alert" data-webjs-nav-error>` carrying a generic message
  plus the status, into the deepest layout children slot (the same target a
  normal partial swap writes to, so outer chrome and nav are preserved). No
  full reload, the shell survives, and the user sees the failure.
- **Last-resort hard load** happens only when there is NO shared layout
  marker to render into (a genuine cross-document nav), and only after the
  event was not cancelled, so a truly unrecoverable case is not a silent
  dead-end. This is the exception, not the default.

An **AbortError** (a newer navigation superseding this one) is a normal
supersede, NOT an error, and never dispatches `webjs:navigation-error`.

```ts
document.addEventListener('webjs:navigation-error', (e) => {
  // e.detail = { url, status, error }
  e.preventDefault();                 // app handles recovery; page left intact
  showToast(`Could not load ${e.detail.url} (status ${e.detail.status})`);
});
```

### Form submission state (`webjs:submit-start` / `webjs:submit-end` + `aria-busy`)

When a `<form>` submits through the JS-enhanced router, the form gets a
submission lifecycle a component can read to disable the submit button, show a
spinner, or set a pending style:

- The router sets the native `aria-busy="true"` on the form for the in-flight
  duration (cleared on settle). This IS the readable "is this form submitting"
  primitive: any component can poll `form.getAttribute('aria-busy')` or style
  `form[aria-busy="true"]` in CSS.
- It dispatches a bubbling `webjs:submit-start` (detail `{ form, url }`) when the
  submission fetch starts, and `webjs:submit-end` (detail `{ form, url, ok }`,
  `ok` is whether the submission settled as a success) on EVERY settle (success,
  a 4xx/5xx validation re-render, a navigation error, or an abort by a
  superseding submit). The pair is balanced even under a rapid re-submit (a
  nav-token guard keeps a superseded submit's teardown from clearing the busy
  state a newer submit set, the same guard `<webjs-frame>` uses).

```ts
// A submit button that disables itself while its form is submitting.
form.addEventListener('webjs:submit-start', () => { button.disabled = true; });
form.addEventListener('webjs:submit-end', (e) => {
  button.disabled = false;            // e.detail = { form, url, ok }
});
/* or purely in CSS, no JS: */
/* form[aria-busy="true"] button[type="submit"] { opacity: .5; pointer-events: none; } */
```

Progressive enhancement is unaffected: with JS off the form is a normal POST;
the events + `aria-busy` are a client-only enhancement.

### Optimistic mutations (`optimistic()`)

`optimistic()` from `@webjsdev/core` shows a mutation's expected result IMMEDIATELY (the UI feels instant), runs the real server action, and ROLLS BACK on failure. **Use it for every user-facing mutation where the client can predict the result** (create, update, delete, like, toggle, reorder). See `agent-docs/recipes.md` for complete examples.

#### Declarative API (preferred)

`optimistic(host, { source, update })` returns an `OptimisticState<State, Action>` with a `.value` getter and `.add(payload, promise?)` method. The reducer transforms the current state with each payload; `.add()` pushes an update and schedules a re-render. When a `promise` is passed, the update auto-releases on settlement (`.finally()` or a `.then()` fallback for thenables lacking `.finally`).

```ts
import { WebComponent, prop, optimistic, html } from '@webjsdev/core';
import { createTodo } from '#modules/todos/actions/create-todo.server.ts';

class TodoList extends WebComponent({
  todos: prop<Todo[]>(Array),
}) {
  private optimisticTodos = optimistic(this, {
    source: () => this.todos,
    update: (state, title: string) => [
      ...state,
      { id: crypto.randomUUID() as any, title, completed: false, pending: true },
    ],
  });

  async handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    const title = new FormData(e.target as HTMLFormElement).get('title') as string;
    if (!title) return;
    (e.target as HTMLFormElement).reset();

    const promise = createTodo({ title });
    this.optimisticTodos.add(title, promise);

    const result = await promise;
    if (result.success && result.data) {
      this.todos = [...this.todos.filter(t => t.pending), result.data, ...this.todos.filter(t => !t.pending)];
    }
  }

  render() {
    return html`<ul>${this.optimisticTodos.value.map(todo => html`
      <li class=${todo.pending ? 'opacity-50' : ''}>${todo.title}</li>
    `)}</ul>`;
  }
}
TodoList.register('todo-list');
```

Multiple `.add()` calls stack independently; each `release()` removes its own update by ID. When `update` is omitted, the payload replaces the state directly (`Action = State`), matching the simple `useOptimistic(setState)` pattern.

#### Imperative API (simple flips)

`optimistic(signal, value, action)` is a thin wrapper over the signal primitive for simple boolean flips:

```ts
import { signal, optimistic } from '@webjsdev/core';
import { likePost } from '../actions/like-post.server.js';

const liked = signal(false);
// in an @click handler:
const result = await optimistic(liked, true, () => likePost(postId));
// `liked` flips to true instantly. If likePost THROWS or returns
// { success: false }, `liked` rolls back to its prior value; the throw
// re-throws and the { success: false } result is returned (read its
// error / fieldErrors). On success the optimistic value stays; reconcile
// to the authoritative value from `result` if you need it.
```

It rolls back on a thrown error OR an `ActionResult` `{ success: false }` envelope, and never on success. Client-only (it mutates a signal), so a component importing it is never elided as display-only.

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
   Server stamps the PUBLISHED build id on `<script type="importmap"
   data-webjs-build="…">` AND emits the same value as `X-Webjs-Build`
   on every response, including X-Webjs-Have partial responses with no
   head. The published id is the importmap hash, but advertised only
   once the importmap is authoritatively final (at boot for a pinned
   app, after the first successful vendor resolve otherwise); while the
   map is still warming it stays empty. Client compares the response
   header against the live document's `data-webjs-build`. A hard reload
   (`location.href = target`) fires only when both ids are present and
   differ (a real cross-deploy). An empty id on either side means
   "version unknown" (a warming runtime-first-boot server) and never
   reloads, so the warmup window cannot hard-reload and wipe a
   half-filled form. Works for every nav, including partial-response navs.

   **Deploy fingerprint (#899).** The importmap hash alone misses a deploy
   that changed ONLY SSR output (syntax highlighting, a template edit, a copy
   change): the map is byte-identical, so the id never changes and the client
   never detects the deploy, serving stale pre-deploy HTML on soft nav until a
   manual refresh, per page. So the published id folds in a per-deploy
   fingerprint when one is available: `WEBJS_BUILD_ID` (set it to your git SHA
   at deploy) or a detected platform commit id (`RAILWAY_GIT_COMMIT_SHA`,
   `VERCEL_GIT_COMMIT_SHA`, `RENDER_GIT_COMMIT`, or a generic `GIT_COMMIT` /
   `SOURCE_COMMIT`). All instances of one deploy share the value, so a
   multi-instance or rolling deploy does not flap; there is deliberately NO
   per-process boot-id fallback (that would differ per instance and hard-reload
   in a loop behind a load balancer). With no fingerprint set, the id is the
   importmap hash exactly as before, so an SSR-only deploy is still missed:
   set `WEBJS_BUILD_ID` (or run on a platform that exports a commit env) to
   opt into SSR-deploy detection.

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

### Link prefetch

Same-origin in-app links are prefetched speculatively so a click
resolves from a warm cache with no round-trip. On by default (no per-link
opt-in needed), the way Next / Nuxt / SvelteKit ship auto-prefetch. The
prefetch request carries the same `X-Webjs-Have` header a real navigation
sends, so the server returns the same divergent fragment; that fragment
lands in a dedicated prefetch cache (separate from the back/forward
snapshot cache) and `fetchAndApply` consumes it via `prefetchTake` before
falling back to the network.

The default strategy is DEVICE-ADAPTIVE, because one strategy cannot serve
both input modalities. On a hover-capable fine pointer (mouse / trackpad)
the default is `intent` (warm on hover / focus, a real head-start before
the click). On touch the default is `viewport` (warm as links settle
on-screen), because a touch device has no hover and `touchstart` fires at
tap time, too late to front-run the navigation. The modality is detected
with `matchMedia('(hover: hover) and (pointer: fine)')`, not a user-agent
sniff. A per-link `data-prefetch` always overrides the adaptive default.

Per link, set `data-prefetch` (a valid-HTML `data-*` attribute, the shape
SvelteKit and Astro use; Next / Nuxt / Remix use a component prop, which
WebJs has no equivalent for since links are plain `<a href>`):

```html
<a href="/dashboard">adaptive: intent on pointer, viewport on touch (default)</a>
<a href="/dashboard" data-prefetch="intent">hover / focus / touch</a>
<a href="/dashboard" data-prefetch="render">eager on insert</a>
<a href="/dashboard" data-prefetch="viewport">on scroll-into-view</a>
<a href="/dashboard" data-prefetch="none">never</a>
```

Next-style aliases are accepted: `true` = `render`, `auto` = `viewport`,
`false` = `none`. `intent` waits a short dwell (~100ms) after hover/focus
so a pointer passing over a link does not fetch it. `viewport` uses an
IntersectionObserver at threshold 0.5 and waits a ~250ms dwell, cancelled
the instant the link scrolls back out, so a fast scroll through a long
list spends no requests (the same gate Astro / Next / Nuxt / Remix /
TanStack / Turbo apply). On touch, `touchstart` additionally warms the
tapped link itself (a single request for a link about to be navigated).
`render` and `viewport` are applied by a document scan on enable and after
each navigation.

Only internal links qualify, using the same eligibility as a click:
cross-origin, `download`, `target` other than `_self`, non-HTML
extensions, `data-no-router`, and pure same-page hash jumps are skipped.
Opt out with `data-prefetch="none"`, `data-no-prefetch`, or
`rel="external"`. Speculation is bounded by a concurrency cap (excess
requests queue and drain as slots free, rather than being dropped),
in-flight de-dupe, and an LRU + TTL cache, and is disabled entirely under
`Save-Data`, `prefers-reduced-data`, or a 2g `effectiveType` connection.
The guiding rule: snappy, but never at the cost of bloating the client
network tab; when the two conflict, the gate under-fetches. A mutating form submission and
`revalidate(url)` both evict the prefetch cache alongside the snapshot
cache, so a fragment prefetched before a mutation is never served stale.

There is no logout-style safeguard, matching every framework that
auto-prefetches: a prefetch issues a real GET, so a `/logout` or any
mutating endpoint MUST be a POST or a `<form>` submission (which the
router never prefetches), not a GET link. A native `<link rel="prefetch">`
in the document head is the browser's own mechanism and is left untouched.

The router dispatches a `webjs:prefetch` event on `document` the instant a
speculative fragment lands in the cache and becomes consumable (which is
strictly later than the request going out, since the entry is stored only
after the response body is read). The detail is `{ url, key, from: 'prefetch' }`,
mirroring `webjs:navigate` so one listener can split the two by `detail.from`.
Listen to instrument prefetch hit rate, or to gate work on a warm cache:

```ts
document.addEventListener('webjs:prefetch', (e) => {
  console.log('prefetched', e.detail.url); // fragment is now cached
});
```

### `webjs:before-cache` (strip transient state before a back/forward snapshot)

The router keeps a URL-keyed snapshot cache (Turbo's SnapshotCache pattern) so
Back/Forward restores instantly. Because a snapshot is a raw `outerHTML` clone of
the live page, anything OPEN at navigate-away time (a hover-card, a dropdown, a
toast) is captured open and **restored open** on Forward. To prevent that, the
router dispatches `webjs:before-cache` on `document` **synchronously, on the page
being cached, immediately before the `outerHTML` read** (detail `{ url }`). A
handler's DOM mutations are captured in the snapshot; the live edits are
invisible because the page is being navigated away from (Turbo's
`turbo:before-cache` contract). Reset transient state here:

```ts
document.addEventListener('webjs:before-cache', () => {
  document.querySelectorAll('[data-transient]').forEach((el) => el.remove());
  // close open menus, clear in-progress toasts, reset a wizard step, ...
});
```

The kit's overlays (hover-card, tooltip, dropdown-menu, dialog, alert-dialog,
sonner) already listen and reset their open state, so they come back closed.

### View Transitions (opt-in, all three swap paths)

The router can wrap a client navigation's DOM mutation in the native
[View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)
(`document.startViewTransition`), so a same-shell partial swap cross-fades
(or runs your `::view-transition-*` CSS) instead of snapping. It is OFF by
default and purely OPT-IN, so an unconfigured app behaves exactly as
before (no animation surprise, no regression in a browser without the
API). Opt in by adding a meta to the page head, mirroring Turbo's
`<meta name="view-transition">` convention:

```html
<!-- in the root layout's <head>, or any page's head -->
<meta name="view-transition" content="same-origin">
```

The accepted opt-in value is `same-origin` (every client-router swap is
same-origin by construction, so it reads as "animate these in-app
navigations"); any other value, or the meta being absent, keeps
transitions off. The meta is re-read PER navigation, so a page can turn
transitions on or off as the user moves through the app (the head merge
brings in the new page's head).

When enabled and supported, the transition wraps ALL THREE swap paths,
the deepest-marker layout swap, the `<webjs-frame>` swap, AND the
full-body fallback, not just the full-body case (the inverse of what an
author expects, since the marker + frame swaps are the common
designed-for paths). The transition wraps the DOM MUTATION ONLY, never
the fetch (which already happened); the browser captures the
before/after around the synchronous swap. When `startViewTransition` is
unavailable (Firefox / older Safari), the swap runs synchronously,
byte-identical to the no-transition path, with no flash and no throw.

### Persisting elements across a swap (`data-webjs-permanent`)

An element marked `data-webjs-permanent` (it MUST also carry an `id`)
survives a navigation as the SAME live DOM node, by node identity, so a
playing `<audio>` / `<video>`, a live widget, an open menu, or any element
with accumulated JS state keeps running across the swap instead of being
destroyed and re-created from the incoming HTML. Mirrors Turbo's
permanent-element behaviour.

```html
<audio id="player" data-webjs-permanent controls src="/track.mp3"></audio>
```

Mechanism: before the destructive swap, for each `[data-webjs-permanent]
[id]` in the CURRENT DOM the router looks for a matching `#id` in the
INCOMING document; when BOTH exist, the LIVE node is moved into the
incoming tree's position (replacing the incoming placeholder), so the swap
adopts the live node rather than recreating it. It works for the
full-body path AND the in-region (marker / frame) paths, and is a STRONGER
guarantee than the keyed reconciler (which preserves identity for matched
keyed children): a permanent node keeps EXACT identity even where the
reconciler would otherwise recreate it. Rules:

- The element must have an `id` (the match key) and the attribute on BOTH
  the current and incoming render of the page.
- An id present in the current but ABSENT from the incoming doc is NOT
  force-persisted (it is being removed; the swap removes it as usual).
- Only a CURRENT node actually carrying `data-webjs-permanent` is moved
  (an incoming `#id` that resolves to a non-permanent current element is
  left untouched).
- The node is placed exactly where the incoming document puts it, so it
  never escapes a frame / region boundary.

Progressive enhancement: with JS off, `data-webjs-permanent` is an inert
attribute and the navigation is a normal full-page load.

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

### Page server actions (a `<form>` that re-renders with errors)

The server side of the no-JS validation pattern is a page `action`
export. A `page.{js,ts}` may export an `action` alongside its default
render function. A non-GET/HEAD submission to that page's own URL runs
the action (inside the page's segment middleware), so a plain
`<form method="POST">` works with JS disabled AND through the client
router, same UI either way.

```ts
// app/signup/page.ts
import { html } from '@webjsdev/core';
import { signup } from '../../modules/auth/actions/signup.server.ts';

export async function action({ formData }: { formData: FormData }) {
  const email = String(formData.get('email') || '').trim();
  const values = { email };
  if (!email.includes('@')) {
    return { success: false, fieldErrors: { email: 'Enter a valid email' }, values, status: 422 };
  }
  const r = await signup({ email });
  if (!r.success) return { success: false, fieldErrors: { email: r.error }, values, status: r.status };
  return { success: true, redirect: '/login' };
}

export default function Signup({ actionData }: { actionData?: { fieldErrors?: Record<string, string>; values?: Record<string, string> } }) {
  const errors = actionData?.fieldErrors || {};
  const values = actionData?.values || {};
  return html`
    <form method="POST">
      <input name="email" type="email" value=${values.email || ''} required>
      ${errors.email ? html`<p class="error">${errors.email}</p>` : ''}
      <button>Sign up</button>
    </form>
  `;
}
```

The action receives `{ request, params, searchParams, url, formData }`
(`formData` is the already-parsed body, `request` is the raw Request)
and returns an `ActionResult`. The server interprets the result:

- **Success** (`{ success: true, redirect? }`, or any non-`false`
  result): a `303 See Other` to `result.redirect` if present, else the
  page's own path (Post/Redirect/Get, so a reload does not resubmit).
  This 303 is the success-result path only; a `redirect()` *thrown* from
  the action is a separate case (see below).
- **Failure** (`{ success: false, fieldErrors?, values?, status? }`):
  re-SSR the SAME page with `status` (default `422`) and the result on
  `ctx.actionData`. The page reads `actionData.fieldErrors.<field>` for
  messages and `actionData.values.<field>` to repopulate native
  `<input value=...>`, so the user's typed input survives.
- A thrown `notFound()` yields a 404. A thrown `redirect()` carries no
  baked-in status; the catching site picks the convention: thrown from an
  action (a POST) it defaults to `307 Temporary Redirect`
  (method-preserving, so the bounce keeps the POST's intent), thrown
  during a GET page/layout render or gate it defaults to `302 Found` (the
  code an auth bounce conventionally wants). An explicit status overrides
  either default, in both the positional `redirect(url, 308)` and the
  options `redirect(url, { status })` forms. PRG's 303 (above) is only
  the success-result path, distinct from these thrown defaults.

A page WITHOUT an `action` export keeps the old behavior, a non-GET to
it 404s. There is no form library: native input repopulation plus the
browser's Constraint Validation API (`required`, `type="email"`,
`minlength`) cover the rest. Field-level errors come from the server
action result. See `agent-docs/recipes.md` for the full recipe and the
`ActionResult` shape.

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

Every programmatic nav scroll (the popstate restore and the
scroll-to-top on a forward nav) is issued with `behavior: 'instant'`, so
an app-level `html { scroll-behavior: smooth }` does not animate it. The
restore matches a native page load (an instant jump), not a visible
slide. The one nav scroll left smooth is a hash-anchor (`#section`)
target, where smooth scrolling is the intent. So `scroll-behavior:
smooth` on `<html>` only affects in-page anchors, not route
transitions. In development the router logs a one-time console hint when
it detects that setting (and notes that pairing it with a sticky
`backdrop-filter` header can flash on iOS during navigation).

Inner scroll containers (e.g. `.docs-sidenav`) are preserved
automatically by the outer-layout-DOM-identity invariant. They stay
mounted across nav and keep their `scrollTop` natively.

### `<webjs-frame>` escape hatch

`<webjs-frame>` is webjs's take on **Turbo Frames** (Hotwire Turbo), so the
mental model and most `<turbo-frame>` muscle memory transfer directly: a lazy,
URL-addressable region that swaps on its own, driven by a link or form
targeting its id. It is the unit for a region that loads or refreshes
INDEPENDENTLY of a full-page navigation (something a page/layout, which
re-renders only at the route level, cannot express), and it ships zero
component JS. A frame's route can itself use `<webjs-suspense>`, so a deferred
(`loading="lazy"`) frame whose data is slow streams that data behind a fallback
inside the frame (one caveat: a streamed framed route skips the byte-saving
subtree extraction, so the full page renders and the client slices out the
region). See the data-fetching doc page (`docs/app/docs/data-fetching/page.ts`)
for the async-render vs `<webjs-suspense>` vs `<webjs-frame>` vs `<webjs-stream>`
decision boundary.

For partial-swap regions NOT tied to a folder layout (a marketing-page
widget, tabbed UI, etc.), wrap the region in a frame:

```ts
html`<webjs-frame id="activity">…contents…</webjs-frame>`
```

On click, the router walks `closest('webjs-frame')` from the click
target. If a frame is found AND the response contains a matching
`<webjs-frame id="...">`, the swap is scoped to that frame's children,
which takes precedence over the layout-marker mechanism.

#### External targeting (`data-webjs-frame`) and `_top` breakout

A trigger does NOT have to be nested inside the frame it drives. Mirroring
Turbo's `data-turbo-frame`, an `<a>` or `<form>` (or any ancestor of it)
carrying `data-webjs-frame="<id>"` drives the frame with that id, resolved
via `getElementById` in the current document. So an external nav/sidebar
link or a filter form can drive a content frame it does not enclose:

```ts
html`
  <nav data-webjs-frame="results">
    <a href="/products?sort=new">Newest</a>
    <a href="/products?sort=top">Top rated</a>
  </nav>
  <form action="/products" data-webjs-frame="results">…filters…</form>

  <webjs-frame id="results">…current results…</webjs-frame>
`
```

Resolution precedence: an explicit `data-webjs-frame` WINS over the
closest-enclosing-frame default. So a link physically inside frame A that
carries `data-webjs-frame="b"` drives frame B.

- **`data-webjs-frame="_top"`** is a reserved token: it forces a full-page
  navigation (the normal layout/marker swap or a full nav), breaking OUT of
  the enclosing frame. Put it on a link inside a frame that should escape it.
- **An id that does not resolve** to a live `<webjs-frame>` emits a one-time
  `console.warn` and falls back to a normal navigation (fail-safe; the
  router never throws and never swaps the wrong region).
- **With JS disabled** a `data-webjs-frame` link is an inert attribute on a
  plain `<a href>`, so the click is a normal full-page navigation, the
  correct progressive-enhancement fallback.

#### Busy state (`aria-busy` + `webjs:frame-busy`)

While a frame's navigation is in flight the router sets the native
`aria-busy="true"` on the frame element and clears it (to `"false"`) on
completion, on EVERY exit (a successful swap, a frame-missing response, an
HTTP/transport error, or an abort by a newer nav). So assistive tech
announces the loading state for free, and CSS can style the busy region:

```css
webjs-frame[aria-busy="true"] { opacity: 0.6; }
```

The router also dispatches a bubbling `webjs:frame-busy` event on the frame
at both edges, so app code can hook the start and finish:

```ts
document.addEventListener('webjs:frame-busy', (e) => {
  const { frameId, busy } = e.detail; // busy: true at start, false at finish
  spinner.toggle(frameId, busy);
});
```

#### `webjs:frame-missing` (response lacks the requested frame)

When a frame-scoped navigation's response does NOT carry a matching
`<webjs-frame id="...">` (e.g. an auth gate returns a login page without
the frame), the router does NOT fall through to a full-page swap, because
that would silently destroy the page. Instead it dispatches a cancelable,
bubbling `webjs:frame-missing` CustomEvent on the frame element (so a
document-level listener catches it) and returns.

- **Default (not prevented):** the router emits a one-line `console.warn`
  and leaves the frame UNCHANGED (its current content stays, now stale).
  No full-page swap ever happens.
- **Calling `preventDefault()`** keeps the framework silent and doing nothing
  further. The listener owns the outcome, e.g. it may call `navigate(url)`
  for a deliberate full swap, or `location.assign(url)` for a hard load.

`event.detail` is `{ frameId, url, document }`, where `frameId` is the
requested frame id, `url` is the navigation target, and `document` is the
parsed response document (so a listener can inspect what came back).

```ts
document.addEventListener('webjs:frame-missing', (e) => {
  // The frame wasn't in the response (auth redirect, say). Take over
  // with a deliberate full navigation to the URL the server returned.
  e.preventDefault();
  location.assign(e.detail.url);
});
```

#### Self-loading frames (`src` + `loading`, #253)

A `<webjs-frame>` can fetch its OWN content instead of waiting for a click
or a form. Give it a `src` and it self-fetches that URL as a frame nav and
applies the matching `<webjs-frame id>` subtree from the response into itself,
through the SAME frame-swap path a click-driven frame nav uses (so the busy
lifecycle, the navigation-error recovery, the keyed reconciler, and the
frame-missing fallback all apply for free).

```html
<!-- Eager (default): fetches on connect. -->
<webjs-frame id="rail" src="/widgets/rail"></webjs-frame>

<!-- Lazy: fetches when the frame first scrolls into view. -->
<webjs-frame id="comments" src="/posts/42/comments" loading="lazy">
  <p>Loading comments...</p>
</webjs-frame>
```

The `loading` attribute picks WHEN:

- **`loading="eager"`** (or absent, the default) fetches on `connectedCallback`.
- **`loading="lazy"`** fetches when the frame first enters the viewport, reusing
  the same IntersectionObserver budget (`rootMargin: '200px'`) as a
  `static lazy = true` component.

A `src` change after connect re-loads. Eager connect, the lazy observer, and a
`src` mutation never double-fetch the same URL (a per-element loaded/loading
guard keyed on the resolved URL coalesces them). The request carries the same
`x-webjs-frame: <id>` header a click-driven frame nav sends, so a `src` self-load
and a click that targets the same frame produce identical DOM.

**The server returns ONLY the requested subtree.** When a request carries
`x-webjs-frame: <id>` and the route renders a `<webjs-frame id>` with that id,
the server returns JUST that frame subtree (extracted from the full render, so
byte-equivalent to what the client would slice from a full-page response) rather
than the whole page. So a region swap pays only for the region, not the full
document shell and every other region, the same spirit as the `X-Webjs-Have`
partial-nav optimization. When the requested frame is NOT in the rendered output
(an auth redirect to a login page, a route that dropped the frame), the server
falls back to the full page and the client handles the absence via
`webjs:frame-missing`. A request with no `x-webjs-frame` header is unaffected
(byte-identical full-page render).

**PROGRESSIVE ENHANCEMENT CAVEAT: a `src`-driven frame is JS-DEPENDENT.** The
browser does NOT natively fetch `<webjs-frame src>` (unlike `<iframe>`), so with
JS off the frame shows only whatever children were server-rendered into it. Use
`src`/`loading` for DEFERRED content (comments, a recommendations rail, an
expensive card) where a JS-off placeholder / empty state is acceptable, exactly
the lazy-content use case. For content that MUST exist without JS, render it
server-side into the frame instead of using `src` (the self-load then replaces
those fallback children).

### Stream actions: surgical element-level updates (#248)

`<webjs-stream>` is webjs's take on **Turbo Streams** (Hotwire Turbo); the
action set (`append` / `prepend` / `before` / `after` / `replace` / `update` /
`remove`) mirrors `<turbo-stream>`, so that muscle memory transfers directly. It
is the ONLY surgical single-element update primitive (and the live-channel
applier); a region swap or a `<webjs-frame>` reload redraws a whole region, and
`<webjs-suspense>` is for streaming, so none of them cover "append one row".

A region swap (a layout marker or a `<webjs-frame>`) is the right tool for "this
part of the page changed". It is too coarse for "append ONE comment", "remove
ONE row", "bump a count", or "insert a toast". For those, a server response can
declare per-element actions, carried as plain HTML, a `<webjs-stream action
target>` wrapping one `<template>`:

```html
<webjs-stream action="append" target="comments">
  <template><li>Nice post!</li></template>
</webjs-stream>
```

The `<webjs-stream>` element clones its `<template>` content on connect, applies
the action against the target by native DOM, then removes itself. Actions
(Turbo's set): `append` / `prepend` (last / first child of the target id),
`before` / `after` (sibling of the target), `replace` (the target element
itself), `update` (the target's children), `remove` (delete the target, no
template). A `targets="<css-selector>"` applies to every match instead of a
single `target` id.

**One applier, two delivery paths.**

1. **HTTP (content-negotiated form).** A `<form>` submission rides the client
   router, which adds `Accept: text/vnd.webjs-stream.html`. The server returns a
   stream ONLY when that Accept is present; the router then applies the
   `<webjs-stream>` body surgically (no region swap). With JS OFF the browser
   sends no such Accept, so the SAME endpoint returns a normal render/redirect
   and the form is a plain full-page POST. The grammar is additive and
   progressive-enhancement-safe.

2. **Live channel (`broadcast()` / `connectWS`).** `renderStream(message)` parses
   a server-pushed payload and inserts the `<webjs-stream>` elements (which
   self-apply), so chat / notifications / presence reuse the SAME applier:

   ```js
   import { connectWS, renderStream } from '@webjsdev/core';
   connectWS('/feed', { onMessage: (m) => renderStream(m) });
   ```

**Server-side, build the payload with the `@webjsdev/server` helpers:**

```ts
// app/post/[id]/route.ts (or a page `action`)
import { stream, streamResponse, acceptsStream } from '@webjsdev/server';
import { broadcast } from '@webjsdev/server';

export async function POST(req: Request, { params }) {
  const comment = await addComment(params.id, await req.formData());
  const html = stream.append('comments', `<li>${escapeHtml(comment.text)}</li>`);
  // Fan the SAME action out to every other connected viewer.
  broadcast(`post:${params.id}`, html);
  // Negotiate: a stream for the JS client, a redirect for the no-JS form.
  if (acceptsStream(req)) return streamResponse(html);
  return Response.redirect(`/post/${params.id}`, 303);
}
```

`stream.*` returns the `<webjs-stream>` string (the target id is
attribute-escaped; the CONTENT is server-authored and NOT escaped, so escape any
user substring yourself, like an `html` hole). `streamResponse(...)` wraps one or
more parts in a `Response` with the stream content type. A page `action` may
return `streamResponse(...)` directly (it is honored verbatim); on the no-JS
branch return a normal `ActionResult` instead. `renderStream` is auto-registered
by the client router, so it (and the `<webjs-stream>` element) is available
on any page that loads `@webjsdev/core` (the router auto-enables there).

### Streaming RPC results: an action returns a stream (#489)

`<webjs-stream>` above is the SERVER-PUSHED render-side primitive (the server
decides what changes and ships HTML actions). Streaming RPC is the complementary
PULL-side primitive: a `'use server'` action that RETURNS a `ReadableStream`, an
async iterable, or an async generator streams its chunks over the single RPC
response, and the client gets back an async iterable to `for await`. This is the
token-stream / progress / incremental-result case a component consumes
imperatively after an interaction.

```ts
// modules/ai/actions/stream-answer.server.ts
'use server';
export async function* streamAnswer(prompt: string) {
  for await (const token of llm.complete(prompt)) yield token;
}
```

```ts
// inside a component
for await (const token of await streamAnswer(q)) {
  this.text.set(this.text.get() + token);   // renders incrementally
}
```

The wire is a sequence of length-prefixed frames (`application/vnd.webjs+stream`):
each chunk is rich-serialized (a `Date` / `Map` / `BigInt` round-trips), then a
terminal frame closes the stream. Detection is purely on the RETURN value, so any
verb (#488) can stream and there is no config export to declare. Back-pressure is
respected (a slow consumer throttles a fast producer), and the request
`AbortSignal` (#492) cancels the source generator on a client disconnect or a
superseded `async render()`. A streamed result is never cached, ETagged, or
seeded (#472); a mutation that streams still emits its `X-Webjs-Invalidate`
header. A mid-stream throw surfaces as an error from the iterable (the HTTP status
is already 200, so wrap the `for await` in `try/catch`), the author message in
prod. A truncated stream (a server crash, a dropped connection) also throws
rather than completing silently: a healthy stream always ends in an explicit
terminal frame, so a missing one is an error. For a slow region you want behind a fallback on the FIRST paint, use
`<webjs-suspense>` instead; streaming RPC is for an imperative stream consumed
after an interaction. Full reference: the [Data fetching](https://docs.webjs.dev/docs/data-fetching) page.

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

**When to use it.** You want a CSS-only progress affordance (a top bar, a `cursor: progress`) while a client navigation is in flight, with no JavaScript. For a JS-driven indicator, skip this and listen for the `webjs:navigate` event (and `webjs:submit-start` for forms) instead, which always fires.

**How to use it.** It is OPT-IN. Add `data-webjs-nav-progress` to your `<html>` element (once, in the root layout), and the router then sets a `data-navigating` attribute on `<html>` while a nav is in flight (deferred 150ms, so quick sub-150ms navs never trigger it). Style off that attribute:

```html
<html data-webjs-nav-progress>   <!-- opt in once -->
```

```css
html[data-navigating] { cursor: progress; }
html[data-navigating]::after {
  content: ''; position: fixed; top: 0; left: 0; right: 0; height: 2px;
  background: var(--accent); animation: progress 1s ease-in-out infinite;
}
```

**Why it is opt-in, not default (#610).** Toggling an attribute on `<html>` re-runs global style resolution, and on WebKit (so every iOS browser) that re-resolves the page's `oklch()` / `color-mix()` design tokens to an equivalent oklab representation and repaints them for one frame. On a token-driven theme that is a visible background flash, worst on a slow mobile forward nav (which exceeds the 150ms defer). So without the opt-in the attribute is never written and the flash cannot happen. Enable it only when your theme does not lean on wide-gamut color tokens, or use the event-based path above.

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
