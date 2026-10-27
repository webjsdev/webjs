/**
 * The build epoch: one counter every request-independent memo on the SSR
 * hot path keys on (#1644).
 *
 * "Build" here is the word in its no-build sense, the one `data-webjs-build`
 * already uses: the analysis generation of a RUNNING process (its route table,
 * module graph, elision verdict, importmap, asset hashes), which changes on a
 * deploy or a dev rebuild. Nothing is compiled, bundled, or written to disk.
 *
 * A production page render recomputed several values on every request that
 * only change when the BUILD changes: the served importmap and its `?v`
 * fingerprints, the public env shim, the auto-linked icon routes, the vendor
 * preconnect origins, the shipped-module list behind the 103 Early Hints.
 * Each of those is now memoized as `{ epoch, value }` and recomputed when
 * `buildEpoch()` has moved since the value was stored.
 *
 * One counter rather than one clear per memo: the invalidators (the importmap
 * setters, the asset-hash roots and fingerprint, the icon routes, the analysis
 * stage, the dev rebuild) would otherwise each need to know every memo, and a
 * forgotten wire would serve a stale value for the process lifetime. With the
 * epoch, an invalidator bumps once and every memo notices, and a single unit
 * test enumerates the bump sites.
 *
 * Deliberately NOT routed through `process-shared.js`: this is framework
 * internal state, so after a `bun --hot` reset the fresh server copy starts
 * its own epoch, which is exactly right (its memos are empty too).
 *
 * The epoch starts at 1 so a memo initialised with `epoch: 0` is always
 * stale on first read.
 */

let _epoch = 1;

/**
 * The current build epoch. A memo compares its stored epoch to this.
 * @returns {number}
 */
export function buildEpoch() {
  return _epoch;
}

/**
 * Invalidate every epoch-keyed memo. Call from any setter whose value feeds a
 * per-build computation, synchronously and BEFORE any `await` in that setter,
 * so a render racing the setter cannot refill a memo with pre-change state.
 * @returns {number} the new epoch
 */
export function bumpBuildEpoch() {
  return ++_epoch;
}
