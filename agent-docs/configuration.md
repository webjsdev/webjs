# Server configuration (the `package.json` `"webjs"` block) + observability

The full reference for the `package.json` `"webjs"` config block (security headers, CSP, redirects, trailing-slash, basePath, allowedOrigins, client-router opt-out, ingress caps) plus the observability surfaces. Moved out of `AGENTS.md` to keep it lean. Env vars live in `agent-docs/built-ins.md`.

---

## Secure response headers (on by default, overridable per path)

The server sets a baseline of standard security headers on every response, so a scaffolded app is not clickjackable or MIME-sniffable out of the box (no reverse proxy needed for the baseline). The defaults are literal HTTP headers, no abstraction:

| Header | Value | When |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | always |
| `X-Frame-Options` | `SAMEORIGIN` | always |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | always |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | always |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | production AND HTTPS only |

HSTS is gated to production over HTTPS, detected from `X-Forwarded-Proto` (the request the trusted edge proxy forwards). It honors the same proxy-trust posture as the rest of the framework (`WEBJS_NO_TRUST_PROXY=1` disables forwarded-header trust), so HSTS is never set on a plain-HTTP hop or in dev.

A default is only set when absent, so a header the app already set (in middleware, a `route.{js,ts}` handler, or `expose`) is never clobbered.

### Per-path overrides (`webjs.headers` in package.json)

Declare per-path header rules under `package.json` `"webjs": { "headers": [...] }`, shaped like Next's. `source` is a path pattern matched with the native URLPattern API (so `:param` and `:rest*` syntax works):

```jsonc
{
  "webjs": {
    "headers": [
      { "source": "/embed/:path*", "headers": [{ "key": "X-Frame-Options", "value": null }] },
      { "source": "/app/:path*",   "headers": [{ "key": "X-Frame-Options", "value": "DENY" }] }
    ]
  }
}
```

A rule can ADD a header, OVERRIDE a default (give a new value), or DISABLE a default on a path (a `value` of `null`, e.g. dropping `X-Frame-Options` on a public-embed route).

### Precedence (lowest to highest)

`secure defaults` < `webjs.headers` path config < `app middleware`. App middleware always wins (its headers are already on the response when the framework merges), the path config overrides defaults, and the defaults are the floor. The merge seam lives in `packages/server/src/headers.js` (`applySecurityHeaders`), which is also where the CSP layer (below) and future CORS policy plug in.

### Content-Security-Policy (nonce, opt-in)

CSP is OFF by default and opt-in via a `webjs.csp` key in `package.json`. When enabled the server MINTS a fresh per-request CSPRNG nonce, makes it the value `cspNonce()` returns during SSR (so the inline boot script, the importmap, and the `modulepreload` hints all carry it), and emits a literal `Content-Security-Policy` response header carrying that EXACT nonce. One minted value flows mint -> request store -> SSR (`cspNonce()`) -> header, so there is no drift, and it changes every request.

```jsonc
{ "webjs": { "csp": true } }                       // strict default policy
{ "webjs": { "csp": {                              // custom
  "directives": { "connect-src": "'self' https://api.example.com" },
  "reportOnly": true                               // emits *-Report-Only
} } }
```

`true` enables a strict-dynamic + nonce posture tuned for webjs's own output (`script-src 'nonce-<minted>' 'strict-dynamic' 'self' https:`, `default-src 'self'`, `object-src 'none'`, an inline-style allowance for the Tailwind runtime). An object merges `directives` over those defaults (a `null` value drops a default directive), and `reportOnly: true` emits `Content-Security-Policy-Report-Only`. A `__NONCE__` placeholder inside any directive value is substituted with the minted nonce per request. A CSP header the app already set (middleware, a route handler, or the `webjs.headers` config) is never clobbered. Mechanism: `mintNonce` / `readCspConfig` / `buildCspHeader` in `packages/server/src/csp.js`, minted in `handle()` and stored on the request scope via `setCspNonce` (`packages/server/src/context.js`); `cspNonce()` reads that store, falling back to an inbound CSP request header (the legacy consume-only path) when no nonce was minted. Read the nonce in a layout/page with `import { cspNonce } from '@webjsdev/core'` to stamp it on your own inline `<script>` tags.

