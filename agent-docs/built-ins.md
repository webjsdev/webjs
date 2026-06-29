# Built-in essentials

`import { … } from '@webjsdev/server'`

Opinionated defaults: **set `REDIS_URL` and everything scales.**

## Caching (HTTP standards, Remix-style)

webjs uses standard HTTP caching via `Cache-Control` on responses. Let
browsers, CDNs, and reverse proxies handle caching. No framework cache
layer to debug.

```js
// route handler
export async function GET() {
  const posts = await db.query.posts.findMany();
  return new Response(JSON.stringify(posts), {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'Content-Type': 'application/json',
    },
  });
}

// SSR page metadata
export const metadata = {
  cacheControl: 'public, max-age=60',
};
```

App-level caching (DB query results, expensive computations) uses the
cache store directly:

```js
import { getStore, setStore, redisStore } from '@webjsdev/server';

// Default: memory store
const store = getStore();

// At app startup, switch to Redis for horizontal scaling
setStore(redisStore({ url: process.env.REDIS_URL }));
```

### Query result caching (`cache()`) + tag-based invalidation

For DB query / expensive-computation results, wrap an async function with
`cache(fn, { key, ttl })`. Same function + same args serve from the store
until the TTL expires:

```ts
// modules/posts/queries/list-posts.server.ts
'use server';
import { cache } from '@webjsdev/server';
import { db } from '../../../db/connection.server.ts';

export const listPosts = cache(
  async () => db.query.posts.findMany({ orderBy: { createdAt: 'desc' } }),
  { key: 'posts', ttl: 60 }
);
```

Cached values round-trip through the same rich serializer as the RPC wire
(`Date` / `Map` / `Set` / `BigInt` / typed arrays / cycles), so a warm cache
hit returns the exact same value shape as a cold miss (a row's `createdAt`
stays a `Date`, never degrades to a string). Cache keys are rich-serialized
too, so a `Map` / `Set` argument is a distinct key per value instead of
colliding. You do not need cached values to be JSON-plain.

To invalidate a read from an UNRELATED mutation (without importing the
wrapper), add `tags`. It is either a static `string[]` or a function
`(...args) => string[]` so a per-entity read tags with the id:

```ts
export const postById = cache(
  async (id: string) => db.query.posts.findFirst({ where: { id } }),
  { key: 'post', ttl: 300, tags: (id) => ['post:' + id] } // per-entity tag
);

export const listPosts = cache(
  async () => db.query.posts.findMany(),
  { key: 'posts', ttl: 60, tags: ['posts'] } // static tag
);
```

A mutating server action then calls `revalidateTag` after the write. It
works ACROSS modules (the comments module evicts a posts-module read with
no import of the wrapper):

```ts
// modules/comments/actions/create-comment.server.ts
'use server';
import { revalidateTag, revalidatePath } from '@webjsdev/server';
import { db } from '../../../db/connection.server.ts';
import { comments } from '../../../db/schema.server.ts';

export async function createComment(input) {
  await db.insert(comments).values(input);
  await revalidateTag('post:' + input.postId); // postById(postId) recomputes
  await revalidateTag('posts');                 // listPosts recomputes
  await revalidatePath('/blog');                // also evict the cached HTML
  return { success: true };
}
```

`revalidateTag('post:5')` evicts ONLY the id-5 entry, leaving other ids
cached; `revalidateTags([...])` clears several tags at once. This is the
fix for the old arg-key leak: the no-args `wrapped.invalidate()` (still
supported) only clears the base key, so tag a per-arg read and evict the
exact id by tag. An untagged `cache()` is untouched by any `revalidateTag`.

`revalidateTag` evicts cached `cache()` DATA; `revalidatePath` (below)
evicts cached HTML. Together they are the **server cache invalidation
surface**, both imported from `@webjsdev/server`.

**Multi-instance note.** The tag index is a thin, non-atomic
read-modify-write of a JSON array in the store. With a shared Redis store,
`revalidateTag` reaches every instance for the keys it can see, but two
instances appending to one tag concurrently can lose an append, so a
freshly-stored key on a peer might miss eviction and live until its TTL.
The index entry carries the cache TTL so it self-prunes. For strict
cross-instance invalidation, prefer a short `ttl` as the floor.

### Server HTML response cache (`export const revalidate`, ISR for no-build)

For a page that renders the same HTML for every visitor, opt into the
server HTML response cache so the SSR pipeline runs once per window
instead of per request (webjs's no-build equivalent of Next.js's Full
Route Cache + ISR). Declare a revalidation window on the page module:

