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
import { pathToFileURL } from 'node:url';
import { stat } from 'node:fs/promises';

/**
 * Transient handoff channel for a `register()`-registered error sink. It is a
 * module singleton by necessity (the app imports `setOnError` from the package),
 * but `runInstrumentation` reads and CLEARS it around each boot, so the value
 * never leaks across apps sharing one process (e.g. tests): the durable copy
 * lives in the caller's closure, not here.
 * @type {((error: unknown, ctx?: any) => void) | null}
 */
let _pendingOnError = null;

/**
 * Register an error sink from inside `instrumentation.register()`. Composes with
 * the `createRequestHandler({ onError })` option. Passing a non-function clears
 * it.
 * @param {(error: unknown, ctx?: any) => void} fn
 */
export function setOnError(fn) {
  _pendingOnError = typeof fn === 'function' ? fn : null;
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
 * @returns {Promise<{ onError: ((error: unknown, ctx?: any) => void) | null }>}
 */
export async function runInstrumentation(appDir, opts = {}) {
  const { dev = false, logger } = opts;
  _pendingOnError = null;
  let file = null;
  for (const name of ['instrumentation.ts', 'instrumentation.js', 'instrumentation.mts', 'instrumentation.mjs']) {
    const p = join(appDir, name);
    if (await exists(p)) { file = p; break; }
  }
  if (!file) return { onError: null };
  try {
    const url = pathToFileURL(file).toString();
    const bust = dev ? `?t=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
    const mod = await import(url + bust);
    const register = typeof mod.default === 'function'
      ? mod.default
      : (typeof mod.register === 'function' ? mod.register : null);
    if (register) await register();
  } catch (e) {
    // A failing instrumentation hook must not crash boot: log and continue, the
    // same fail-open posture as the readiness loader. The app still serves.
    logger?.error?.(`[webjs] instrumentation.{js,ts} register() failed`, { err: String(e) });
  }
  const onError = _pendingOnError;
  _pendingOnError = null;
  return { onError };
}