---

## Declarative redirects: `webjs.redirects` in package.json (#254)

WebJs already has `redirect(url)` (an imperative, request-time throw sentinel). For a MOVED URL (old-path -> new-path), SEO wants a DECLARATIVE permanent redirect so link equity transfers and search engines update their index. Declare those under `package.json` `"webjs": { "redirects": [...] }`, an array of `{ source, destination, permanent?, statusCode? }`, cohesive with the `webjs.headers` config:

```jsonc
{
  "webjs": {
    "redirects": [
      { "source": "/old", "destination": "/new" },
      { "source": "/blog/:slug", "destination": "/posts/:slug" },
      { "source": "/legacy", "destination": "/", "permanent": false },
      { "source": "/docs", "destination": "https://docs.example.com" }
    ]
  }
}
```

- **`source`** is a path PATTERN matched with the native URLPattern API (so `:param` and `:rest*` syntax works), exactly like `webjs.headers`.
- **`destination`** is the target: a path, a path referencing named groups captured by `source` (`/posts/:slug` filled from `/blog/:slug`), or an absolute URL (an external redirect; group substitution applies there too).
- **`permanent`** chooses the status: `true` (the DEFAULT) is **308 Permanent Redirect**, `false` is **307 Temporary Redirect**. 308 / 307 are the MODERN choice because they preserve the request method and body (a redirected POST stays a POST). The legacy equivalents are **301 (permanent)** and **302 (temporary)**, which do not guarantee that; set `statusCode` explicitly (e.g. `"statusCode": 301`) when a tool needs a specific legacy code. `statusCode` wins over `permanent`.

