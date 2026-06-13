/**
 * Client-side tag cache coordinator for HTTP-verb server actions (#488).
 *
 * A GET action is cached by the BROWSER HTTP cache (its `Cache-Control` +
 * ETag). After a mutation, that cached entry would still be served within its
 * `max-age`, so a tag-based eviction is layered on top: the server tells the
 * client which tags a GET belongs to (the `X-Webjs-Tags` response header) and
 * which tags a mutation invalidated (`X-Webjs-Invalidate`). When a later GET's
 * tags were invalidated AFTER that key's last fetch STARTED, the stub re-fetches
 * with `cache: 'no-cache'` (a conditional revalidation that bypasses the stale
 * browser-cache entry and returns fresh data, since the ETag changed).
 *
 * Mechanism: a monotonic CLOCK, bumped on every invalidation. Each tag records
 * the clock at its last invalidation; each GET records the clock value SAMPLED
 * JUST BEFORE its fetch was dispatched. A read needs a bypass when any of its
 * tags was invalidated at a clock value greater than the key's sampled value.
 * Sampling before the fetch (not when the response lands) is what closes the
 * race where a mutation commits while a read is in flight: such a mutation has
 * a higher clock than the read's sample, so the next read still bypasses.
 *
 * A thin coordinator, NOT a data store (the data lives in the browser HTTP
 * cache, on-thesis: no bespoke client query cache). Inert server-side.
 */

/** Monotonic logical clock; bumped once per `markStale` call. */
let clock = 0;

/** `tag -> clock value at its last invalidation`. */
const tagInvalidatedAt = new Map();

/** `key -> { tags, since }` where `since` is the clock sampled before its fetch. */
const keyInfo = new Map();

/** Bound `keyInfo` growth for a long-lived session (FIFO-evict the oldest). */
const MAX_KEYS = 1000;

/**
 * Mark tags invalidated (called after a mutation reports `X-Webjs-Invalidate`):
 * advance the clock and stamp each tag with it.
 * @param {string[]} tags
 */
export function markStale(tags) {
  if (!Array.isArray(tags) || !tags.length) return;
  clock += 1;
  for (const t of tags) if (t) tagInvalidatedAt.set(t, clock);
}

/**
 * Sample the clock just before dispatching a GET fetch. The value is passed to
 * `registerKeyTags` so an invalidation that lands WHILE the fetch is in flight
 * (a higher clock than this sample) is detected on the next read.
 * @returns {number}
 */
export function fetchMark() {
  return clock;
}

/**
 * Record the tags a GET response declared for its key, stamped with the clock
 * value sampled before the fetch (`since`).
 * @param {string} key the GET cache key (`stringify(args)`)
 * @param {string[]} tags
 * @param {number} [since] the `fetchMark()` sampled before the fetch
 */
export function registerKeyTags(key, tags, since) {
  if (!Array.isArray(tags) || !tags.length) return;
  // Re-insert to move the key to the newest position (LRU-ish), then cap.
  keyInfo.delete(key);
  keyInfo.set(key, { tags: tags.slice(), since: typeof since === 'number' ? since : clock });
  if (keyInfo.size > MAX_KEYS) {
    const oldest = keyInfo.keys().next().value;
    if (oldest !== undefined) keyInfo.delete(oldest);
  }
}

/**
 * Whether a GET for `key` should bypass the browser cache (re-fetch with
 * `cache: 'no-cache'`) because one of its tags was invalidated AFTER this key's
 * last fetch started. An unrecorded key (never fetched, e.g. resolved from the
 * SSR seed) returns false: its browser-cache entry does not exist yet, so a
 * normal fetch already returns fresh data.
 * @param {string} key
 * @returns {boolean}
 */
export function consumeStale(key) {
  const info = keyInfo.get(key);
  if (!info) return false;
  for (const t of info.tags) if ((tagInvalidatedAt.get(t) || 0) > info.since) return true;
  return false;
}

/** Parse a comma-separated tag header into a trimmed, non-empty list. */
export function parseTagHeader(value) {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Test seam: clear all tag state. */
export function __resetActionCache() {
  clock = 0;
  tagInvalidatedAt.clear();
  keyInfo.clear();
}
