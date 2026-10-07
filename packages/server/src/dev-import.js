/**
 * The import specifier for a module the dev server re-imports on every request
 * (#1550): a page, layout, route handler, action module, middleware, and so on.
 *
 * In dev the specifier carries a `?t=` query naming the file's CONTENT (#1575),
 * so a just-edited top-level file is served without waiting for a restart. Node
 * keys its ESM cache by the full file URL, query included. Bun keys its cache by
 * path and DROPS the query of a `file://` specifier, so the same URL-plus-query
 * is a silent no-op there: on Bun the query must ride a plain absolute path,
 * which Bun loads fresh (and hands to a `Bun.plugin` `onLoad` with the query
 * intact).
 *
 * The query used to be random per call, which made every request a NEW module
 * instance that neither runtime ever frees: about 60 KB per page view, so a dev
 * server left open on a page grew without bound. Keyed by content, an unchanged
 * file maps to the module already loaded. Content rather than mtime, because
 * Linux stamps mtime from a coarse clock, so two quick writes of the same
 * length can share one and the second would never be seen. A file that cannot
 * be read gets a unique query, the old behaviour.
 *
 * A path that already contains `?` or `#` cannot carry a query unambiguously as
 * a plain path, so on Bun it falls back to the file URL (no fresh import; the
 * dev supervisor's restart still picks the edit up).
 *
 * Outside dev the specifier is the plain file URL, exactly as before.
 */
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/**
 * @param {string} file absolute file path
 * @param {boolean} dev whether to cache-bust
 * @param {{ bun?: boolean, version?: (file: string) => string }} [opts] test
 *   seams: the runtime (default: detected) and the content version
 * @returns {string}
 */
export function devImportSpecifier(file, dev, opts = {}) {
  const url = pathToFileURL(file).toString();
  if (!dev) return url;
  const bun = opts.bun ?? Boolean(typeof process !== 'undefined' && process.versions && process.versions.bun);
  const bust = `?t=${(opts.version ?? contentVersion)(file)}`;
  if (bun && !/[?#]/.test(file)) return file + bust;
  return url + bust;
}

/**
 * A short hash of the file's bytes, or a unique token when it cannot be read.
 * @param {string} file
 * @returns {string}
 */
export function contentVersion(file) {
  try {
    return createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 16);
  } catch {
    return `u${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Specifiers whose import rejected, mapped to the key to use instead (#1575).
 * Under `bun --hot`, importing a module that failed to parse a SECOND time
 * through the same specifier never settles, and a later reload can then crash
 * the process (Bun 1.3.14). A content-keyed specifier repeats for as long as
 * the bytes do, so a broken file would hang every request after the first. A
 * failed key is therefore never imported again: the next attempt gets a fresh
 * one, which sticks once it loads.
 * @type {Map<string, string>}
 */
const RETRY_KEYS = new Map();
let retrySeq = 0;

/**
 * `import()` a module the dev server re-imports on every request, through
 * `devImportSpecifier`. Use this rather than `import(devImportSpecifier(...))`.
 *
 * @param {string} file absolute file path
 * @param {boolean} dev
 * @returns {Promise<any>}
 */
export async function devImport(file, dev) {
  const base = devImportSpecifier(file, dev);
  if (!dev) return import(base);
  const spec = RETRY_KEYS.get(base) || base;
  try {
    return await import(spec);
  } catch (e) {
    RETRY_KEYS.set(base, `${base}-r${++retrySeq}`);
    throw e;
  }
}
