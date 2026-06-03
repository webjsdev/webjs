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
   the CDN. **SRI integrity (SHA-384) is computed on BOTH paths.** A
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
   deployments. No bundler runs at any point.

## No-build production model

webjs has no bundler and no `webjs build` step. The same `.js` / `.ts`
source files that run in dev are served as-is to the browser in
production. The Rails 7+ / Hotwire pattern:

- **Importmap-driven**: bare-specifier imports (`from "react"`) are
  resolved via `<script type="importmap">` emitted into the document
  head. By default each package resolves through `api.jspm.io/generate`
  to a `https://ga.jspm.io/npm:<pkg>@<version>/...` URL and the browser
  fetches it from the CDN directly, with an `integrity` SRI hash on every
  cross-origin entry (computed live at warmup for an unpinned app, or read
  from the pin file for a pinned one). `webjs vendor pin` commits the
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

**OUT OF SCOPE (a documented follow-up).** Author-written `<a href="/about">` links and client-router navigation are NOT auto-prefixed under a base path. This is the same boundary Next draws between basePath auto-prefixing its `<Link>` component and a raw `<a href>`: webjs links are plain `<a href>`, so an author targeting a sub-path deploy writes the prefix into their own hrefs (or a future helper does) until client-side prefixing lands. The acceptance for #256 covers the server-emitted-URL + matching surface only.

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
- **Actual request.** `next()` runs, then `Access-Control-Allow-Origin` (plus credentials / exposed headers) is attached. A disallowed origin gets NO `Access-Control-Allow-Origin`, and the browser blocks the cross-origin read, but the server still serves the response (CORS is browser-enforced, not a server gate; this matches the `expose()` path, which never 403s a mismatched actual request).
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
resolves from a warm cache with no round-trip. On by default with the
`intent` strategy (no per-link opt-in needed), the way Next / Nuxt /
SvelteKit ship auto-prefetch. The prefetch request carries the same
`X-Webjs-Have` header a real navigation sends, so the server returns the
same divergent fragment; that fragment lands in a dedicated prefetch
cache (separate from the back/forward snapshot cache) and `fetchAndApply`
consumes it via `prefetchTake` before falling back to the network.

Per link, set `data-prefetch` (a valid-HTML `data-*` attribute, the shape
SvelteKit and Astro use; Next / Nuxt / Remix use a component prop, which
webjs has no equivalent for since links are plain `<a href>`):

```html
<a href="/dashboard">intent: hover / focus / touch (default)</a>
<a href="/dashboard" data-prefetch="render">eager on insert</a>
<a href="/dashboard" data-prefetch="viewport">on scroll-into-view</a>
<a href="/dashboard" data-prefetch="none">never</a>
```

Next-style aliases are accepted: `true` = `render`, `auto` = `viewport`,
`false` = `none`. `intent` waits a short dwell (~100ms) after hover/focus
so a pointer passing over a link does not fetch it; `viewport` uses an
IntersectionObserver at threshold 0.5; `render` and `viewport` are
applied by a document scan on enable and after each navigation.

Only internal links qualify, using the same eligibility as a click:
cross-origin, `download`, `target` other than `_self`, non-HTML
extensions, `data-no-router`, and pure same-page hash jumps are skipped.
Opt out with `data-prefetch="none"`, `data-no-prefetch`, or
`rel="external"`. Speculation is bounded by a concurrency cap (excess
requests queue and drain as slots free, rather than being dropped),
in-flight de-dupe, and an LRU + TTL cache, and is disabled entirely under
`Save-Data` or `prefers-reduced-data`. A mutating form submission and
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
  result, or a thrown `redirect()`): a `303 See Other` to
  `result.redirect` if present, else the page's own path
  (Post/Redirect/Get, so a reload does not resubmit).
- **Failure** (`{ success: false, fieldErrors?, values?, status? }`):
  re-SSR the SAME page with `status` (default `422`) and the result on
  `ctx.actionData`. The page reads `actionData.fieldErrors.<field>` for
  messages and `actionData.values.<field>` to repopulate native
  `<input value=...>`, so the user's typed input survives.
- A thrown `notFound()` yields a 404, a thrown `redirect()` keeps its
  own 307/308 status (PRG uses 303 only for the success-result path).

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
which takes precedence over the layout-marker mechanism.

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