```ts
// app/blog/page.ts
export const revalidate = 60;   // seconds: cache this page's HTML for 60s

export default async function Blog() {
  const posts = await listPosts();   // via a server query
  return html`...`;
}
```

**SAFETY (read this).** Caching is OPT-IN and conservative because a
wrongly-cached per-user page is a data leak. `export const revalidate`
is you asserting **this page is the same for everyone for N seconds**.
The cache is keyed by the FULL URL (path + search) only, with no per-user
keying, so a page that reads `cookies()` / a session / per-user data MUST
NOT set `revalidate`. The framework also refuses to cache (defense in
depth) any response that is not a `200`, is a streamed Suspense body,
sets any `Set-Cookie`, or runs under CSP (its body carries a per-request
nonce). SSR responses no longer carry a CSRF cookie (action CSRF is an
Origin / `Sec-Fetch-Site` check, not a token cookie), so a cacheable page
is cookieless and safe to share.

**Framework defense, not just the contract.** When the render reads
per-user state through a framework helper (`cookies()`, `headers()`,
`getSession()`, or `auth()`), the framework auto-marks the request
dynamic and refuses to cache it even if you set `revalidate`, warning you
once with the page path. So a wrong `revalidate` on a cookie-reading or
`auth()`-gated page fails safe (served fresh) instead of leaking. A
saas-dashboard page that does `const session = await auth()` is
auto-excluded. **The loud caveat:** this only catches reads THROUGH those
helpers. A page that varies its body by an inbound auth cookie /
`Authorization` header but reads it RAW (not via `cookies()` /
`headers()` / `getSession()` / `auth()`) and sets no new `Set-Cookie`
WILL be cached and served to a logged-out visitor. Read per-user request
state through the framework helpers (which auto-exclude the page), or
never set `revalidate` on a per-user page.

Evict on a write with `revalidatePath`:

```ts
// modules/blog/actions/publish-post.server.ts
'use server';
import { revalidatePath } from '@webjsdev/server';

export async function publishPost(input) {
  // ... persist via Drizzle ...
  await revalidatePath('/blog');   // next /blog request re-renders fresh
  return { success: true };
}
```

`revalidatePath(path)` evicts the SERVER HTML cache for one path;
`revalidateAll()` clears everything. This is distinct from the
client-side `revalidate()` from `@webjsdev/core`, which evicts the
BROWSER snapshot cache used by client navigation. Time-based eviction is
handled automatically by the store TTL (= the `revalidate` seconds).

**Multi-instance note.** `revalidatePath(path)` deletes a store key, so it
reaches every instance sharing a Redis store. `revalidateAll()` bumps an
in-process counter, so on a multi-instance deploy it only flushes the
instance it ran on; peers keep serving until their own TTL expires. For a
multi-instance (Redis) deploy, prefer a short `revalidate` TTL (the
time-based floor that always holds cross-instance), use `revalidatePath`
per mutation as the reliable cross-instance primitive, and treat
`revalidateAll()` as a single-instance / dev convenience.

## Content-hash asset URLs (`?v=<digest>`, immutable caching, prod) (#243)

Every served app module (`.js` / `.ts`) and `public/` asset used to ship `Cache-Control: public, max-age=3600` because its URL was un-versioned (the dev.js comment explains why `immutable` is unsafe without a per-file fingerprint, citing a real regression after a core version bump). The importmap build id does NOT change on an app-module byte change, so it cannot be the per-asset fingerprint. In PRODUCTION the framework instead appends a PER-FILE content hash, computed at serve time (no build step).