**Query string is preserved.** The incoming query string is appended to the destination by default (a destination carrying its own query is merged, the destination's keys winning), matching Next.js.

**Where it applies.** At the very START of request handling (in `dev.js`'s `produce()`, before the probes, routing, SSR, or asset serving), so a matched source returns the redirect immediately and never reaches the router. Framework-internal `/__webjs/*` paths are never redirected. The secure-header + conditional-GET funnel still wraps the redirect Response.

**Config robustness.** Patterns are compiled ONCE at boot, not per request. A malformed entry (bad pattern, missing/empty `destination`, invalid `statusCode`) is DROPPED at config-load with a one-line warning and never crashes the request pipeline (the same fail-safe posture `webjs.headers` / `webjs.csp` use), so a single typo never disables the valid rules around it. Mechanism: `compileRedirectRules` / `applyRedirects` in `packages/server/src/redirects.js`.

**Avoiding redirect loops (your responsibility).** There is no server-side loop guard, matching Next.js. A rule whose `destination` matches another rule's (or its own) `source` redirects forever (the browser eventually aborts it). Make sure a `destination` does not land on a path that another rule moves again. Captured groups are kept percent-encoded by `URLPattern`, so a user-controlled `:slug` cannot escape the origin into an open redirect; only an app-authored `destination` literal controls the target.

---

## Trailing-slash policy: `webjs.trailingSlash` in package.json (#255)

webjs's file router matches `/about` AND `/about/` against the same route (every route pattern ends with `/?$`, so both render IDENTICAL HTML). That is fine for serving but bad for SEO (search engines treat the two URLs as duplicate content that splits link equity) and for the client-router cache (two keys for one page). The trailing-slash policy picks ONE canonical form and 308-redirects the other to it. Declare it under `package.json` `"webjs": { "trailingSlash": ... }`, cohesive with `webjs.redirects` / `webjs.headers` / `webjs.csp`:

```jsonc
{ "webjs": { "trailingSlash": "never" } }    // /about/ -> /about (recommended)
{ "webjs": { "trailingSlash": "always" } }   // /about  -> /about/
{ "webjs": { "trailingSlash": "ignore" } }   // no canonicalization (the default)
```

- **Values.** `"never"` strips a trailing slash, `"always"` adds one, `"ignore"` (or absence, or any unrecognized value) does nothing.
- **Default is `"ignore"` (non-breaking).** An app that set no policy keeps serving both forms exactly as before; the feature is purely opt-in. **The recommendation for most apps is `"never"`** (the cleaner canonical form), but WebJs does not impose it, so adding the feature never silently starts 308-ing an existing app.
- **Status is 308 Permanent Redirect**, so SEO link equity transfers and a redirected POST stays a POST.
- **Exemptions.** The ROOT path `/` is always left alone under either policy. Under `"always"`, a path whose last segment looks like a FILE (contains a dot, e.g. `/foo.js`, `/image.png`) is NOT given a trailing slash, since a file is a leaf, not a page directory. Framework-internal `/__webjs/*` paths are exempt. The query string and hash are preserved on the redirect.

**Order vs `webjs.redirects`.** The declarative redirects run FIRST, then the survivor is slash-canonicalized. So an explicit `webjs.redirects` rule always wins. This is NOT loop-free: a redirect whose `destination` CONTRADICTS the slash policy creates an infinite loop. For example `{ trailingSlash: 'never', redirects: [{ source: '/x', destination: '/x/' }] }` ping-pongs forever (`/x` -> 308 `/x/` -> 308 `/x` -> ...). There is no server-side loop guard (matching the `webjs.redirects` warning above); keeping a redirect destination consistent with the slash policy is the author's responsibility. Applied at the very START of request handling (in `dev.js`'s `produce()`, right after `applyRedirects`, before routing / SSR), so the canonical URL reaches the router. Mechanism: `readTrailingSlashPolicy` / `applyTrailingSlash` in `packages/server/src/redirects.js`.

---

## Sub-path deployment: `webjs.basePath` in package.json (#256)

An app served under a sub-path (`example.com/app/`) behind a proxy that does NOT strip the prefix needs every framework-emitted absolute URL to carry the prefix, or module resolution 404s and the page never hydrates. Declare it under `package.json` `"webjs": { "basePath": ... }`, cohesive with `webjs.redirects` / `webjs.trailingSlash` / `webjs.headers` / `webjs.csp`:

```jsonc
{ "webjs": { "basePath": "/app" } }    // example.com/app/ mount
{ "webjs": { "basePath": "" } }        // root mount (the default, a pure no-op)
```

- **Normalization.** `'app'`, `'/app'`, and `'/app/'` all normalize to `'/app'`; a nested `'/foo/bar'` is allowed; an empty value / absence is the root-mount default. An unsafe value (`..`, a protocol, a `//host` network-path reference, whitespace, a backslash) is rejected to the empty default, so a typo fails safe instead of poisoning every emitted URL.
- **The model is strip-at-ingress + prefix-on-emit.** At the very START of request handling the prefix is STRIPPED from the request path and the request rewritten, so all downstream logic (route matching, the `/__webjs/*` checks, the source-file gate, the redirects / trailing-slash / `webjs.headers` configs, the HTML cache key) sees a root-relative path and works UNCHANGED. A request whose path is NOT under the base path is not for this app and 404s. On emit, every framework-emitted same-origin absolute URL gets the prefix prepended: the importmap targets (`/__webjs/core/*` and same-origin `/__webjs/vendor/*`; a cross-origin `https://` CDN vendor URL is left untouched), the modulepreload hrefs, the boot script's per-route module specifiers and lazy entries, the dev reload `src`, and the 103 Early Hints preloads.
- **Empty default is byte-identical.** With no `basePath` (or `""`) both seams are pure no-ops, so an unconfigured app serves exactly the same bytes as before this feature (guarded by a differential test).
- **OUT OF SCOPE (a documented follow-up).** Author-written `<a href="/about">` links and client-router navigation are NOT auto-prefixed (the same boundary Next draws between basePath-prefixing its `<Link>` and a raw `<a href>`; WebJs links are plain `<a href>`). The #256 acceptance covers framework-emitted URLs and request matching only.

Mechanism: `normalizeBasePath` / `readBasePath` / `withBasePath` / `stripBasePath` in `packages/server/src/base-path.js`; the ingress strip is in `dev.js`'s `produce()` (before `applyRedirects`), the importmap-target prefix in `importmap.js` (`setBasePath`), the boot / preload / reload prefix in `ssr.js`.

## Cross-origin allowlist: `webjs.allowedOrigins` in package.json (#659)

Server-action RPC CSRF is an Origin / `Sec-Fetch-Site` check (the Remix 3 / Go 1.25 model, see `agent-docs/built-ins.md` and the docs-site Security page): a state-changing request passes when `Sec-Fetch-Site` is `same-origin` / `none`, or (older browsers) the `Origin` host equals the request host. A legitimate CROSS-site caller (a reverse proxy serving the app under several hostnames, an admin panel on a sibling domain) is rejected unless its origin is allowlisted:

```json
{ "webjs": { "allowedOrigins": ["admin.example.com", "https://studio.example.com"] } }
```

- A bare host (`admin.example.com`) or a full origin (`https://studio.example.com`) are both accepted; only the host is compared.
- The check honors `x-forwarded-host`, so it works behind a CDN / reverse proxy (the Cloudflare-in-front-of-Railway setup) without extra config.
- Default `[]` (same-origin only). This is the CSRF allowlist ONLY; it does not configure CORS (use the `cors()` middleware for cross-origin `route.ts` reads).

Because the check needs nothing on the page (no token cookie), SSR HTML carries no `Set-Cookie`, so a visitor-identical page that opts into a public `Cache-Control` (via `metadata.cacheControl`, e.g. on a root layout) is CDN-edge-cacheable. Mechanism: `verifyOrigin` / `readAllowedOrigins` in `packages/server/src/csrf.js`, threaded through `invokeAction` (`actions.js`) from `dev.js`.

---

## Client-router opt-out: `webjs.clientRouter` in package.json (#629)

The client router is automatic: it auto-enables in the browser whenever `@webjsdev/core` loads (any page that ships a component), so SPA-style navigation needs no import (#620). `webjs.clientRouter: false` opts the WHOLE app out, for an app that genuinely wants plain full-page (MPA) navigation despite shipping interactive components.

```jsonc
{ "webjs": { "clientRouter": false } }   // pure MPA, full-page navigation
```

Default `true` (and any value other than the literal `false`), so an existing app is byte-identical. When off, the render path emits a tiny inline `<script>window.__WEBJS_CLIENT_ROUTER__=false</script>` BEFORE the deferred boot module; the core bundle's module-end auto-enable reads that flag and skips, so the components on the page still upgrade and stay interactive while link clicks and form submits fall back to native browser navigation. `disableClientRouter()` (from `@webjsdev/core`) stays the per-page programmatic escape hatch, and `enableClientRouter()` turns it back on.

Mechanism: `readClientRouterEnabled` (`packages/server/src/dev.js`) reads the key at boot and on every rebuild and calls `setClientRouterEnabled` (`ssr.js`); `wrapHead` emits the flag; the module-end gate lives in `packages/core/src/router-client.js`.

---

## Request ingress hardening: body-size limit (413) + server timeouts (on by default)

The server caps inbound request bodies and bounds connection lifetimes by default, so an uncapped RPC / route / form body is not a memory-exhaustion vector and a slow / hung connection is not a slowloris vector. Both are web-standard / node:http-native, configurable, and apply with secure defaults when unset (issue #237).

### Body-size limit (413 Payload Too Large)

Every path that READS a request body enforces a size cap: the server-action RPC endpoint, `route.{js,ts}` handlers that call `readBody`, the exposed-action REST path, and the no-JS page-action form path. All route through one bounded-read helper (`packages/server/src/body-limit.js`), so the limit is uniform.

| Limit | Default | Config key | Env override | Applies to |
|---|---|---|---|---|
| JSON / RPC | 1 MiB | `webjs.maxBodyBytes` | `WEBJS_MAX_BODY_BYTES` | RPC endpoint, `readBody`, exposed-action body |
| Form / multipart | 10 MiB | `webjs.maxMultipartBytes` | `WEBJS_MAX_MULTIPART_BYTES` | page-action form submissions |

```jsonc
{ "webjs": { "maxBodyBytes": 262144, "maxMultipartBytes": 5242880 } }
```

Precedence is env override > package.json > default. A value of `0` disables that cap (the deliberate opt-out, e.g. an edge already caps bodies). An over-limit body responds **413** and is NOT buffered whole: a `Content-Length` over the limit is a fast reject (the body is never read), and a chunked / streamed body with no declared length is counted while it streams and abandoned the instant it crosses the limit (never holding more than roughly one chunk past the cap). Large file uploads are a separate concern (#247); the multipart cap stays bounded.

### Server timeouts (slowloris / hung-connection defense)

`startServer` sets three node:http built-ins on the server. Secure production defaults, overridable.

| Timeout | Default | Config key | Env override | Meaning |
|---|---|---|---|---|
| `requestTimeout` | 30s | `webjs.requestTimeoutMs` | `WEBJS_REQUEST_TIMEOUT_MS` | Max time to receive the ENTIRE request (headers + body) |
| `headersTimeout` | 20s | `webjs.headersTimeoutMs` | `WEBJS_HEADERS_TIMEOUT_MS` | Max time to receive just the headers |
| `keepAliveTimeout` | 5s | `webjs.keepAliveTimeoutMs` | `WEBJS_KEEP_ALIVE_TIMEOUT_MS` | Idle window before a kept-alive socket is closed |

node semantics: `headersTimeout` MUST be strictly less than `requestTimeout` to ever fire (node measures both deadlines from the same request start), so a config that sets them inconsistently has `headersTimeout` clamped to just under `requestTimeout`. A value of `0` disables that timeout (node's own no-limit sentinel). Mechanism: `computeServerTimeouts` / `readBodyLimits` in `packages/server/src/body-limit.js`, read once at boot in `dev.js` (`readServerTimeoutsFromApp` / `readBodyLimitsFromApp`) and, for the body limits, stamped on every request scope so `readBody` enforces them too.

---

## Observability: access log, request id, onError hook, build-info (on by default) (#239)

Four standards-native observability surfaces, wired at the single response funnel in `dev.js`'s `handle()` (the same seam that applies security headers), so they cover pages, route handlers, server actions, and assets uniformly.

### Per-request access log

Every handled request emits ONE structured `info` line through the pluggable `logger` after the response is produced, carrying `method`, `path`, `status`, `durationMs`, and `requestId`. Never logs request bodies or secrets. The default logger writes one JSON object per line in prod, a readable line in dev. The framework's own `/__webjs/*` probe / static traffic is suppressed so it does not spam; app routes (including app `/api/*`) are logged.

```jsonc
{"level":"info","msg":"request","requestId":"4f1c…","method":"GET","path":"/dashboard","status":200,"durationMs":12.4}
```

`durationMs` is time-to-response-headers (a TTFB-like measure), not full-stream completion, so for a streaming / Suspense response it reflects when the headers were produced, not when the last chunk flushed.

### Request id / correlation id (`X-Request-Id` + `requestId()`)

Each request gets a correlation id, the native `crypto.randomUUID()`. An inbound `X-Request-Id` from a trusted upstream proxy is honored instead (one trace id across services); a missing or malformed inbound value falls back to a minted id (the inbound value is length-capped and token-charset validated, so a hostile value is never echoed back). The id is set on the response as `X-Request-Id` (never clobbering one the app already set), included in the access log and the error log, and readable in any server-side code with `requestId()` from `@webjsdev/server` (returns `null` outside a request scope), the same context-helper ergonomics as `headers()` / `cookies()`.

```ts
import { requestId } from '@webjsdev/server';
export async function GET() {
  return Response.json({ traceId: requestId() }); // same id as the X-Request-Id header
}
```

### `onError` hook (APM / Sentry integration point)

Register an error sink via `createRequestHandler({ onError })` (and `startServer({ onError })`). It is called with `(error, { request, requestId, phase })` whenever the request pipeline catches an unhandled error: the 500 path (a thrown route handler / middleware / page render, labeled phase `handle` / `middleware` / `ssr` / `metadata`) or a server action that throws unexpectedly (phase `action`). **The contract is best-effort:** a throwing `onError` is caught and ignored so it can never crash the response, and the hook is purely additive (webjs's existing sanitized response is unchanged: a thrown route handler / page render returns a generic 500, and a thrown server action returns a generic message + a correlation `digest` (#749), never the raw message or the stack in prod). The hook fires BEFORE the sanitized response is sent, so the sink sees the original error. The `requestId` ties the report to the access-log line.

```ts
const app = await createRequestHandler({
  appDir: process.cwd(),
  onError(error, { request, requestId, phase }) {
    Sentry.captureException(error, { tags: { requestId, phase } });
  },
});
```

### Boot-time instrumentation hook (`instrumentation.{js,ts}`, #848)

An optional app-root `instrumentation.{js,ts}` (sibling of `app/`, like
`env.js` / `readiness.js`) default-exports (or names) a `register()` function
the framework runs ONCE at boot, after env validation and before the route
table is built, so observability plumbing (OpenTelemetry, an APM) starts before
any request. Absent file is a no-op (opt-in); a throwing `register()` is logged,
not fatal. Inside it, call `setOnError(fn)` (from `@webjsdev/server`) to register
an error sink that **composes with** the `createRequestHandler({ onError })`
option (both fire, so the file-based hook and the option coexist).

```ts
// instrumentation.ts (app root)
import { setOnError } from '@webjsdev/server';
export function register() {
  // start tracing, then wire an error sink that composes with opts.onError:
  setOnError((error, { requestId, phase }) => reportToApm(error, { requestId, phase }));
}
```

A separate app-root `instrumentation-client.{js,ts}` is imported FIRST in the
client boot `<script type="module">`, so it runs before app modules (mirrors
Next's `instrumentation-client`). Use it for browser-side observability init.
Note: because it always loads, a page that would otherwise ship zero JS (a fully
static / elided route) emits a boot script when this file is present, so add it
only when you genuinely want client instrumentation app-wide.

### Build-info endpoint (`GET /__webjs/version`)

Returns JSON describing the live build, alongside the `/__webjs/health` and `/__webjs/ready` probes, so a deploy can curl it to confirm which build is serving. No secrets; answered before the analysis warms (like the other probes), so it responds on a cold instance. `Cache-Control: no-store`.

```jsonc
{ "version": "0.8.10", "build": "<importmap-hash>", "node": "v24.4.0", "uptime": 38.21 }
```

`version` is the `@webjsdev/server` framework version (read from its own `package.json`), `build` is the published build id (the reload signal the client router reads from `data-webjs-build`; the importmap hash folded with the installed `@webjsdev/core` version, empty until the vendor map resolves). An app-source or SSR-only deploy is carried by a separate `X-Webjs-Src` / `data-webjs-src` signal that evicts client caches softly (#899); both are automatic content hashes, no env var, `node` is the running Node version, `uptime` is process uptime in seconds. Mechanism: `requestId()` / `setRequestId` in `packages/server/src/context.js`, `buildInfo` / `buildInfoResponse` in `packages/server/src/build-info.js`, all wired in `packages/server/src/dev.js`.

---

## Dev/start task orchestration: `webjs.dev` / `webjs.start` (#550)

`webjs dev` and `webjs start` run an app's per-environment orchestration
themselves, read from the `package.json` `"webjs"` block, so the framework
primitive is not a degraded run versus `npm run dev` / `npm start`. The npm
scripts become thin aliases (`"dev": "webjs dev"`), and both forms behave
identically. This replaces the old `predev` / `prestart` npm hooks +
`concurrently` watchers (which a bare `webjs dev` silently skipped, #452).

```jsonc
"webjs": {
  "dev": {
    "before":     ["webjs db migrate"],                                // one-shot, runs to completion first
    "regenerate": [                                                    // dev-only: rebuild a stale output ON REQUEST
      { "output":  "public/tailwind.css",
        "command": "tailwindcss -i ./public/input.css -o ./public/tailwind.css --minify",
        "inputs":  ["app", "components", "modules", "lib", "public/input.css"] }
    ],
    "parallel":   [],                                                  // long-lived children (rare; Tailwind uses regenerate instead)
    "watch":      ["../blog"]                                          // extra dirs to live-reload on, OUTSIDE the appDir
  },
  "start": {
    "before":     ["webjs db migrate"]                                 // one-shot, before serving
  }
}
```

- **`before`** (dev and start): commands run sequentially to completion BEFORE the server boots (the old `predev` / `prestart`: `webjs db migrate`, a registry copy). A non-zero exit ABORTS the boot with a clear message, so a failed migration never serves stale code/schema.
- **`regenerate`** (dev only, #967): on-request rebuilds of a stale build output, the durable way to keep a compiled asset fresh without a long-lived watcher. Each rule is `{ output, command, inputs }`: when the dev server is about to serve `output` and the newest mtime among `inputs` is newer than it (or the output is missing), the framework runs `command` to completion FIRST, then serves the fresh file. There is no watch process to die and no staleness window. Concurrent requests for the same output coalesce onto one compile. Read by the SERVER (`readRegenerateRules` in `dev-regenerate.js`), not the CLI. Prod does not recompile on request, so `start.before` builds the same output once; because dev and prod run the SAME command, their outputs cannot diverge. This is what the scaffold uses for Tailwind, in place of a `tailwindcss --watch`.
- **`parallel`** (dev only): long-lived child processes that run ALONGSIDE the server (the old `concurrently` watchers). They are spawned once in the parent (not on every hot-reload restart) and TORN DOWN on exit (SIGINT / SIGTERM / server exit), so a watcher cannot leak past the dev server. Prefer `regenerate` for a build output that is served (it cannot go stale); reserve `parallel` for a genuinely long-lived side process.
- **`watch`** (dev only, #894): extra directories the dev live-reload watcher follows IN ADDITION to the appDir. The dev server watches its appDir recursively, but an app that reads content from OUTSIDE its tree (the in-repo `website` renders posts from a repo-root `blog/` dir, a sibling of the app) sees no reload when that outside content changes. Each entry is resolved relative to the app root and MAY escape it (`"../blog"`); a change under one runs the same rebuild + browser reload as an in-tree edit. Opt-in: a missing/empty `watch` means the appDir is the only watched root, unchanged. A configured path that does not exist is skipped, an entry that overlaps the appDir (an ancestor or descendant) is dropped as redundant, and the usual `node_modules` / `.git` / `.webjs` / `db` noise is ignored under each extra root too.
- Each command runs through a shell, so a normal command line works. An empty / absent block means `webjs dev` / `start` run unchanged, so a plain app with no Tailwind/DB needs no config.
- A UI scaffold compiles a static Tailwind stylesheet, so `dev.before` / `start.before` run the Drizzle migration apply AND the Tailwind compile (`public/input.css` to the linked `public/tailwind.css`), and `dev.regenerate` recompiles that stylesheet on request in dev so a newly added utility class is never served stale (no `--watch` process to die). The app is fully styled with JavaScript disabled (a real stylesheet, not a browser-runtime compile). The in-repo apps (`examples/blog`, `website`, `docs`, ui-website) follow the same pattern.
- **Prod note:** `before` runs at boot, so `webjs start` runs `webjs db migrate` in-process to apply pending migrations. Drizzle has no client-codegen step (the schema IS the types, inferred at compile time), so there is nothing to run at image-BUILD time. Authoring a new migration from a schema change is a dev-time `webjs db generate`, committed to source control, not a boot step. So `CMD ["npm", "start"]` and `CMD ["webjs", "start"]` are equivalent.

`before` / `parallel` / `watch` are read by `readAppTasks` in `packages/cli/lib/app-tasks.js` (pure, unit-tested) and orchestrated in `packages/cli/bin/webjs.js` (`runBeforeSteps` / `startParallelTasks`); `regenerate` is read by the SERVER (`readRegenerateRules` in `packages/server/src/dev-regenerate.js`), which runs the compile inline on the request path.

---

## Server port resolution (`--port` / `PORT` / `.env`) (#447)

Both `webjs dev` and `webjs start` resolve the listen port with a single
precedence: **`--port` flag > `PORT` (a real exported env var OR a `PORT`
in the app's `.env`) > `8080`**. A real exported `PORT` still wins over a
`.env` `PORT`, matching the `.env` auto-load's shell-wins-over-file rule
(`process.loadEnvFile` does not clobber an already-set var).

The CLI loads `<appDir>/.env` BEFORE resolving the port, so a `PORT` set
only in `.env` is honored (it previously was not: the port was computed
from `process.env.PORT || 8080` before the server's own `.env` load ran,
so the file's `PORT` never reached the comparison and the server always
bound 8080). Mechanism: `loadAppEnv(appDir)` + the pure
`resolvePort(portFlag, env)` in `packages/cli/lib/port.js`, called by the
`dev` and `start` bins before listening.
