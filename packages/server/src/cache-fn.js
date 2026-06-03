/**
 * Server-side function caching for RPC queries.
 *
 * Wraps an async function with a cache layer backed by the cache store.
 * Same function + same arguments = cached result until TTL expires.
 *
 * ```js
 * import { cache } from '@webjsdev/server';
 *
 * export const listPosts = cache(
 *   async () => prisma.post.findMany({ orderBy: { createdAt: 'desc' } }),
 *   { key: 'posts', ttl: 60 }
 * );
 *
 * // Call it normally: first call hits DB, subsequent calls serve cache
 * const posts = await listPosts();
 * ```
 *
 * For page-level HTTP caching, use `metadata.cacheControl` instead -
 * that sets standard Cache-Control headers for browsers and CDNs.
 * This `cache()` is for server-side query result caching.
 *
 * @module cache-fn
 */

import { getStore } from './cache.js';
import { addKeyToTags } from './cache-tags.js';

/**
 * Wrap an async function with server-side caching.
 *
 * @template {(...args: any[]) => Promise<any>} T
 * @param {T} fn  The async function to cache.
 * @param {{
 *   key: string,
 *   ttl?: number,
 *   tags?: string[] | ((...args: Parameters<T>) => string[]),
 * }} opts
 *   - `key`: cache key prefix. Combined with serialized args to form the full key.
 *   - `ttl`: time-to-live in seconds. Default: 60.
 *   - `tags`: optional tags this cached result belongs to, for cross-module
 *     invalidation via `revalidateTag(tag)`. Either a static `string[]`
 *     (every cached entry of this function shares them) or a function
 *     `(...args) => string[]` so a per-arg read tags with the entity id
 *     (e.g. `tags: (id) => ['post:' + id]`). The result is also recorded
 *     under each tag's thin key index so `revalidateTag` can find and
 *     evict it later, including arg-specific entries that the no-args
 *     `invalidate()` cannot reach.
 * @returns {T & { invalidate: () => Promise<void> }}
 *   The cached function with the same signature, plus an `invalidate()`
 *   method to manually clear the cache.
 */
export function cache(fn, opts) {
  const prefix = opts.key;
  const ttlMs = (opts.ttl ?? 60) * 1000;
  const tagsOpt = opts.tags;

  /**
   * Resolve the tag list for one call. A function form receives the call
   * args (so a per-entity read can tag with the id); a static array is
   * returned as-is. Anything else yields no tags.
   * @param {any[]} args
   * @returns {string[]}
   */
  function tagsFor(args) {
    const raw = typeof tagsOpt === 'function' ? tagsOpt(...args) : tagsOpt;
    return Array.isArray(raw) ? raw.filter((t) => typeof t === 'string' && t) : [];
  }

  const wrapped = /** @type {T & { invalidate: () => Promise<void> }} */ (
    async function (...args) {
      const store = getStore();
      const cacheKey = args.length
        ? `cache:${prefix}:${JSON.stringify(args)}`
        : `cache:${prefix}`;

      const hit = await store.get(cacheKey);
      if (hit !== null) {
        try { return JSON.parse(hit); } catch { /* corrupted: recompute */ }
      }

      const result = await fn(...args);
      await store.set(cacheKey, JSON.stringify(result), ttlMs);
      // Record tag -> cacheKey in the thin tag index so a later
      // revalidateTag can find and evict this entry (including
      // arg-specific keys the no-args invalidate() cannot reach).
      // Best-effort: the value is already stored, so taggability must
      // never break the cached call. A user tags() function that throws
      // (e.g. reading post.id off a null arg), or an index write that
      // fails, leaves the value cached (just untagged) and returns
      // normally. tagsFor() is INSIDE the try because it runs the
      // user-supplied function.
      try {
        await addKeyToTags(tagsFor(args), cacheKey, ttlMs);
      } catch (err) {
        console.warn(
          `[webjs] cache(${prefix}): tag indexing failed, value is cached ` +
          `but untagged (revalidateTag will not reach it): ${err && err.message ? err.message : err}`
        );
      }
      return result;
    }
  );

  /**
   * Manually invalidate this cache. Call after mutations:
   *
   * ```js
   * export async function createPost(input) {
   *   await prisma.post.create({ data: input });
   *   await listPosts.invalidate();
   * }
   * ```
   */
  wrapped.invalidate = async function () {
    const store = getStore();
    // Delete the base key (no-args call)
    await store.delete(`cache:${prefix}`);
    // Note: arg-specific keys are not tracked. If the cached function
    // is called with different arguments, those entries expire via TTL.
    // For full invalidation of arg-specific keys, use a short TTL.
  };

  return wrapped;
}
