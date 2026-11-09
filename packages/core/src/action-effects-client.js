/**
 * Browser-side effects a server action's RPC response asks for, the Next.js
 * behaviours an `await action()` call has after the action ran:
 *
 *   - `x-webjs-refresh` (written when the action called `revalidatePath`):
 *     evict the client router's cached copies of those paths and, when the
 *     page on screen is one of them, re-render it in place (`refreshPage`), so
 *     the caller sees fresh server data with no reload.
 *
 * The generated action stub calls these; app code does not need to.
 *
 * @module action-effects-client
 */
import { revalidate, refreshPage } from './router-client/navigator.js';

/**
 * Parse an `x-webjs-refresh` header: comma-separated, percent-encoded paths,
 * each optionally suffixed `;layout` (Next's `revalidatePath(path, 'layout')`).
 * @param {string | null | undefined} value
 * @returns {{ path: string, layout: boolean }[]}
 */
export function parseRefreshHeader(value) {
  if (!value) return [];
  /** @type {{ path: string, layout: boolean }[]} */
  const out = [];
  for (const part of String(value).split(',')) {
    const raw = part.trim();
    if (!raw) continue;
    const layout = raw.endsWith(';layout');
    let path = layout ? raw.slice(0, -';layout'.length) : raw;
    try { path = decodeURIComponent(path); } catch { /* keep as sent */ }
    if (path.startsWith('/')) out.push({ path, layout });
  }
  return out;
}

/**
 * Whether `pathname` is covered by one refreshed entry. A `[param]` segment
 * matches any one segment and a `[...param]` / `[[...param]]` segment the rest
 * (Next lets `revalidatePath` name a route pattern); a `layout` entry also
 * covers every path below it.
 * @param {{ path: string, layout: boolean }} entry
 * @param {string} pathname
 */
export function refreshCovers(entry, pathname) {
  const want = entry.path.split('/').filter(Boolean);
  const have = pathname.split('/').filter(Boolean);
  for (let i = 0; i < want.length; i++) {
    const w = want[i];
    if (/^\[\[?\.\.\./.test(w)) return true;
    if (i >= have.length) return false;
    if (/^\[[^\]]+\]$/.test(w)) continue;
    if (w !== have[i]) return false;
  }
  return entry.layout || have.length === want.length;
}

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

/**
 * Evict the snapshots an `x-webjs-refresh` header names without refreshing,
 * for a response the router is already applying (a form's in-place 422).
 * @param {string | null | undefined} value
 */
export function evictRefreshed(value) {
  for (const e of parseRefreshHeader(value)) {
    if (e.layout || e.path.includes('[')) revalidate();
    else revalidate(e.path);
  }
}
