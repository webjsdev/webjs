---
title: "Built-ins: auth, sessions, cookies, cache, and rate limiting (sharing one store)"
date: 2026-03-08T15:00:00+05:30
slug: built-ins-auth-session-cookies-cache
description: "The five cross-cutting concerns webjs ships in @webjsdev/server: how they share a pluggable cache store, what the four-method store interface looks like, and what swapping to Redis looks like."
tags: server, auth, sessions, cache, redis, rate-limit
author: Vivek
---

Most frameworks make you assemble the cross-cutting server-side concerns from libraries. Auth from passport or lucia. Sessions from express-session or iron-session. Cache from node-cache or ioredis. Rate-limiting from express-rate-limit. The pieces work, but they all want their own store, their own config, and their own version of "where do I plug in Redis?"

webjs ships all of them built-in. They share one cache store. The shape feels obvious once you see it; getting there took some non-obvious choices.


# The concerns and the one store

Inside `@webjsdev/server`, five modules read and write the same backing store:

```
auth.js          NextAuth/Auth.js-style providers (Credentials + Google + GitHub),
                 JWT or store-backed sessions, Web Crypto HMAC-SHA256
session.js       Remix-style Session class (get/set/has/unset/flash/destroy)
cache.js         Pluggable cache store + the memoryStore + redisStore impls
cache-fn.js      cache(key, fn, { ttl }) for memoized server-side queries
rate-limit.js    Fixed-window limiter
```

The store has a tiny interface, four methods, in the `CacheStore` JSDoc at the top of `cache.js`:

```ts
type CacheStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, ttlMs?: number): Promise<number>;
};
```

Just four operations. The `increment` is atomic and creates the key with value 1 if it does not exist; the TTL is set on creation only. That is what makes the rate limiter correct across instances when the store is Redis-backed.

The default implementation is `memoryStore({ maxSize: 10000 })`, a JS Map with TTL expiry and LRU eviction. Sufficient for development, sufficient for a single-instance deployment.

When you need horizontal scaling, swap to `redisStore({ url: ... })`. One line at app startup:

```ts
import { setStore, redisStore } from '@webjsdev/server';
setStore(redisStore({ url: process.env.REDIS_URL }));
```

Now all five concerns route through Redis. Sessions persist across instances. Rate limits coordinate across instances. The query cache is shared. Auth tokens are sticky. No second `AUTH_STORE`, `SESSION_STORE`, `CACHE_STORE` to configure.


# Why the share matters

Two reasons.

The user only learns one config. Swapping to Redis is one decision, not four. If the four concerns had separate stores, the user would have to learn `SESSION_STORE`, `CACHE_STORE`, two URL formats, two retry policies, two failure modes.

Cross-cutting features are easy to build. The keyspace is one namespace; the modules use prefix conventions (`session:<id>`, `auth:<provider>:<userId>`, etc.). When a feature needs to coordinate across them, it does so through the same four methods. No library-API archaeology.


# The auth model

`createAuth()` matches the NextAuth / Auth.js shape so an agent that has seen NextAuth writes correct webjs auth. Three providers in v1: Google, GitHub, and Credentials. The implementation uses Web Crypto HMAC-SHA256, so no external crypto dependency.

Two cookie names from the source (`AUTH_COOKIE = 'webjs.auth'`, `STATE_COOKIE = 'webjs.auth.state'`). Default session lifetime is 30 days. Sessions can be JWT (opaque token, no server lookup) or database-backed (token is a key into the cache store).

The credentials provider's `verify` callback returns the user object (or null on failure). The framework then issues the cookie. This is the simpler shape than NextAuth's `Promise<User | null>` of the exact same name, but functionally compatible.


# The session model

webjs's `Session` class is Remix-shaped: `get`, `set`, `has`, `unset`, `flash`, `destroy`, `regenerateId`. From the source:

