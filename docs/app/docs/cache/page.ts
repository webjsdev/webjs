import { html } from '@webjsdev/core';

export const metadata = { title: 'Caching | webjs' };

export default function Cache() {
  return html`
    <h1>Caching</h1>
    <p>webjs provides two complementary caching layers: <code>cache()</code> for server-side query result caching, and HTTP <code>Cache-Control</code> headers for page-level browser/CDN caching. Zero config in development (in-memory store). For horizontal scaling in production, call <code>setStore(redisStore({ url: process.env.REDIS_URL }))</code> once at app startup to share the cache across instances.</p>

    <h2>cache(): Server-Side Query Caching</h2>
    <p>Wrap any async function with <code>cache()</code> to cache its return value on the server. Same function + same arguments = cached result until TTL expires or you call <code>invalidate()</code>.</p>

    <pre>import { cache } from '@webjsdev/server';

export const listPosts = cache(
  async () => {
    return prisma.post.findMany({ orderBy: { createdAt: 'desc' } });
  },
  { key: 'posts', ttl: 60 }
);

// Call it normally. First call hits DB, subsequent calls serve cache.
const posts = await listPosts();</pre>

    <h3>Options</h3>
    <ul>
      <li><code>key</code> (required): cache key prefix. Combined with serialized arguments to form the full key.</li>
      <li><code>ttl</code> (optional): time-to-live in seconds. Default: 60.</li>
    </ul>

    <h3>Invalidation</h3>
    <p>The cached function has an <code>invalidate()</code> method. Call it after mutations to clear the cache:</p>

    <pre>import { listPosts } from '../queries/list-posts.server.ts';

export async function createPost(input) {
  await prisma.post.create({ data: input });
  await listPosts.invalidate();  // next call to listPosts() will hit DB
}</pre>

    <p>Invalidation clears the no-args cache key. Argument-specific keys (from calls with different arguments) expire naturally via TTL. For full invalidation of parameterized queries, use a short TTL.</p>

    <h2>HTTP Cache-Control: Page-Level Caching</h2>
    <p>For page-level caching served to browsers and CDNs, use the <code>metadata.cacheControl</code> export in any <code>page.ts</code>:</p>

    <pre>// app/posts/page.ts
export const metadata = {
  title: 'Posts',
  cacheControl: 'public, max-age=60, stale-while-revalidate=300',
};</pre>

    <p>This sets the standard <code>Cache-Control</code> header on the HTTP response. Browsers and CDNs cache the rendered page without any server-side state.</p>

    <h2>Server HTML Response Cache (export const revalidate)</h2>
    <p>For a page that renders identical HTML for every visitor, opt into the server HTML response cache so the SSR pipeline runs once per window instead of once per request (webjs's no-build equivalent of Next.js's Full Route Cache and ISR). Declare a revalidation window on the page module:</p>

    <pre>// app/blog/page.ts
export const revalidate = 60;   // seconds: cache this page's HTML for 60s

export default async function Blog() {
  const posts = await listPosts();
  return html\`...\`;
}</pre>

    <p><strong>Safety.</strong> Caching is opt-in and conservative, because a wrongly-cached per-user page is a data leak. Declaring <code>revalidate</code> asserts <strong>this page is the same for everyone for N seconds</strong>. The cache is keyed by the full URL (path plus search) only, with no per-user keying, so a page that reads <code>cookies()</code>, a session, or any per-user data MUST NOT set <code>revalidate</code>. The framework also refuses to cache any response that is not a <code>200</code>, is a streamed Suspense body, sets a non-framework <code>Set-Cookie</code>, or runs under CSP. A cached page served to a brand new visitor still receives a fresh CSRF cookie, so it stays correct.</p>

    <p>Evict on a write with <code>revalidatePath</code> from a server action:</p>

    <pre>// modules/blog/actions/publish-post.server.ts
'use server';
import { revalidatePath } from '@webjsdev/server';

export async function publishPost(input) {
  // ... persist via Prisma ...
  await revalidatePath('/blog');   // next /blog request re-renders fresh
  return { success: true };
}</pre>

    <p><code>revalidatePath(path)</code> evicts the server HTML cache for one path, and <code>revalidateAll()</code> clears everything. This is distinct from the client-side <code>revalidate()</code> from <code>@webjsdev/core</code>, which evicts the browser snapshot cache used by client navigation. Time-based eviction is handled automatically by the store TTL (the <code>revalidate</code> seconds).</p>

    <h2>Low-Level Cache Store</h2>
    <p>Both <code>cache()</code> and the rate limiter are built on a pluggable cache store. You can use it directly for custom caching needs:</p>

    <pre>import { getStore, setStore, redisStore } from '@webjsdev/server';

// Get the default store (memoryStore in dev)
const store = getStore();

// Read/write raw values
await store.set('user:42', JSON.stringify({ name: 'Ada' }), 300_000); // TTL in ms
const raw = await store.get('user:42');
await store.delete('user:42');

// Atomic increment (used by rate limiter)
const count = await store.increment('api:hits:192.168.1.1', 60_000);</pre>

    <h3>Stores</h3>
    <h4>memoryStore (default)</h4>
    <p>In-process LRU Map. Fast, zero dependencies, single-instance only. Data is lost on restart, intentionally for dev.</p>

    <h4>redisStore (production)</h4>
    <p>Redis-backed store for multi-instance deployments. Set it explicitly at app startup:</p>

    <pre>import { setStore, redisStore } from '@webjsdev/server';
setStore(redisStore({ url: process.env.REDIS_URL }));</pre>

    <h3>Store API</h3>
    <ul>
      <li><code>store.get(key)</code>: returns the cached string or <code>null</code>.</li>
      <li><code>store.set(key, value, ttlMs?)</code>: stores a string value with optional TTL in milliseconds.</li>
      <li><code>store.delete(key)</code>: removes a key.</li>
      <li><code>store.increment(key, ttlMs?)</code>: atomically increments a counter. Returns the new value. Creates the key with value 1 if it does not exist.</li>
    </ul>

    <h2>Internal Usage</h2>
    <p>Several framework subsystems use the cache store as their backing store:</p>
    <ul>
      <li><strong>cache()</strong>: server-side function result caching.</li>
      <li><strong>Rate limiter</strong>: uses <code>store.increment()</code> with TTL to track request counts per window.</li>
      <li><strong>Sessions</strong>: <code>storeSessionStorage()</code> persists session data in the cache when using server-side sessions.</li>
      <li><strong>Auth</strong>: database session strategy stores auth sessions in the cache store.</li>
    </ul>
    <p>Because they all share the same store, switching from memory to Redis upgrades everything at once.</p>

    <h2>Next Steps</h2>
    <ul>
      <li><a href="/docs/sessions">Sessions</a>: session middleware built on the cache store</li>
      <li><a href="/docs/authentication">Authentication</a>: NextAuth-style auth with providers</li>
      <li><a href="/docs/middleware">Middleware</a>: rate limiting and other middleware that uses the cache</li>
    </ul>
  `;
}
