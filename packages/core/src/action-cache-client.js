/**
 * Client-side tag cache coordinator for HTTP-verb server actions (#488).
 *
 * A GET action is cached by the BROWSER HTTP cache (its `Cache-Control` +
 * ETag). After a mutation, that cached entry would still be served within its
 * `max-age`, so a tag-based eviction is layered on top: the server tells the
 * client which tags a GET belongs to (the `X-Webjs-Tags` response header) and
 * which tags a mutation invalidated (`X-Webjs-Invalidate`). When a later GET's
 * tags have been invalidated SINCE that key last fetched, the stub re-fetches
 * with `cache: 'no-cache'` (a conditional revalidation that bypasses the stale
 * browser-cache entry and returns fresh data, since the ETag changed).
 *
 * The mechanism is a per-tag GENERATION counter: a mutation bumps the
 * generation of each invalidated tag; a GET records the generation it last saw
 * for each of its tags; a read needs a bypass when any of its tags has a higher
 * current generation than the one the key recorded. This makes invalidation
 * correct across MULTIPLE keys sharing a tag (each revalidates independently)
 * and is monotonic (no global consume that strands sibling keys).
 *
 * A thin coordinator, NOT a data store (the data lives in the browser HTTP
 * cache, on-thesis: no bespoke client query cache). Inert server-side.
 */

/** `tag -> generation`; a mutation bumps the generation of each tag it evicts. */
const tagGen = new Map();

/** `key -> Map<tag, generation-last-seen>`, recorded on each GET response. */
const keyGen = new Map();

/**
 * Mark tags invalidated (called after a mutation reports `X-Webjs-Invalidate`):
 * bump each tag's generation, so every key that last saw an older generation
 * revalidates on its next read.
 * @param {string[]} tags
 */
export function markStale(tags) {
  if (Array.isArray(tags)) for (const t of tags) if (t) tagGen.set(t, (tagGen.get(t) || 0) + 1);
}

/**
 * Record the tags (and their current generations) a GET response declared for
 * its cache key, so a later invalidation of any of those tags is detectable.
 * @param {string} key the GET cache key (`stringify(args)`)
 * @param {string[]} tags
 */
export function registerKeyTags(key, tags) {
  if (!Array.isArray(tags) || !tags.length) return;
  const seen = new Map();
  for (const t of tags) seen.set(t, tagGen.get(t) || 0);
  keyGen.set(key, seen);
}

/**
 * Whether a GET for `key` should bypass the browser cache (re-fetch with
 * `cache: 'no-cache'`) because one of its tags was invalidated SINCE this key
 * last fetched. An unrecorded key (never fetched, e.g. resolved from the SSR
 * seed) returns false: its browser-cache entry does not exist yet, so a normal
 * fetch already returns fresh data. Pure (no mutation): the next successful GET
 * updates the key's recorded generations via `registerKeyTags`.
 * @param {string} key
 * @returns {boolean}
 */
export function consumeStale(key) {
  const seen = keyGen.get(key);
  if (!seen) return false;
  for (const [t, g] of seen) if ((tagGen.get(t) || 0) > g) return true;
  return false;
}

/** Parse a comma-separated tag header into a trimmed, non-empty list. */
export function parseTagHeader(value) {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Test seam: clear all tag state. */
export function __resetActionCache() {
  tagGen.clear();
  keyGen.clear();
}
