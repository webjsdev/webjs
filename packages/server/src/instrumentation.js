/**
 * Boot-time instrumentation hook (#848, Next parity for instrumentation.ts).
 *
 * An optional app-root `instrumentation.{js,ts}` default-exports (or names) a
 * `register()` function the framework runs ONCE at boot, before the route table
 * is built and before any request is served. It is the place to wire
 * observability plumbing (OpenTelemetry, an APM, a logger) that must start
 * before the app handles traffic.
 *
 * Inside `register()`, the app may call `setOnError(fn)` (imported from
 * `@webjsdev/server`) to register an error sink. It COMPOSES with the
 * programmatic `createRequestHandler({ onError })` option (both fire), so the
 * file-based hook and the option-based sink coexist.
 *
 * @module instrumentation
 */

import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { AsyncLocalStorage } from 'node:async_hooks';
import { devImport } from './dev-import.js';
import { shared } from './process-shared.js';
import { errorDigest } from './action-error.js';

/**
 * Per-boot handoff channel for a `register()`-registered error sink. An
 * AsyncLocalStorage (NOT a module global) so two `runInstrumentation` calls
 * racing in one process (e.g. `Promise.all` of two `createRequestHandler`s in a
 * test) each get their OWN store: `setOnError` writes to whichever run's context
 * is active, so a concurrent boot can never capture the other's sink. The
 * context propagates across the `await register()` awaits.
 * @type {AsyncLocalStorage<{ onError: ((error: unknown, ctx?: any) => void) | null }>}
 */
const _als = shared('instrumentation-als', () => new AsyncLocalStorage());

/**
 * Register an error sink from inside `instrumentation.register()`. Composes with
 * the `createRequestHandler({ onError })` option. Passing a non-function clears
 * it. A call made outside a `runInstrumentation` context (no active store) is a
 * safe no-op.
 * @param {(error: unknown, ctx?: any) => void} fn
 */
export function setOnError(fn) {
  const store = _als.getStore();
  if (store) store.onError = typeof fn === 'function' ? fn : null;
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

/**
 * Locate the optional app-root `instrumentation-client.{js,ts,mts,mjs}` (#848),
 * the browser boot hook imported first in the client boot script. Lives at the
 * app root (sibling of `app/`), like the server `instrumentation.{js,ts}` and
 * Next's instrumentation-client. Returns the absolute path or null.
 * @param {string} appDir
 * @returns {Promise<string | null>}
 */
export async function findInstrumentationClient(appDir) {
  for (const name of ['instrumentation-client.ts', 'instrumentation-client.js', 'instrumentation-client.mts', 'instrumentation-client.mjs']) {
    const p = join(appDir, name);
    if (await exists(p)) return p;
  }
  return null;
}

/**
 * Run the app's boot-time instrumentation hook exactly once. Loads
 * `instrumentation.{js,ts,mts,mjs}` at the app root (opt-in: absent is a no-op)
 * and calls its `register()` (the default export if it is a function, else a
 * named `register` export). Returns any error sink the hook registered via
 * `setOnError`, so the caller can compose it with its own `onError`.
 *
 * @param {string} appDir
 * @param {{ dev?: boolean, logger?: { error?: (...a: any[]) => void } }} [opts]
 * The module may also export Next.js's `onRequestError(error, request, context)`,
 * which is returned as `onRequestError` for the request handler to call on
 * every reported server error (see `buildRequestErrorReport`).
 *
 * @returns {Promise<{ onError: ((error: unknown, ctx?: any) => void) | null, onRequestError: OnRequestError | null }>}
 */
export async function runInstrumentation(appDir, opts = {}) {
  const { dev = false, logger } = opts;
  let file = null;
  for (const name of ['instrumentation.ts', 'instrumentation.js', 'instrumentation.mts', 'instrumentation.mjs']) {
    const p = join(appDir, name);
    if (await exists(p)) { file = p; break; }
  }
  if (!file) return { onError: null, onRequestError: null };
  // Per-boot store: setOnError writes here, scoped to THIS run's async context.
  const store = { onError: null };
  /** @type {OnRequestError | null} */
  let onRequestError = null;
  await _als.run(store, async () => {
    try {
      const mod = await devImport(file, dev);
      const register = typeof mod.default === 'function'
        ? mod.default
        : (typeof mod.register === 'function' ? mod.register : null);
      if (typeof mod.onRequestError === 'function') onRequestError = mod.onRequestError;
      if (register) await register();
    } catch (e) {
      // A failing instrumentation hook must not crash boot: log and continue, the
      // same fail-open posture as the readiness loader. The app still serves.
      logger?.error?.(`[webjs] instrumentation.{js,ts} register() failed`, { err: String(e) });
    }
  });
  return { onError: store.onError, onRequestError };
}

/**
 * @typedef {(
 *   error: Error & { digest: string },
 *   request: { path: string, method: string, headers: Record<string, string> },
 *   context: { routerKind: 'App Router', routePath: string, routeType: 'render' | 'route' | 'action' | 'proxy', revalidateReason: undefined, renderSource?: string },
 * ) => void | Promise<void>} OnRequestError
 */

/**
 * The internal pipeline phase to Next's `routeType`. A page render, a metadata
 * route, and a last-resort crash in the handler are all `render`; root and
 * segment middleware are `proxy` (Next 16's name for middleware).
 * @type {Record<string, 'render' | 'route' | 'action' | 'proxy'>}
 */
const ROUTE_TYPE = { ssr: 'render', metadata: 'render', handle: 'render', route: 'route', action: 'action', middleware: 'proxy' };

/**
 * Build the three arguments Next.js passes to `onRequestError`, from the error
 * the pipeline caught, the request, and its phase. The error gains a `digest`
 * (the same hash the sanitized production responses carry, so a report maps
 * back to what the client saw) when it does not already have one.
 *
 * @param {unknown} error
 * @param {Request} request
 * @param {string} phase
 * @param {string} [routePath] the app-relative route file path, `/app/blog/[slug]`
 * @returns {Promise<Parameters<OnRequestError>>}
 */
export async function buildRequestErrorReport(error, request, phase, routePath) {
  /** @type {any} */
  let err = error instanceof Error ? error : new Error(String(error));
  if (typeof err.digest !== 'string') {
    const digest = await errorDigest(err);
    if (Object.isExtensible(err)) err.digest = digest;
    else err = Object.assign(new Error(err.message, { cause: err }), { digest });
  }
  /** @type {Record<string, string>} */
  const headers = {};
  for (const [k, v] of request.headers) headers[k] = v;
  let path = '/';
  try { const u = new URL(request.url); path = u.pathname + u.search; } catch { /* keep / */ }
  return [
    err,
    { path, method: request.method, headers },
    { routerKind: 'App Router', routePath: routePath || path.split('?')[0], routeType: ROUTE_TYPE[phase] || 'render', revalidateReason: undefined },
  ];
}
