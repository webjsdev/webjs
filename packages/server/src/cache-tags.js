/**
 * Tag-based invalidation for server `cache()` (the Next.js revalidateTag
 * model), built as a THIN key-index over the existing pluggable store
 * (`get` / `set` / `delete` in `cache.js`), NOT a new subsystem.
 *
 * The problem it solves: `cache(fn, { key, ttl })` can only be invalidated
 * by calling `wrapped.invalidate()` from the module that owns the wrapper,
 * and even then only the no-args base key (arg-specific keys leak until
 * their TTL). There was no way for an unrelated mutation (createComment)
 * to invalidate a related read (postById) without importing every wrapper.
 *
 * The index: when a cached result is stored, `cache-fn.js` also records the
 * mapping `tag -> cacheKey` here. Each tag holds a JSON array of the cache
 * keys tagged with it, under the namespaced store key `cache:tag:<tag>`.
 * `revalidateTag(tag)` reads that array, deletes every cache key in it, then
 * clears the index entry. A mutation in ANY module can therefore evict every
 * read tagged `'posts'` across modules with one explicit call.
 *
 * It stays a thin index over `store.get/set/delete`: no new store method, a
 * plain JSON array (a Set is trivial in the memory store; the same get/set of
 * a JSON array works for Redis). The cohesive companion for HTML paths is
 * `revalidatePath` in `html-cache.js`; together they are the server cache
 * invalidation surface (this one for `cache()` DATA, that one for cached HTML).
 *
 * MULTI-INSTANCE CAVEAT (mirrors #241): the index is a plain read-modify-write
 * of a JSON array, NOT atomic across processes. With a shared Redis store,
 * `revalidateTag` deletes the keys it can see and reaches every instance for
 * those keys, but two instances appending to the same tag concurrently can
 * lose an append (last write wins), so a freshly-stored key on a peer might
 * miss eviction and live until its TTL. The tag index entry itself also
 * carries the cache TTL, so the index self-prunes and never grows unbounded.
 * For strict cross-instance invalidation, prefer a short `ttl` as the floor.
 *
 * @module cache-tags
 */

import { getStore } from './cache.js';

/** Namespace prefix for every tag-index key, parallel to `cache:` entries. */
const TAG_PREFIX = 'cache:tag:';

/** @param {string} tag @returns {string} */
function tagKey(tag) {
  return `${TAG_PREFIX}${tag}`;
}

/**
 * Read the cache-key set stored under one tag. Returns a plain array (empty
 * on a miss / parse error, failing open). The store holds a JSON array.
 *
 * @param {string} tag
 * @returns {Promise<string[]>}
 */
async function readTagKeys(tag) {
  try {
    const raw = await getStore().get(tagKey(tag));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Append a cache key to every given tag's index (deduped). Called by
 * `cache-fn.js` right after it stores a cached result. The index entry
 * carries the same TTL as the cached value so it self-prunes and the tag
 * index never outgrows the data it points at.
 *
 * Best-effort: a store failure here never affects the cached result that was
 * already written (the value is still served; only its taggability is lost).
 *
 * @param {string[]} tags
 * @param {string} cacheKey
 * @param {number} [ttlMs]
 * @returns {Promise<void>}
 */
export async function addKeyToTags(tags, cacheKey, ttlMs) {
  if (!Array.isArray(tags) || tags.length === 0) return;
  const store = getStore();
  for (const tag of tags) {
    if (typeof tag !== 'string' || !tag) continue;
    try {
      const keys = await readTagKeys(tag);
      if (keys.includes(cacheKey)) continue;
      keys.push(cacheKey);
      await store.set(tagKey(tag), JSON.stringify(keys), ttlMs);
    } catch {
      /* a tag-index write failure must never affect the cached value */
    }
  }
}

/**
 * Evict every cached entry tagged with `tag`, then clear the tag index.
 * A mutating server action calls this after a write so the next read of any
 * tagged query recomputes. Works across modules: the read tagged `'posts'`
 * in one module is invalidated by a `revalidateTag('posts')` issued from
 * any other.
 *
 * ```js
 * // modules/comments/actions/create-comment.server.ts
 * 'use server';
 * import { revalidateTag } from '@webjsdev/server';
 * export async function createComment(input) {
 *   await db.insert(comments).values(input);
 *   await revalidateTag('post:' + input.postId); // postById(postId) recomputes
 *   return { success: true };
 * }
 * ```
 *
 * @param {string} tag
 * @returns {Promise<void>}
 */
export async function revalidateTag(tag) {
  if (typeof tag !== 'string' || !tag) return;
  const store = getStore();
  const keys = await readTagKeys(tag);
  for (const k of keys) {
    try {
      await store.delete(k);
    } catch {
      /* a delete failure is non-fatal: the entry still expires via its TTL */
    }
  }
  try {
    await store.delete(tagKey(tag));
  } catch {
    /* non-fatal */
  }
}

/**
 * Convenience: `revalidateTag` for several tags in one call. A mutation that
 * touches multiple cached surfaces (e.g. a post AND the post list) evicts
 * them together.
 *
 * @param {string[]} tags
 * @returns {Promise<void>}
 */
export async function revalidateTags(tags) {
  if (!Array.isArray(tags)) return;
  for (const tag of tags) {
    await revalidateTag(tag);
  }
}
