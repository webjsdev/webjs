/**
 * Backoff for a failed live vendor resolve (#1644).
 *
 * Once the analysis is warm and the FIRST vendor attempt has failed
 * transiently (a jspm timeout, a 5xx, no network), `ensureReady` re-attempts
 * the resolve on the next request, non-blocking and single-flighted. Before
 * this module, "the next request" meant EVERY request: the single flight only
 * collapsed concurrent attempts, so a server behind a flaky CDN re-ran the
 * bare-import scan, re-read `package.json` manifests, and fired a jspm fetch
 * once per request for as long as the outage lasted, and every failed result
 * was evicted from the jspm cache (`vendor/jspm.js`), so nothing short of a
 * success ever quietened it.
 *
 * `createRetryBackoff` is the gate `ensureReady` consults: an attempt is
 * allowed when no window is open; a failure opens one, doubling each time up
 * to the cap; a success or a rebuild clears it. Pure and clock-injectable so
 * the ladder is unit-testable without a server.
 */

/**
 * @typedef {object} RetryBackoff
 * @property {() => boolean} allow  Whether a new attempt is due now.
 * @property {() => void} failed    Record a failed attempt: open (or widen) the window.
 * @property {() => void} succeeded Record a success: clear the window.
 * @property {() => void} reset     Forget everything (a rebuild).
 * @property {() => number} windowMs The current window, for diagnostics.
 */

/**
 * @param {{ initialMs?: number, maxMs?: number, now?: () => number }} [opts]
 *   `initialMs` is the first window after a failure (default 2000), `maxMs`
 *   the cap the doubling stops at (default 60000), `now` the clock (default
 *   `Date.now`, injected by tests).
 * @returns {RetryBackoff}
 */
export function createRetryBackoff(opts = {}) {
  const initialMs = Math.max(0, opts.initialMs ?? 2000);
  const maxMs = Math.max(initialMs, opts.maxMs ?? 60000);
  const now = opts.now ?? Date.now;
  let windowMs = 0;
  let notBefore = 0;
  // Closures over the state, not methods reading `this`, so a handle can be
  // destructured or passed as a callback (`onRebuild(backoff.reset)`).
  const succeeded = () => {
    windowMs = 0;
    notBefore = 0;
  };
  return {
    allow: () => windowMs === 0 || now() >= notBefore,
    failed: () => {
      windowMs = windowMs === 0 ? initialMs : Math.min(maxMs, windowMs * 2);
      notBefore = now() + windowMs;
    },
    succeeded,
    // A rebuild forgets the same thing a success does.
    reset: succeeded,
    windowMs: () => windowMs,
  };
}
