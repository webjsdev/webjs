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
 *   async () => db.query.posts.findMany({ orderBy: { createdAt: 'desc' } }),
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

import { stringify, parse } from '@webjsdev/core';
import { getStore } from './cache.js';
import { addKeyToTags } from './cache-tags.js';

// Cache value/key encoding version. Entries written by an older encoding used
// a DIFFERENT key namespace, so a reader never deserializes them with the new
// format. Before this segment existed, values were JSON and keys were the
// unversioned `cache:<prefix>`; a JSON-format entry is still valid JSON that
// `parse` would silently accept as a lossy value (a Date as a string) without
// recomputing, so the version segment forces those pre-upgrade entries to miss
// and expire by their own TTL instead of being served stale. Bump it whenever
// the value/key encoding changes. Distinct from the `cache:tag:` tag-index
// namespace in cache-tags.js.
const CACHE_FORMAT = 'r1';

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
      // Both the key fingerprint and the stored value go through the same
      // rich serializer the RPC wire uses (@webjsdev/core stringify/parse),
      // NOT JSON. JSON collapses Date to a string and Map/Set to {} / [], so
      // (a) a cached value would change shape between a cold miss (the real
      // value) and a warm hit (the lossy JSON value), and (b) two distinct
      // Map/Set args would collide to the same key. Going through core's
      // serializer makes a hit byte-faithful to a miss and keys collision-safe.
      // We use core stringify/parse DIRECTLY rather than getSerializer() so the
      // cache preserves full fidelity even when an app swaps the wire format to
      // a lossy one (e.g. plain JSON); cache fidelity is a storage concern, not
      // a wire concern.
      const cacheKey = args.length
        ? `cache:${CACHE_FORMAT}:${prefix}:${await stringify(args)}`
        : `cache:${CACHE_FORMAT}:${prefix}`;

      const hit = await store.get(cacheKey);
      if (hit !== null) {
        try { return parse(hit); } catch { /* corrupted: recompute */ }
      }

      const result = await fn(...args);
      await store.set(cacheKey, await stringify(result), ttlMs);
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
   *   await db.insert(posts).values(input);
   *   await listPosts.invalidate();
   * }
   * ```
   */
  wrapped.invalidate = async function () {
    const store = getStore();
    // Delete the base key (no-args call)
    await store.delete(`cache:${CACHE_FORMAT}:${prefix}`);
    // Note: arg-specific keys are not tracked. If the cached function
    // is called with different arguments, those entries expire via TTL.
    // For full invalidation of arg-specific keys, use a short TTL.
  };

  return wrapped;
}
