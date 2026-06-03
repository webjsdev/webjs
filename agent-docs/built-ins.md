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
  const posts = await prisma.post.findMany();
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
sets a non-framework `Set-Cookie` (the framework `webjs_csrf` cookie is
re-minted per response on a hit and does not block), or runs under CSP
(its body carries a per-request nonce). A cached page served to a brand
new visitor still gets a fresh CSRF cookie, so it stays correct.

**Framework defense, not just the contract.** When the render reads
per-user state through a framework helper (`cookies()`, `headers()`, or
`getSession()`), the framework auto-marks the request dynamic and refuses
to cache it even if you set `revalidate`, warning you once with the page
path. So a wrong `revalidate` on a cookie-reading page fails safe (served
fresh) instead of leaking. **The loud caveat:** this only catches reads
THROUGH those helpers. A page that varies its body by an inbound auth
cookie / `Authorization` header but reads it RAW (not via `cookies()` /
`headers()` / `getSession()`) and sets no new `Set-Cookie` WILL be cached
and served to a logged-out visitor. Read per-user request state through
the framework helpers (which auto-exclude the page), or never set
`revalidate` on a per-user page.

Evict on a write with `revalidatePath`:

```ts
// modules/blog/actions/publish-post.server.ts
'use server';
import { revalidatePath } from '@webjsdev/server';

export async function publishPost(input) {
  // ... persist via Prisma ...
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
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
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

## Environment variables

| Variable | Effect |
|---|---|
| `AUTH_SECRET` | Required for auth JWT signing (32+ random chars) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (optional) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth (optional) |
| `SESSION_SECRET` | Cookie session signing |
| `REDIS_URL` | When set, sessions + rate limit + cache use Redis |
| `PORT` | Server port (default 8080) |

## Scaling to multiple instances

Defaults are single-instance (memory stores). For horizontal scaling
configure Redis explicitly where needed:

```js
import { setStore, redisStore } from '@webjsdev/server';
setStore(redisStore({ url: process.env.REDIS_URL }));
```

One-time setup. The user decides what scales via Redis and what stays
in-memory.
