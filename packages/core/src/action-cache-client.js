/**
 * Client-side tag cache coordinator for HTTP-verb server actions (#488).
 *
 * A GET action is cached by the BROWSER HTTP cache (its `Cache-Control` +
 * ETag). After a mutation, that cached entry would still be served within its
 * `max-age`, so a tag-based eviction is layered on top: the server tells the
 * client which tags a GET belongs to (the `X-Webjs-Tags` response header) and
 * which tags a mutation invalidated (`X-Webjs-Invalidate`). When a later GET's
 * tags intersect the invalidated set, the stub re-fetches with `cache:
 * 'no-cache'` (a conditional revalidation that bypasses the stale browser-cache
 * entry and returns fresh data, since the ETag changed).
 *
 * This is a thin coordinator, NOT a data store (the data lives in the browser
 * HTTP cache, on-thesis: no bespoke client query cache). Inert server-side.
 */

/** Tags currently invalidated (a later GET carrying one re-fetches fresh). */
const staleTags = new Set();

/** `cacheKey -> string[] tags`, learned from each GET's `X-Webjs-Tags`. */
const keyTags = new Map();

/**
 * Record the tags a GET response declared for its cache key, so a later
 * invalidation of any of those tags can force this key to revalidate.
 * @param {string} key the GET cache key (`stringify(args)`)
 * @param {string[]} tags
 */
export function registerKeyTags(key, tags) {
  if (Array.isArray(tags) && tags.length) keyTags.set(key, tags.slice());
}

/**
 * Mark tags invalidated (called after a mutation reports `X-Webjs-Invalidate`).
 * @param {string[]} tags
 */
export function markStale(tags) {
  if (Array.isArray(tags)) for (const t of tags) if (t) staleTags.add(t);
}

/**
 * Whether a GET for `key` should bypass the browser cache because one of its
 * tags was invalidated. Consumes the staleness for this key's tags (so the next
 * GET after the revalidation uses the cache again).
 * @param {string} key
 * @returns {boolean}
 */
export function consumeStale(key) {
  const tags = keyTags.get(key);
  if (!tags) return false;
  let hit = false;
  for (const t of tags) if (staleTags.has(t)) hit = true;
  if (hit) for (const t of tags) staleTags.delete(t);
  return hit;
}

/** Parse a comma-separated tag header into a trimmed, non-empty list. */
export function parseTagHeader(value) {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Test seam: clear all tag state. */
export function __resetActionCache() {
  staleTags.clear();
  keyTags.clear();
}