- **Emit (prod only).** `withAssetHash(url)` (in `packages/server/src/asset-hash.js`) appends `?v=<hash>` to a framework-emitted SAME-ORIGIN absolute URL: the importmap targets (`importmap.js` `buildImportMap`), the `<link rel="modulepreload">` hrefs, the boot script's module specifiers + lazy entries (`ssr.js`), AND the 103 Early Hints preloads (`dev.js` `routeFor`, so the hint warms exactly the URL the body requests). The hash is a 12-hex prefix of a sha-256 over the file BYTES, memoized in a `Map<absPath, hash>` and cleared on the fs.watch rebuild (so a changed file re-hashes). It is a NO-OP in dev (so dev output is byte-identical), a NO-OP for a CROSS-ORIGIN URL (a `https://` jspm vendor target, which jspm already versions and whose #235 SRI key is the un-hashed URL, plus already-version-named `/__webjs/vendor/*` bundles), and composes with `withBasePath` (basePath THEN `?v`, so a sub-path app emits `<basePath>/app/foo.js?v=hash`). The framework's own `/__webjs/core/*` runtime is fingerprinted too (it changes across core versions, the exact regression cited).
- **Nested relative imports in a served module are versioned to match the preload (#369).** A layout/page/component imports its dependencies with a bare relative specifier (`import '../components/x.ts'`). The browser resolves that against the importer's `?v=`-versioned URL, but a `?v` query is NOT inherited across relative resolution, so without intervention it fetches the un-versioned URL: a DIFFERENT cache key from the `?v=`-versioned `modulepreload` hint, which wastes the preload and downloads the module a second time (with the 1h fallback cache instead of `immutable`). So the prod serve path rewrites every same-origin relative / root-absolute static-import specifier in a served module to carry the target's `?v=<hash>` (the same hash its modulepreload href uses), collapsing both onto one immutable URL fetched once. Bare specifiers stay untouched (importmap-resolved, versioned at their target); `.server.*` imports stay bare (served as a stub, never preloaded). A no-op in dev, so dev source is byte-faithful.
- **App-module body is elision-aware, so the hash folds in the elision verdict.** An app module's SERVED body is not its raw source: the elision pass (#169) strips a side-effect import to a display-only component. That strip is a property of the IMPORTED component's verdict, so a component flipping display-only to interactive changes the importer's served body while its source stays byte-identical. Hashing the source alone would keep the same `?v` and a returning client would hold the stale immutable importer (the now-interactive component never imported, so never hydrated). So a relativized digest of the elidable + inert set is folded into every APP-module hash (`setElisionFingerprint` in `asset-hash.js`, set from `ensureReady`): a verdict flip busts every app module's `?v`. The fingerprint is empty when nothing is elidable, so a no-elision app's hash stays exactly `sha256(bytes)`; core / `public/` files are never elision-transformed, so they hash over their bytes alone.
- **Serve.** A request carrying a `?v=` query is served `Cache-Control: public, max-age=31536000, immutable` (the pathname, query stripped, resolves the file as today; only the cache header changes). An un-fingerprinted request keeps the 1h fallback. Dev stays `no-cache`.
- **Deploy-busts (the safety invariant).** A deploy that changes a module's bytes changes its hash, so its emitted URL changes, so a returning client fetches the new URL instead of serving the stale immutable copy. The build id stays a stable per-deploy fingerprint (the internal `importMapHash()` computation excludes the `?v`), so #241's HTML-cache keying is unaffected.

See `agent-docs/advanced.md` (content-hash caching + the preconnect hints) and `docs/app/docs/no-build/page.ts`.

## Conditional GET (ETag + If-None-Match -> 304, on by default) (#240)

Every CACHEABLE response carries a content-hash `ETag`, and a repeat request whose `If-None-Match` matches it gets a `304 Not Modified` with no body (RFC 7232). So a client holding an identical copy revalidates with a tiny 304 instead of re-transferring the whole body. Wired once at the response funnel in `dev.js`'s `handle()` (mechanism: `applyConditionalGet` in `packages/server/src/conditional-get.js`), so it covers SSR HTML pages, static assets in `public/`, app source modules, and the core / vendor runtime modules uniformly.

The ETag is WEAK (`W/"..."`). It hashes the UNCOMPRESSED body and the prod compression step reuses it across the identity / gzip / br codings, which a STRONG validator may not do (RFC 7232 2.3.3); `If-None-Match` already weak-compares, so a `304` still fires. The funnel only hashes a body the framework positively marked as buffered. A user `route.{js,ts}` handler returning a `ReadableStream` (and especially an SSE `text/event-stream`, whose stream never ends) carries no such marker, so the funnel never buffers it (no memory blow-up, no hang) and never ETags it.

**What gets an ETag + honors 304:**

| Response | ETag? | Why |
|---|---|---|
| A page with a PUBLIC `metadata.cacheControl` (e.g. `public, max-age=60`) | yes | Explicitly opted into caching; a repeat read 304s |
| Static assets (`public/*`), app `.js` / `.ts` modules, core / vendor modules | yes | Content-addressable; the ETag is the body hash |

**What is EXCLUDED (no ETag, never 304):**

| Response | Why excluded |
|---|---|
| A `no-store` page (the DEFAULT for dynamic / per-user pages) | Private content must never get a cross-session 304: a shared cache keyed on the URL could replay one user's validator to another |
| A `private` `Cache-Control` response | Same private-content reasoning |
| A streamed Suspense response (pending boundaries) | An unflushed stream cannot be hashed cheaply; the SSR pipeline flags it internally and the funnel skips it. Streaming responses are not conditional-GET cached |
| A `route.{js,ts}` handler returning a `ReadableStream` (incl. an SSE `text/event-stream`) | The body is not marked buffered, so the funnel never reads it. Buffering a stream would blow up memory, and an SSE stream never ends so the read would hang forever |
| Non-GET / non-HEAD, and any status other than 200 | A validator is only meaningful for a successful, replayable read |

**Stable-body handling.** The ETag is computed over the response's OWN body bytes, so an identical body yields an identical ETag across requests. Per-response varying bits that ride RESPONSE HEADERS (the `x-webjs-build` id, the CSP nonce on the header) are NOT part of the body hash, so they do not destabilise the ETag. The one body-level varying input is the CSP nonce stamped INTO the inline boot script: with CSP enabled the HTML body changes every request, so its ETag changes every request and a 304 is simply never produced for that page (correct, not a bug). CSP is off by default, so the common cacheable-page case has a stable body and a stable ETag. The 304 preserves the validators and caching headers (`ETag`, `Cache-Control`, `Vary`, plus the framework's `X-Webjs-Build` / `X-Request-Id` and any `Set-Cookie`) and drops only the body-describing headers (`Content-Length`, `Content-Type`, `Content-Encoding`), so a shared cache and the client router behave identically to a 200.

