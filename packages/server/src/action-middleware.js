/**
 * Per-action middleware (#490). An action file declares `export const middleware
 * = [mw1, mw2]` (a reserved config export). Each middleware is
 * `async (ctx, next) => result`, run around the action on BOTH the RPC endpoint
 * and the `route.ts`/`expose()` boundary, like `validate`.
 *
 *   - `ctx` carries `{ request, args, signal, context }`. `context` is a shared
 *     mutable object the chain accumulates; the action reads it via
 *     `actionContext()` (no signature change, the same plumbing as
 *     `actionSignal()`).
 *   - `next()` runs the next middleware, ending at the action; its return value
 *     flows back up. A middleware SHORT-CIRCUITS by returning a value (an
 *     `ActionResult` envelope, e.g. `{ success: false, status: 401 }`) WITHOUT
 *     calling `next()`, so the action never runs.
 *
 * The framework ships no middleware; it only runs the chain. Server-only.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

/** Per-request accumulated context, readable by the action via actionContext(). */
const als = new AsyncLocalStorage();

/** Shared empty context returned outside an action (a direct server-to-server call). */
const EMPTY = Object.freeze({});

/**
 * The accumulated middleware context for the current action, or a frozen empty
 * object outside an action. The action reads `actionContext().user` etc.
 * @returns {Record<string, unknown>}
 */
export function actionContext() {
  return als.getStore() || EMPTY;
}

/**
 * Run `finalFn` (the action) through the middleware chain, with a fresh shared
 * `context` available to `actionContext()` for the whole chain. A middleware
 * that does not call `next()` short-circuits (its return is the result). Guards
 * against a middleware calling `next()` more than once.
 * @param {Function[]} middleware
 * @param {{ request?: Request, args?: unknown[], signal?: AbortSignal }} baseCtx
 * @param {() => unknown} finalFn
 * @returns {Promise<unknown>}
 */
export function runActionChain(middleware, baseCtx, finalFn) {
  if (!middleware || middleware.length === 0) return finalFn();
  const context = {};
  const ctx = { ...baseCtx, context };
  return als.run(context, () => {
    let lastCalled = -1;
    const dispatch = (i) => {
      if (i <= lastCalled) {
        return Promise.reject(new Error('next() called multiple times in a webjs action middleware'));
      }
      lastCalled = i;
      const mw = middleware[i];
      if (!mw) return finalFn();
      return mw(ctx, () => dispatch(i + 1));
    };
    return dispatch(0);
  });
}
