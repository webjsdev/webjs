# Auth and Sessions

## What This Covers

- Sessions: cookie by default, Redis-backed when configured, the `SESSION_SECRET` requirement
- Authentication: `createAuth` (NextAuth-style), Credentials plus OAuth providers, `auth()` in a page or action
- Login and logout flows (`signIn` / `signOut` / `handlers`)
- Protecting a route: gate at the top of a page or action, redirect when unauthenticated
- `forbidden()` (403) vs `unauthorized()` (401) and their nearest-wins boundary files
- Returning an `ActionResult` for an auth failure inside a `'use server'` action (do NOT throw there)
- The Origin / `Sec-Fetch-Site` CSRF model (not a token cookie)
- Requiring secrets from the environment and failing fast
- `cors()` with an explicit allowlist when `credentials: true`

Read this when a task touches login, logout, who-can-see-a-page, session
state, or the CSRF / CORS posture of a mutation. Sibling refs:
`data-and-actions.md` (the `ActionResult` envelope, validation, the RPC
boundary), `routing-and-pages.md` (the `forbidden.ts` / `unauthorized.ts`
boundary files and control-flow throws), `built-ins.md` (env vars, Redis
scaling, the full caching surface).

## Sessions

Enable sessions in middleware, read and write them in a page or action.

```ts
// middleware.ts: enable on all routes
import { session } from '@webjsdev/server';
export default session();   // auto: REDIS_URL present -> server-side, else -> cookie

// in a page or action
import { getSession } from '@webjsdev/server';
const s = getSession(req);
s.userId = user.id;         // auto-saved after the response
```

Cookie sessions (the default) are signed and encrypted with no server
state. Store sessions (with Redis) keep the session id in the cookie and
the data in Redis. Both require `SESSION_SECRET`, read from the
environment (never a literal in source) so boot fails if it is missing.

## Authentication (`createAuth`)

Configure providers once in a `.server.ts` file. `createAuth` returns
`auth` (read the session), `signIn` / `signOut` (the flows), and
`handlers` (the OAuth redirect endpoints).

```ts
// lib/auth.server.ts
import { createAuth, Credentials, Google, GitHub } from '@webjsdev/server';
import { db } from '#db/connection.server.ts';

export const { auth, signIn, signOut, handlers } = createAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const user = await db.query.users.findFirst({ where: { email: credentials.email } });
        if (!user || !verifyPassword(credentials.password, user.passwordHash)) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
    Google(),   // reads AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
    GitHub(),   // reads AUTH_GITHUB_ID, AUTH_GITHUB_SECRET
  ],
  secret: process.env.AUTH_SECRET,   // required, 32+ random chars, from the env
});
```

Sessions are JWT by default (stateless, scales horizontally). OAuth
providers handle the full redirect flow. Read the session anywhere on the
server with `auth()`.

```ts
// in a page or action
import { redirect } from '@webjsdev/core';
const session = await auth();
if (!session) throw redirect('/login');   // page-render gate: 302
```

`auth()` resolves `{ user }`, where `user` is `Record<string, unknown>` by
default. To read custom fields (`session.user.id`, `session.user.role`)
without a cast, type the session by augmenting the `AuthUser` interface
(types-only, opt-in). See `typescript.md`.

## Required secrets, fail fast

| Variable | Effect |
|---|---|
| `AUTH_SECRET` | Required for auth JWT signing (32+ random chars) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth (optional) |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth (optional) |
| `SESSION_SECRET` | Cookie session signing |
| `REDIS_URL` | When set, sessions and rate limit and cache use Redis |

Never ship a demo secret or an in-source default. Read each secret from
`process.env` and fail boot when a required one is absent (use the
optional `env.ts` schema file to validate at boot and name every bad var).
A guessable signing secret means forgeable sessions.

## Protecting a route

Gate at the top of the page or layout that owns the protected subtree.
Because a page runs only on the server, the check happens before any HTML
is produced, so a logged-out visitor never receives protected markup.

```ts
// app/dashboard/page.ts
import { html, redirect } from '@webjsdev/core';
import { auth } from '#lib/auth.server.ts';

export default async function Dashboard() {
  const session = await auth();
  if (!session) throw redirect('/login');   // not signed in
  return html`<h1>Welcome, ${session.user.name}</h1>`;
}
```

