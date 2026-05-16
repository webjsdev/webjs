# Built-in essentials

`import { … } from '@webjskit/server'`

Opinionated defaults: **set `REDIS_URL` and everything scales.**

## Caching (HTTP standards, Remix-style)

webjs uses standard HTTP caching — `Cache-Control` on responses. Let
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
import { getStore, setStore, redisStore } from '@webjskit/server';

// Default — memory store
const store = getStore();

// At app startup — Redis for horizontal scaling
setStore(redisStore({ url: process.env.REDIS_URL }));
```

## Sessions

```js
// middleware.js — enable on all routes
import { session } from '@webjskit/server';
export default session();   // auto: REDIS_URL → server-side; else → cookie

// in a page or action
import { getSession } from '@webjskit/server';
const s = getSession(req);
s.userId = user.id;        // auto-saved after response
```

Cookie sessions (default): signed + encrypted, no server state. Store
sessions (with Redis): session ID in cookie, data in Redis. Requires
`SESSION_SECRET` env var.

## Authentication (NextAuth-style)

```js
// lib/auth.ts
import { createAuth, Credentials, Google, GitHub } from '@webjskit/server';

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
| `PORT` | Server port (default 3000) |

## Scaling to multiple instances

Defaults are single-instance (memory stores). For horizontal scaling
configure Redis explicitly where needed:

```js
import { setStore, redisStore } from '@webjskit/server';
setStore(redisStore({ url: process.env.REDIS_URL }));
```

One-time setup. The user decides what scales via Redis and what stays
in-memory.
