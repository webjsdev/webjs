/**
 * Browser-side effects a server action's RPC response asks for, the Next.js
 * behaviours an `await action()` call has after the action ran:
 *
 *   - `x-webjs-refresh` (written when the action called `revalidatePath`):
 *     evict the client router's cached copies of those paths and, when the
 *     page on screen is one of them, re-render it in place (`refreshPage`), so
 *     the caller sees fresh server data with no reload.
 *   - `x-webjs-redirect` (the action threw `redirect()` / `permanentRedirect()`):
 *     navigate there with the client router (a full load for another origin),
 *     and reject the call with the redirect sentinel, so code after
 *     `await action()` does not run, exactly as in Next.
 *
 * The generated action stub calls these; app code does not need to.
 *
 * @module action-effects-client
 */
import { revalidate, refreshPage, navigate } from './router-client/navigator.js';
import { isRedirect } from './nav.js';
import { parseRefreshHeader, refreshCovers } from './refresh-header.js';

export { parseRefreshHeader, refreshCovers };

/**
 * Apply an `x-webjs-refresh` header: evict the cached snapshots it names, and
 * refresh the current page in place when it is one of them (a `layout` entry
 * refreshes the whole shell, since the layout's own markup may have changed).
 * Resolves once the refresh applied, so `await action()` returns after the
 * page shows the new data, as in Next.
 * @param {string | null | undefined} value
 * @returns {Promise<boolean>} whether the current page was refreshed
 */
export async function applyActionRefresh(value) {
  const entries = parseRefreshHeader(value);
  if (!entries.length || typeof location === 'undefined') return false;
  let current = false;
  let shell = false;
  for (const e of entries) {
    const pattern = e.layout || e.path.includes('[');
    if (pattern) revalidate();
    else revalidate(e.path);
    if (refreshCovers(e, location.pathname)) {
      current = true;
      if (e.layout) shell = true;
    }
  }
  if (!current) return false;
  try { return await refreshPage(shell ? 'shell' : 'page'); } catch { return false; }
}

let rejectionFilterInstalled = false;

/**
 * Follow an `x-webjs-redirect` header (`<url>;<push|replace>`): a same-origin
 * target goes through the client router, another origin is a full load.
 * Returns a promise rejected with the redirect sentinel, and makes sure an
 * unhandled one (a fire-and-forget `action()` in a click handler) is not
 * reported as an error, since it is navigation.
 * @param {string} value
 * @returns {Promise<never>}
 */
export function followActionRedirect(value) {
  const cut = value.lastIndexOf(';');
  const url = cut === -1 ? value : value.slice(0, cut);
  const replace = cut !== -1 && value.slice(cut + 1) === 'replace';
  const err = new Error(`webjs: redirect(${url})`);
  /** @type {any} */ (err).__webjs = Symbol.for('webjs.redirect');
  /** @type {any} */ (err).url = url;
  if (typeof location !== 'undefined') {
    if (!rejectionFilterInstalled && typeof addEventListener === 'function') {
      rejectionFilterInstalled = true;
      addEventListener('unhandledrejection', (e) => { if (isRedirect(e.reason)) e.preventDefault(); });
    }
    let target;
    try { target = new URL(url, location.href); } catch { target = null; }
    if (target && target.origin === location.origin) {
      Promise.resolve(navigate(target.pathname + target.search + target.hash, { replace })).catch(() => location.assign(target.href));
    } else if (target) {
      if (replace) location.replace(target.href);
      else location.assign(target.href);
    }
  }
  return Promise.reject(err);
}
