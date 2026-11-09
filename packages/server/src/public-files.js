/**
 * `public/` served at the URL root, as in Next.js: `public/logo.png` is
 * `/logo.png`, `public/robots.txt` is `/robots.txt`, `public/sw.js` is
 * `/sw.js`. There is no `/public/` URL prefix.
 *
 * Resolution order matches Next: the framework's own assets, then the app's
 * source modules, then a public file, then the routes. So a public file beats
 * a DYNAMIC route at the same URL, and a public file at the same URL as a
 * static page, a `route.ts` or a metadata route is a boot error
 * (`no-public-route-conflict`, see app-layout.js), since one would silently
 * shadow the other.
 *
 * @module public-files
 */
import { readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

/**
 * Every file under `<appDir>/public`, as the URL path it is served at
 * (`/images/a.png`). Symlinks are not followed. Empty when there is no
 * `public/` directory.
 * @param {string} appDir
 * @returns {Set<string>}
 */
export function buildPublicIndex(appDir) {
  /** @type {Set<string>} */
  const out = new Set();
  const root = join(appDir, 'public');
  /** @param {string} dir @param {string} prefix */
  const walk = (dir, prefix) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const url = `${prefix}/${e.name}`;
      if (e.isDirectory()) walk(join(dir, e.name), url);
      else if (e.isFile()) out.add(url);
    }
  };
  walk(root, '');
  return out;
}

/**
 * The file a URL path names under `<appDir>/public`, or null when the path
 * escapes the directory (a `..%2F` that survived URL parsing) or is a
 * directory path. Does not check existence.
 * @param {string} appDir
 * @param {string} urlPath decoded pathname
 * @returns {string | null}
 */
export function publicFilePath(appDir, urlPath) {
  if (!urlPath || urlPath === '/' || urlPath.endsWith('/')) return null;
  const root = join(appDir, 'public') + sep;
  const abs = join(root, urlPath);
  return abs.startsWith(root) ? abs : null;
}

/**
 * Whether a URL path is a public file. Production answers from the boot-time
 * index; dev checks the disk so a file added while the server runs is served
 * at once.
 * @param {string} appDir
 * @param {string} urlPath
 * @param {{ dev: boolean, index?: Set<string> | null }} opts
 * @returns {string | null} the absolute file, or null
 */
export function resolvePublicFile(appDir, urlPath, { dev, index }) {
  const abs = publicFilePath(appDir, urlPath);
  if (!abs) return null;
  if (!dev && index) return index.has(urlPath) ? abs : null;
  try { return statSync(abs).isFile() ? abs : null; } catch { return null; }
}