```ts
class Session {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  unset(key: string): void;
  flash(key: string, value: unknown): void;  // one-request value
  destroy(): void;
  regenerateId(): void;
}
```

Sessions are 24-byte random IDs (base64url). The class tracks a `dirty` flag so middleware only writes when something changed. `flash` is a Remix-style one-request value (set this request, read next request, gone after).

Backing storage is the session middleware's `storage` parameter (cookie-backed by default, store-backed if you opt in). The cookie-backed mode uses HMAC-SHA256 for tamper detection. The store-backed mode goes through the global cache store keyed `session:<id>`.

`cookies()` and `headers()` helpers are bound to the in-flight request via the framework's request context. You call them from inside a server action without threading the request through every function. Same API works in middleware, page functions, route handlers, server actions.


# The cache(key, fn, { ttl }) helper

`cache-fn.js` is the function-memoization helper:

```ts
import { cache } from '@webjsdev/server';

export const getUser = cache(
  (id: string) => `user:${id}`,
  async (id: string) => prisma.user.findUnique({ where: { id } }),
  { ttl: 60_000 },
);
```

First call hits the database. Subsequent calls within the TTL window return the cached value. Cross-instance with Redis. The implementation just wraps the user's function with a `getStore().get/set` pair keyed by the user-provided key function.

The cache is opt-in. We do not auto-memoize all queries. Each function the user wraps with `cache(...)` is intentional.


# The rate-limit model

`rate-limit.js` is fixed-window, backed by the cache store's atomic `increment`:

```ts
import { rateLimit } from '@webjsdev/server';

export default rateLimit({
  window: '10s',
  max: 5,
  key: (req) => req.headers.get('x-forwarded-for') || 'anonymous',
});
```

Five requests per ten seconds per IP. The `key` function is the user-controlled bucket id.

Internally it computes the current windowed key (e.g. `ratelimit:<bucket>:<window-start>`), calls `store.increment(...)`, and 429s if the result exceeds `max`. Atomic on Redis. Works in-memory for development. The single-process memory store implements increment atomically too, so the rate limiter works there as well.


# What this is not

webjs's built-ins are intentionally minimal. We do not ship:

- Magic-link email auth (use a third-party provider).
- 2FA / WebAuthn (later).
- Sliding-window rate limiting (the simple fixed-window covers most cases).
- A migration tool for sessions (you write your own when you outgrow cookies).
- Pluggable encryption algorithms (Web Crypto HMAC-SHA256 only).

Each has a clean third-party answer if you need it. webjs covers the 80% case in a way the agent can write without reading docs. The 20% case is a library install away.


# How this looks from the user's perspective

Default app, in-memory store, all five built-ins work. No config.

```sh
npm create webjs@latest my-app
cd my-app
npm run dev
```

The scaffold ships an `auth-forms` component, a session-checking middleware on `/dashboard`, and a rate-limited `/api/auth/*` endpoint set. The example shows all five patterns wired up against the default in-memory store.

When the app needs Redis, add one line at the top of the entry point:

```ts
import { setStore, redisStore } from '@webjsdev/server';
setStore(redisStore({ url: process.env.REDIS_URL }));
```

The same code that worked locally now scales horizontally. No store migration. No "which library is this from" archaeology.


# What I learned

A pluggable store with a small interface is more valuable than a separate library per concern. Adding cross-cutting features later was straightforward because everything routed through one place. Adding "purge all data for this user" for compliance was a few lines, because the four-method interface already had everything we needed.

Matching the Remix Session class and the NextAuth provider shape saved a lot of doc-writing. Agents already know the surface from the other frameworks. The few users who have written webjs apps with custom OAuth providers used the same argument shapes they would have used elsewhere. The mental model transferred.

If you read the implementation, the modules live at `packages/server/src/{auth,session,cache,cache-fn,rate-limit}.js`. The Session class is the largest at ~340 lines; the cache and rate-limit modules are 200 lines each. About 1500 lines total for the five concerns combined.
