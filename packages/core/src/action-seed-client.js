/**
 * Client-side SSR action-seed consumer (#472).
 *
 * The server (`@webjsdev/server`'s `action-seed.js`) serializes each action
 * result invoked during SSR into a `<script type="application/json"
 * id="__webjs-seeds">` block (and, for streamed regions, per-element
 * `data-webjs-seed` attributes). On the client, the generated RPC stub
 * (`actions.js`) calls `takeSeed(hash, fn, argsKey)` on its FIRST invocation: a
 * hit resolves the action synchronously with the SSR value (no RPC, no flicker
 * on hydration); a miss falls through to the normal RPC.
 *
 * Consume-once: a hit removes the seed, so a later refetch / arg-change always
 * goes to the network (the seed is a first-paint optimization, not a cache).
 * Keyed `hash/fn/stringify(args)`, where `hash` and `stringify` match exactly
 * what the server emitted, so distinct components and distinct args each map to
 * their own seed. A miss is always safe (it just re-fetches).
 *
 * This module is imported by the generated stub via the bare `@webjsdev/core`
 * specifier; on the server it is inert (its only DOM access is inside
 * `scanSeeds`, never called server-side).
 */

import { parse } from './serialize.js';

/** Global consume-once seed store: `key -> value`. */
const seeds = new Map();

/** Returned by `takeSeed` when no seed matches; distinct from any real value. */
export const SEED_MISS = Symbol('webjs.seed.miss');

/** One-time eager scan guard (the initial-load document is scanned lazily). */
let scannedInitial = false;

/**
 * Merge any seeds found under `root` into the global store, then remove the
 * carriers so a re-scan (a streamed boundary, a soft navigation) never
 * re-ingests stale data. Reads both the page-level `#__webjs-seeds` JSON block
 * and per-element `[data-webjs-seed]` carriers. Idempotent and fail-open: a
 * malformed payload is skipped, never thrown.
 * @param {ParentNode & { querySelectorAll?: Function }} [root]
 */
export function scanSeeds(root) {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope || typeof scope.querySelectorAll !== 'function') return;
  // Page-level JSON block(s).
  for (const el of scope.querySelectorAll('script[type="application/json"]#__webjs-seeds, script[type="application/json"][data-webjs-seeds]')) {
    ingest(el.textContent, el);
  }
  // Per-element carriers (streamed boundaries / future per-component seeding).
  for (const el of scope.querySelectorAll('[data-webjs-seed]')) {
    ingest(el.getAttribute('data-webjs-seed'), el, () => el.removeAttribute('data-webjs-seed'));
  }
}

/**
 * Parse one serialized seed payload and merge it (first write wins, so an
 * already-consumed or earlier seed is never clobbered by a later duplicate),
 * then run `cleanup` (or remove the element).
 * @param {string | null} raw
 * @param {Element} el
 * @param {() => void} [cleanup]
 */
function ingest(raw, el, cleanup) {
  if (raw) {
    try {
      const obj = parse(raw);
      if (obj && typeof obj === 'object') {
        for (const k in obj) if (!seeds.has(k)) seeds.set(k, obj[k]);
      }
    } catch {
      // Malformed payload: ignore, the stub re-fetches.
    }
  }
  if (cleanup) cleanup();
  else el.remove?.();
}

/**
 * Look up and CONSUME the seed for an action call. Returns the seeded value
 * (removing it) on a hit, or `SEED_MISS` when there is none. The first call
 * lazily scans the initial document, so the boot path needs no wiring; the
 * router calls `scanSeeds(subtree)` for content that arrives later.
 * @param {string} hash the action file's hash (the RPC endpoint hash)
 * @param {string} fnName the exported action name
 * @param {string} argsKey `stringify(args)`, computed by the stub with the same
 *   serializer the server used, so identical args produce an identical key
 * @returns {unknown | typeof SEED_MISS}
 */
export function takeSeed(hash, fnName, argsKey) {
  if (!scannedInitial) {
    scannedInitial = true;
    scanSeeds();
  }
  const key = `${hash}/${fnName}/${argsKey}`;
  if (seeds.has(key)) {
    const v = seeds.get(key);
    seeds.delete(key);
    return v;
  }
  return SEED_MISS;
}

/** Test seam: drop all seeds and reset the lazy-scan guard. */
export function __resetSeeds() {
  seeds.clear();
  scannedInitial = false;
}
