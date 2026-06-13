/**
 * Server-side action AbortSignal (#492). The RPC endpoint runs an action inside
 * `runWithActionSignal(req.signal, fn)`, so the action can read the request's
 * AbortSignal via `actionSignal()` and stop expensive work (a DB query, an
 * upstream fetch) when the client disconnects or aborts the call.
 *
 * Isomorphic-friendly: `actionSignal()` returns a never-aborting signal when
 * called outside an action (e.g. a direct server-to-server call), so the same
 * `fetch(url, { signal: actionSignal() })` line is safe everywhere.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const als = new AsyncLocalStorage();

/** A shared signal that never aborts, returned outside an action. */
const NEVER = (() => {
  const c = new AbortController();
  return c.signal;
})();

/**
 * Run `fn` with `signal` available to `actionSignal()` for its async extent.
 * @template T
 * @param {AbortSignal | undefined} signal
 * @param {() => T} fn
 * @returns {T}
 */
export function runWithActionSignal(signal, fn) {
  return als.run(signal || NEVER, fn);
}

/**
 * The current action's request AbortSignal (fires on client disconnect / abort),
 * or a never-aborting signal outside an action.
 * @returns {AbortSignal}
 */
export function actionSignal() {
  return als.getStore() || NEVER;
}
