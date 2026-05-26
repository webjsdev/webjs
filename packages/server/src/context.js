import { AsyncLocalStorage } from 'node:async_hooks';
import { parseCookies } from './csrf.js';

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
 * Return the CSP nonce for the in-flight request, or empty string if
 * the request has no `Content-Security-Policy: script-src 'nonce-...'`
 * directive. Intended for user code that emits inline `<script>` tags
 * from a layout / page / metadata route and needs them to pass strict
 * CSP. Use:
 *
 *   import { cspNonce } from '@webjsdev/server';
 *   return html`<script nonce="${cspNonce()}">...</script>`;
 *
 * When a CSP nonce is in effect the script gets the matching value;
 * when not, the attribute is empty (browser ignores it). Safe to call
 * from any server-side render path. Returns '' outside a request
 * (e.g. module top-level), so the call is safe in SSR boundary cases
 * where context may not be set up yet.
 *
 * @returns {string}
 */
export function cspNonce() {
  const req = als.getStore()?.req;
  if (!req) return '';
  const csp = req.headers.get('content-security-policy') || '';
  const match = /\bnonce-([A-Za-z0-9+/=]+)/.exec(csp);
  return match ? match[1] : '';
}

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