## Sessions

```js
// middleware.js: enable on all routes
import { session } from '@webjsdev/server';
export default session();   // auto: REDIS_URL → server-side, else → cookie

// in a page or action
import { getSession } from '@webjsdev/server';
const s = getSession(req);
s.userId = user.id;        // auto-saved after response
```

Cookie sessions (default): signed + encrypted, no server state. Store
sessions (with Redis): session ID in cookie, data in Redis. Requires
`SESSION_SECRET` env var.

## Authentication (NextAuth-style)

```js
// lib/auth.server.ts
import { createAuth, Credentials, Google, GitHub } from '@webjsdev/server';

export const { auth, signIn, signOut, handlers } = createAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const user = await db.query.users.findFirst({ where: { email: credentials.email } });
        if (!user || !verifyPassword(credentials.password, user.passwordHash)) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    Google(),    // reads AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
    GitHub(),    // reads AUTH_GITHUB_ID, AUTH_GITHUB_SECRET
  ],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.sub = user.id; token.role = user.role; }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub;
      session.user.role = token.role;
      return session;
    },
  },
});

// in a page or action
const session = await auth();
if (!session) throw redirect('/login');
```

JWT sessions by default (stateless, scales horizontally). OAuth providers handle the full redirect flow.

`auth()` resolves `{ user }` where `user` is `Record<string, unknown>` by default. To read the custom fields the callbacks set (`session.user.id`, `session.user.role`) without a cast and with typo-checking, type the session. Augment `AuthUser` for global typing, or use `createAuth<AppUser>(...)` for per-instance typing:

```ts
declare module '@webjsdev/server' {
  interface AuthUser { id: string; role: 'admin' | 'member'; }
}
```

Both are opt-in and types-only. See `agent-docs/typescript.md` and the auth recipe.

## File storage (`FileStore` + `diskStore`)

webjs round-trips a native `File` / `Blob` / `FormData` over the wire, and the file-storage primitive decides WHERE the bytes land. The model mirrors the cache / session adapters: a documented `FileStore` interface, a default local-disk adapter (`diskStore`), and a module singleton (`setFileStore` / `getFileStore`) so an app swaps the backend in one call without touching any call site.

```js
import { getFileStore, generateKey, signedUrl, verifySignedUrl } from '@webjsdev/server';
```

### The `FileStore` interface

Every method operates on web-standard objects, so an S3-compatible adapter is a drop-in (see below).

| Method | Shape |
|---|---|
| `put(key, file, opts?)` | Stream a `File` / `Blob` / `ReadableStream` / `Uint8Array` to storage. Returns `{ key, size, contentType }`. |
| `get(key)` | Returns `{ body, size, contentType }` (a STREAMING handle) or `null`. The serving route does `new Response(handle.body, { headers })`. |
| `delete(key)` | Remove the object. Idempotent (a missing key is not an error). |
| `url(key)` | The served URL (`<baseUrl>/<key>` for `diskStore`). |
| `has(key)` | Whether the key exists (optional). |

