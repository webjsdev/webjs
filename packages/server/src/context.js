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
 * `cspNonce` holds the per-request CSP nonce when CSP is enabled
 * (issue #233). It is minted in the request handler and written here via
 * `setCspNonce`, so the same value the `Content-Security-Policy` header
 * carries is what `cspNonce()` returns for the inline boot script.
 *
 * `bodyLimits` holds the resolved request body-size caps (issue #237) so
 * `readBody` (used inside `route.{js,ts}` handlers, which have no handle to the
 * server state) can enforce the same limit the RPC and page-action paths do. The
 * handler writes it per request via `setBodyLimits`.
 *
 * @typedef {{ req: Request, cspNonce?: string, bodyLimits?: { json: number, multipart: number } }} Store
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
 * Set the per-request CSP nonce on the current AsyncLocalStorage store.
 * Called by the request handler when CSP is enabled, AFTER it mints the
 * nonce and BEFORE the page renders, so `cspNonce()` returns this exact
 * value during SSR (the same value the response's
 * `Content-Security-Policy` header carries: one source, no drift).
 *
 * A no-op outside a request scope, or when CSP is disabled (the handler
 * simply never calls it, so the store's `cspNonce` stays undefined and
 * `cspNonce()` falls through to '').
 *
 * @param {string} nonce
 */
export function setCspNonce(nonce) {
  const store = als.getStore();
  if (store) store.cspNonce = nonce;
}

/**
 * Set the per-request resolved body-size limits on the current store (issue
 * #237). The handler computes them once at boot (`readBodyLimits`) and stamps
 * them on every request so `readBody` (json.js), which runs inside route
 * handlers with no access to the server state, can enforce the same cap.
 *
 * @param {{ json: number, multipart: number }} limits
 */
export function setBodyLimits(limits) {
  const store = als.getStore();
  if (store) store.bodyLimits = limits;
}

/**
 * Read the per-request body-size limits, or null outside a request scope.
 * @returns {{ json: number, multipart: number } | null}
 */
export function getBodyLimits() {
  return als.getStore()?.bodyLimits ?? null;
}

/**
 * Server-only implementation of the CSP nonce reader. Returns the
 * per-request nonce that the handler MINTED and stored (issue #233) when
 * CSP is enabled. Falls back to parsing an INBOUND
 * `Content-Security-Policy` request header (the legacy consume-only
 * behaviour) so an app sitting behind a proxy that already mints a nonce
 * still works without enabling webjs's own CSP. Returns '' when neither
 * is in scope.
 *
 * The public `cspNonce()` function lives in `@webjsdev/core` so user
 * layouts / pages can import it without dragging server-only deps
 * (node:async_hooks etc.) into browser-loaded modules. The actual
 * implementation is wired here, server-side only, via
 * `setCspNonceProvider`. On the browser there is no provider, so
 * `cspNonce()` returns '' (empty `nonce=""` attribute, browser
 * ignores it).
 */
// The regex fallback captures the first `nonce-...` token anywhere in the
// inbound CSP header. Webjs uses a single per-request nonce shared across
// all directives that emit it (the standard CSP3 single-nonce model), so
// reading the first match is correct. Kept identical to the matching
// helper in ssr.js so both paths interpret the header the same way.
setCspNonceProvider(() => {
  const store = als.getStore();
  if (!store) return '';
  if (typeof store.cspNonce === 'string') return store.cspNonce;
  const csp = store.req?.headers.get('content-security-policy') || '';
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
