import { AsyncLocalStorage } from 'node:async_hooks';
import { parseCookies } from './csrf.js';
import { setCspNonceProvider, cspNonce } from '@webjsdev/core';

/**
 * Per-request context backed by AsyncLocalStorage. Lets server-side code
 * (pages, layouts, server actions, exposed actions) read the current
 * Request's headers and cookies without explicit threading: the same
 * ergonomics as NextJs's `headers()` / `cookies()` from `next/headers`.
 *
 * Strictly server-side: importing this module on the client is a bug.
 *
 * @typedef {{ req: Request }} Store
 */

/** @type {AsyncLocalStorage<Store>} */
const als = new AsyncLocalStorage();

/**
 * Run `fn` with the given request bound as the current context.
 * @template T
 * @param {Request} req
 * @param {() => T} fn
 * @returns {T}
 */
export function withRequest(req, fn) {
  return als.run({ req }, fn);
}

/** @returns {Request | null} */
export function getRequest() {
  return als.getStore()?.req ?? null;
}

/**
 * Server-only implementation of the CSP nonce reader: pulls the
 * current request from AsyncLocalStorage, parses the
 * `script-src 'nonce-...'` value from its CSP header, returns ''
 * when none in scope.
 *
 * The public `cspNonce()` function lives in `@webjsdev/core` so user
 * layouts / pages can import it without dragging server-only deps
 * (node:async_hooks etc.) into browser-loaded modules. The actual
 * implementation is wired here, server-side only, via
 * `setCspNonceProvider`. On the browser there is no provider, so
 * `cspNonce()` returns '' (empty `nonce=""` attribute, browser
 * ignores it).
 */
// The regex captures the first `nonce-...` token anywhere in the CSP
// header. Webjs uses a single per-request nonce shared across all
// directives that emit it (the standard CSP3 single-nonce model),
// so reading the first match is correct. If a future caller emits
// styled inline content under a separate style nonce, this reader
// would need to become directive-scoped. Kept identical to the
// matching helper in ssr.js so both paths interpret the header the
// same way.
setCspNonceProvider(() => {
  const req = als.getStore()?.req;
  if (!req) return '';
  const csp = req.headers.get('content-security-policy') || '';
  const match = /\bnonce-([A-Za-z0-9+/=]+)/.exec(csp);
  return match ? match[1] : '';
});

// Re-export for backwards-compat: callers that imported cspNonce from
// @webjsdev/server still work. New code should import from
// @webjsdev/core for browser-isomorphism.
export { cspNonce };

/**
 * Read-only headers for the in-flight request. Throws outside a request
 * (e.g. at module top-level).
 * @returns {Headers}
 */
export function headers() {
  const req = getRequest();
  if (!req) throw new Error('headers(): called outside a request scope');
  return req.headers;
}

/**
 * Read-only cookie jar for the in-flight request. Returns an object with
 * `.get(name)`, `.has(name)`, `.entries()`. To SET a cookie, return a
 * `Response` whose headers include `Set-Cookie` (route handlers and
 * exposed actions can do this directly).
 *
 * @returns {{ get: (name: string) => string | undefined, has: (name: string) => boolean, entries: () => [string, string][] }}
 */
export function cookies() {
  const req = getRequest();
  if (!req) throw new Error('cookies(): called outside a request scope');
  const map = parseCookies(req);
  return {
    get: (name) => map[name],
    has: (name) => Object.prototype.hasOwnProperty.call(map, name),
    entries: () => Object.entries(map),
  };
}