Reading the session through `auth()` also auto-excludes the page from the
server HTML response cache, so a per-user page is never cached and served
to another visitor (see `built-ins.md`).

## `forbidden()` (403) vs `unauthorized()` (401)

Two control-flow throws from `@webjsdev/core`, mirroring the `notFound()`
model. Both render the NEAREST matching boundary (innermost wins), else a
default page.

- `unauthorized()` for a request that is NOT authenticated (no valid
  session). Renders the nearest `unauthorized.ts`. Use it when the fix is
  "log in".
- `forbidden()` for an authenticated user who LACKS permission for this
  resource. Renders the nearest `forbidden.ts`. Use it when logging in as
  a different account would not help.

```ts
// app/admin/page.ts
import { html, forbidden, unauthorized } from '@webjsdev/core';
import { auth } from '#lib/auth.server.ts';

export default async function Admin() {
  const session = await auth();
  if (!session) throw unauthorized();          // 401, renders unauthorized.ts
  if (session.user.role !== 'admin') throw forbidden();  // 403, renders forbidden.ts
  return html`<h1>Admin</h1>`;
}
```

Both work from a page or layout render AND from a page `action` (the no-JS
write path). The boundary files (`app/forbidden.ts`, `app/unauthorized.ts`,
or nested variants) live alongside the routes they cover and each
default-export a function returning the boundary markup.

`forbidden()` / `unauthorized()` are for a page / layout render or a page
`action`. They are NOT for a `route.ts` handler (return a `Response` with
the status there), and NOT for a `'use server'` RPC action (a raw throw
becomes a generic 500). See the next section for the action case.

## Auth failure inside a `'use server'` action: return, do not throw

A `'use server'` RPC action must NOT throw `forbidden()` / `unauthorized()`
/ `redirect()` for an auth failure. A raw throw there is sanitized to a
generic 500 in production, so the caller loses the reason. Instead return
an `ActionResult` failure envelope with a status the client can act on.

```ts
// modules/posts/actions/delete-post.server.ts
'use server';
import { auth } from '#lib/auth.server.ts';
import { db } from '#db/connection.server.ts';

export async function deletePost(input: { id: string }) {
  const session = await auth();
  if (!session) return { success: false, error: 'Sign in to continue.', status: 401 };
  const post = await db.query.posts.findFirst({ where: { id: input.id } });
  if (post?.authorId !== session.user.id) {
    return { success: false, error: 'Not your post.', status: 403 };
  }
  await db.delete(posts).where(eq(posts.id, input.id));
  return { success: true };
}
```

The user-facing message belongs on the envelope's `error` field, never on
a raw throw (prod strips a thrown message to a digest). See
`data-and-actions.md` for the full `ActionResult` shape.

## CSRF: an Origin / `Sec-Fetch-Site` check, not a token cookie

Action RPC CSRF protection is an Origin / `Sec-Fetch-Site` header check
(the Remix 3 / Go 1.25 model), NOT a token cookie. A state-changing verb
(POST / PUT / PATCH / DELETE) passes only when:

- `Sec-Fetch-Site` is `same-origin` or `none`, OR
- (older browsers with no `Sec-Fetch-Site`) the `Origin` host matches the
  request host, OR
- the source is listed in `webjs.allowedOrigins`.

Otherwise the request is a 403. A safe GET action is CSRF-exempt. Because
there is no CSRF token cookie and no `Set-Cookie` rides the SSR HTML, a
page that opts into a public `Cache-Control` stays CDN-edge-cacheable.

A `route.ts` REST endpoint is NOT covered. Authenticate every mutating
endpoint yourself, run `export const validate`, log without secrets, and
rate-limit.

## CORS: explicit allowlist when `credentials: true`

For cross-origin requests use `cors()` from `@webjsdev/server` as
middleware. When `credentials: true` you MUST pass an explicit origin
allowlist. Never `'*'` with credentials (that would expose an
authenticated response to any origin).

```ts
// middleware.ts
import { cors } from '@webjsdev/server';
export default cors({
  origin: ['https://app.example.com', 'https://admin.example.com'],
  credentials: true,   // requires the explicit allowlist above
});
```
