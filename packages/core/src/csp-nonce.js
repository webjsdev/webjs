/**
 * Read the CSP nonce for the in-flight server request. Isomorphic:
 * importable from both server-loaded and browser-loaded modules. On
 * the browser the function always returns '' (no request context).
 * On the server, `@webjsdev/server`'s context module installs a
 * provider at module-load time that reads the nonce from the
 * AsyncLocalStorage request store.
 *
 * Designed so user layouts / pages / metadata routes can write:
 *
 *   import { html, cspNonce } from '@webjsdev/core';
 *   ...
 *   return html`<script nonce="${cspNonce()}">...</script>`;
 *
 * and the same source file is safe to import from the browser (where
 * `cspNonce()` evaluates to '' and the attribute becomes empty,
 * which the browser ignores). Layouts and pages MUST load on the
 * browser so that side-effect component imports register custom
 * elements; that constraint is what forces this isomorphic shape.
 */

/** @type {(() => string) | null} */
let _provider = null;

/**
 * Internal: server-only wiring. `@webjsdev/server`'s context module
 * calls this once at load time to install the actual nonce reader.
 * Browser builds never call it, so cspNonce stays at its default ''.
 *
 * @param {() => string} fn
 */
export function setCspNonceProvider(fn) {
  _provider = fn;
}

/**
 * The runtime function. Returns the nonce from the current request,
 * or '' if no provider is set (browser) or no nonce is in scope
 * (no CSP, request without nonce, etc.).
 *
 * @returns {string}
 */
export function cspNonce() {
  if (!_provider) return '';
  try {
    return _provider() || '';
  } catch {
    return '';
  }
}
