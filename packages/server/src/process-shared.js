/**
 * Process-wide state for the parts of `@webjsdev/server` an app calls into.
 *
 * Under `bun --hot` a dev reload gives the app a fresh module registry while
 * the first run's server keeps running (`dev/hot-host.js`, #1575). An app
 * module that imports `@webjsdev/server` after a reload therefore gets a NEW
 * copy of this package, whose module variables start empty, while the server
 * that handles the request is still the first copy. Anything the two must
 * agree on has to live outside the module: a request bound with the first
 * copy's `AsyncLocalStorage` is invisible to the second copy's `getRequest()`,
 * so `auth()`, `cookies()` and `headers()` inside a page or a `'use server'`
 * function saw no request after the first edit and a signed-in page rendered
 * as signed out (#1590).
 *
 * `shared(name, make)` returns the one value for `name` in this process,
 * creating it on first use, keyed by `Symbol.for` exactly as core keys its own
 * shared state. Use it for request-scoped storage and for any registry or
 * store an app reads or writes through the package's API.
 *
 * @module process-shared
 */

/**
 * @template T
 * @param {string} name
 * @param {() => T} make
 * @returns {T}
 */
export function shared(name, make) {
  const key = Symbol.for(`webjs.server.${name}`);
  const g = /** @type {any} */ (globalThis);
  if (!(key in g)) g[key] = make();
  return g[key];
}