`get()` returns a STREAMING handle (`body` is a stream), not a `Blob`, so a serving route streams the file to the client without reading it into memory. The write path is streaming too: `put` pipes `file.stream()` -> `Readable.fromWeb` -> `createWriteStream` via `pipeline`, so a large upload uses constant memory. The upstream body-size cap (#237, `maxMultipartBytes`, default 10 MiB) bounds the upload BEFORE the bytes reach the store; the store does not re-implement that limit, it only stays streaming.

### `diskStore` (the default adapter)

```js
import { setFileStore, diskStore } from '@webjsdev/server';
// Default: <cwd>/.webjs/uploads, served under /uploads. Override at startup:
setFileStore(diskStore({ dir: '/var/data/uploads', baseUrl: '/files' }));
```

The default store is a `diskStore` rooted at `<cwd>/.webjs/uploads`. Add the uploads directory to `.gitignore` (it holds user data, not source).

### Traversal-safe keys (security guarantee)

Every key is resolved to an absolute path under `dir` and REJECTED if it escapes, using the same `resolve` + `startsWith(dir + sep)` containment guard the `/public/*` serve path uses. A key with `..`, an absolute path, a leading slash, a NUL byte, a backslash, or the reserved `.meta` suffix (used for the content-type sidecar) throws (`assertSafeKey`) BEFORE any filesystem operation. Never trust a user-supplied filename as a key; use `generateKey`:

```js
const key = generateKey(file.name);   // <uuid>.<ext>, opaque + safe
```

`generateKey(filename?)` returns a random `crypto.randomUUID()` key, preserving only a whitelisted, sanitized extension from the original filename (a malicious `'../../x.sh'` yields a bare opaque key with no path and no unsafe extension).

### Signed URLs (gated serving)

`signedUrl` / `verifySignedUrl` mint and verify an expiring HMAC-SHA256 (base64url) signature over the exact key plus its expiry, so a serving route can gate access without a session lookup. Neither the key nor the expiry can be tampered with (both are signed), and the comparison is constant-time.

```js
const url = signedUrl(key, { secret: process.env.AUTH_SECRET, expiresIn: 3600 });
// in the serving route.js:
const check = verifySignedUrl(new URL(request.url).searchParams, process.env.AUTH_SECRET);
if (!check.valid) return new Response('Forbidden', { status: 403 });
```

An explicit `expiresIn` of `0` or a negative number fails CLOSED (the minted URL is already expired), so a "no access" intent never silently becomes a 1-hour grant. The 1-hour default applies only when `expiresIn` is omitted.

### Serving user uploads safely (content-type XSS)

The content-type a store records is the one the BROWSER sent at upload time, so it is ATTACKER-CONTROLLED. A serving route that reflects it inline lets an attacker run script in your origin (stored XSS) by uploading HTML or `image/svg+xml` tagged `text/html` under an innocent-looking key. The serving route MUST send `X-Content-Type-Options: nosniff`, and SHOULD send `Content-Disposition: attachment` for anything a user uploaded (the recipe does both). Only serve a user upload inline when you have validated the bytes server-side and emit a content-type from a strict inert allowlist (`image/png`, `image/jpeg`, ...), never `text/html` / `image/svg+xml`. Serving uploads from a separate cookieless origin is the strongest mitigation. See the recipe for the hardened route.

### S3-pluggability (call-site stability)

The interface operates on web-standard objects only, so an S3 / R2 / GCS / MinIO adapter is a drop-in: it implements the same `put` (PutObject, streaming the body), `get` (GetObject, returning the SDK's response stream as `body`), `delete` (DeleteObject), and `url` (the object / CDN URL). Because the shape is identical, `setFileStore(s3Store({ ... }))` switches the whole app with no call-site change. webjs ships no S3 SDK (no new dependency); the adapter is a thin wrapper an app provides.

See the "Receive and persist an uploaded file" recipe in `agent-docs/recipes.md` for the no-JS `<form>` upload + serving route end to end.

## Environment variables

| Variable | Effect |
|---|---|
| `AUTH_SECRET` | Required for auth JWT signing (32+ random chars) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (optional) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth (optional) |
| `SESSION_SECRET` | Cookie session signing |
| `REDIS_URL` | When set, sessions + rate limit + cache use Redis |
| `PORT` | Server port. Precedence `--port` > `PORT` (real env or `.env`) > 8080 (#447) |

## Scaling to multiple instances

Defaults are single-instance (memory stores). For horizontal scaling
configure Redis explicitly where needed:

```js
import { setStore, redisStore } from '@webjsdev/server';
setStore(redisStore({ url: process.env.REDIS_URL }));
```

One-time setup. The user decides what scales via Redis and what stays
in-memory.
