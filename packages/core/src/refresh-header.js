/**
 * The `x-webjs-refresh` header a server action's response carries when it
 * called `revalidatePath()`. A leaf module (no imports), so the router's
 * fetch path and the action stub's effects can both read it without an
 * import cycle.
 *
 * @module refresh-header
 */

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
