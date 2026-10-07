/**
 * The import specifier for a module the dev server re-imports on every request
 * (#1550): a page, layout, route handler, action module, middleware, and so on.
 *
 * In dev the specifier carries a fresh `?t=` query, so each request gets a new
 * module instance and a just-edited top-level file is served without waiting
 * for a restart. Node keys its ESM cache by the full file URL, query included.
 * Bun keys its cache by path and DROPS the query of a `file://` specifier, so
 * the same URL-plus-query is a silent no-op there: on Bun the query must ride a
 * plain absolute path, which Bun loads fresh (and hands to a `Bun.plugin`
 * `onLoad` with the query intact).
 *
 * A path that already contains `?` or `#` cannot carry a query unambiguously as
 * a plain path, so on Bun it falls back to the file URL (no fresh import; the
 * dev supervisor's restart still picks the edit up).
 *
 * Outside dev the specifier is the plain file URL, exactly as before.
 */
import { pathToFileURL } from 'node:url';

/**
 * @param {string} file absolute file path
 * @param {boolean} dev whether to cache-bust
 * @param {{ bun?: boolean, now?: () => number }} [opts] test seams: the runtime (default: detected) and the clock
 * @returns {string}
 */
export function devImportSpecifier(file, dev, opts = {}) {
  const url = pathToFileURL(file).toString();
  if (!dev) return url;
  const bun = opts.bun ?? Boolean(typeof process !== 'undefined' && process.versions && process.versions.bun);
  const bust = `?t=${(opts.now ?? Date.now)()}-${Math.random().toString(36).slice(2)}`;
  if (bun && !/[?#]/.test(file)) return file + bust;
  return url + bust;
}
