import { html } from '../html.js';

/**
 * The SSR error helpers: the prod gate, the browser-member hint, and the
 * default per-component error state (#469, #483). A leaf, so `expand.js`
 * can take them without reaching back through the renderer entry.
 */

/** True in a production build (no dev error surfacing). */
export function isProd() {
  return typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production';
}

/**
 * If `e` is the recognisable failure of touching a browser-only API during
 * SSR (a `ReferenceError` for a browser global, or a `TypeError` calling an
 * HTMLElement method that does not exist on the bare server-side instance),
 * return an actionable, member-naming hint; otherwise null.
 * @param {unknown} e
 * @returns {string | null}
 */
export function browserMemberHint(e) {
  const msg = e && typeof (/** @type any */ (e).message) === 'string' ? /** @type any */ (e).message : '';
  // Match on a word boundary, NOT end-of-string: V8 (Node) ends the message at
  // "is not defined" / "is not a function", but JSC (Bun) appends a detail
  // clause (e.g. ". (In '({}).querySelector(\"p\")', '...' is undefined)"), so an
  // anchored `$` would miss the Bun message and drop the actionable hint.
  let m = /^(\w+) is not defined\b/.exec(msg);
  if (e instanceof ReferenceError && m && SSR_BROWSER_GLOBALS.has(m[1])) {
    return `\`${m[1]}\` is a browser-only global and is undefined during SSR.`;
  }
  m = /\.(\w+) is not a function\b/.exec(msg);
  if (e instanceof TypeError && m && SSR_HTMLELEMENT_METHODS.has(m[1])) {
    return `\`${m[1]}\` is an HTMLElement method that does not exist on the server-side component instance during SSR.`;
  }
  return null;
}

// Browser-only names whose absence during SSR produces a recognisable error.
// Mirrors the `no-browser-globals-in-render` webjs check rule, which catches
// these at edit time; this turns the runtime SSR crash into the same guidance.
const SSR_BROWSER_GLOBALS = new Set([
  'document', 'window', 'localStorage', 'sessionStorage', 'navigator',
  'matchMedia', 'requestAnimationFrame', 'getComputedStyle',
  'IntersectionObserver', 'MutationObserver', 'ResizeObserver',
]);

// Attribute methods (get/set/has/remove/toggleAttribute), the event methods
// (add/removeEventListener, dispatchEvent), and attachInternals are backed by
// the server-side element shim and work at SSR, so they are NOT listed here.
// What remains is the genuinely browser-only HTMLElement surface that still
// has no server stand-in and throws at SSR.
const SSR_HTMLELEMENT_METHODS = new Set([
  'attachShadow', 'querySelector', 'querySelectorAll',
  'getBoundingClientRect', 'focus', 'blur', 'scrollIntoView',
]);

/**
 * Default component-scoped error state for an async/sync render that threw
 * during SSR, used when the component does not define renderError() (#469).
 * Dev surfaces the tag + message loudly so the failure is obvious; prod
 * renders an empty (silent, isolated) element so no internal detail leaks.
 *
 * The prod-silence signal is the SERVER's `dev` flag, threaded through the SSR
 * render context (#483). WebJs keys prod on the CLI `dev` flag, not `NODE_ENV`,
 * and `webjs start` does not export `NODE_ENV=production`, so a bare prod launch
 * would otherwise leak the message. When `dev` is undefined (a context-free
 * `renderToString` with no server signal, e.g. a bare unit test) it falls back
 * to `isProd()` / `NODE_ENV`, preserving the prior behaviour for that path.
 *
 * @param {string} tag
 * @param {Error} err
 * @param {boolean} [dev]  server dev flag; undefined falls back to NODE_ENV
 * @returns {unknown} a TemplateResult (dev) or '' (prod)
 */
export function defaultSSRErrorTemplate(tag, err, dev) {
  const surface = dev === undefined ? !isProd() : !!dev;
  if (!surface) return '';
  const msg = err && err.message ? err.message : String(err);
  return html`<div data-webjs-error="${tag}" style="border:1px solid #f5c2c7;background:#f8d7da;color:#842029;padding:8px 12px;border-radius:6px;font:13px/1.4 system-ui,sans-serif">
    <strong>&lt;${tag}&gt; failed to render</strong>
    <div style="margin-top:4px;white-space:pre-wrap">${msg}</div>
  </div>`;
}
