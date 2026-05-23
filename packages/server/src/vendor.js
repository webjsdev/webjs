/**
 * Auto-serve npm dependencies for the browser via esm.sh, with a local
 * file cache.
 *
 * When user code imports a bare specifier (e.g. `import dayjs from 'dayjs'`)
 * from a client-side file, the browser can't resolve it natively. Rather
 * than running a bundler on the user's machine, webjs follows the
 * Rails 7 + importmap-rails pattern: bare specifiers resolve to URLs
 * served by esm.sh (a CDN that pre-bundles npm packages as ESM), and the
 * dev server proxies + caches the response so subsequent requests are
 * served from disk.
 *
 * Net effect for end users: zero local esbuild dependency, smaller
 * framework wire bytes (single bundle vs many source files), one HTTP
 * request per package vs many.
 *
 *   1. On startup (and rebuild), scan client-reachable source for bare
 *      import specifiers. For each, resolve the installed version from
 *      `node_modules/<pkg>/package.json`.
 *
 *   2. Build importmap entries pointing at `/__webjs/vendor/<pkg>@<ver>`.
 *
 *   3. On first browser request for that URL, fetch from `esm.sh` (fall
 *      back to `jspm.io` if esm.sh fails), write to
 *      `node_modules/.webjs-cache/`, serve the bytes.
 *
 *   4. Subsequent requests serve from the on-disk cache without any
 *      network call. The cache persists across server restarts.
 *
 * Workspace packages (anything resolving inside the monorepo via
 * `workspace:*`, `file:`, or a symlinked path) are served from their
 * local source per-file, bypassing the CDN entirely. This keeps the
 * framework-dev loop fast and avoids requiring the framework to be
 * published before it can be tested locally.
 *
 * Air-gapped / offline deploys: `webjs vendor pin` populates the cache
 * eagerly so the production server never has to hit a CDN at runtime.
 * Recommended for Docker builds: `RUN webjs vendor pin` after install.
 */

import { readFile, readdir, stat, mkdir, writeFile, unlink } from 'node:fs/promises';
import { realpathSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { createRequire } from 'node:module';

/**
 * In-memory cache layered on top of the disk cache. Each entry holds the
 * bundled ESM source string for a `<pkg>@<version>` (or
 * `<pkg>@<version>/<subpath>`) key.
 *
 * The memory cache is bounded (LRU-ish via Map insertion order) to keep
 * long-running prod servers from accumulating dead packages.
 * @type {Map<string, string>}
 */
const memoryCache = new Map();
const MEMORY_CACHE_MAX = 100;

/**
 * Packages that ship with the framework runtime and are always-mapped
 * via the importmap to internal `/__webjs/core/*` URLs. Never sent to
 * the CDN.
 */
const BUILTIN = new Set(['@webjsdev/core', '@webjsdev/core/', '@webjsdev/core/client-router']);

/**
 * Default CDN chain. esm.sh is the primary; jspm.io is the fallback if
 * esm.sh is down or returns a 4xx for the package. Both serve pre-built
 * ESM that handles the CJS-to-ESM conversion plus transitive bundling.
 *
 * `?target=es2022` matches the runtime target the framework expects.
 */
const CDN_TEMPLATES = [
  (pkg, version, sub) => `https://esm.sh/${pkg}@${version}${sub}?target=es2022`,
  (pkg, version, sub) => `https://ga.jspm.io/npm:${pkg}@${version}${sub}`,
];

/** Re-export so callers don't need to redefine the predicate. */
export function isBuiltin(spec) {
  return BUILTIN.has(spec);
}

// ---------------------------------------------------------------------------
// Scanning client-reachable source for bare imports
// ---------------------------------------------------------------------------

/** @type {RegExp} */
const IMPORT_RE = /\bimport\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Extract the package name from a bare specifier.
 *   `'dayjs'`             yields `'dayjs'`
 *   `'dayjs/locale/en'`   yields `'dayjs'`
 *   `'@tanstack/query'`   yields `'@tanstack/query'`
 *   `'@tanstack/query/x'` yields `'@tanstack/query'`
 *   `'./foo'`, `'../bar'`, `'/baz'`, `'http://...'` yield `null`.
 *
 * @param {string} spec
 * @returns {string | null}
 */
export function extractPackageName(spec) {
  if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('__')) return null;
  if (/^[a-z]+:/.test(spec)) return null; // http:, data:, blob:, node:
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return spec.split('/')[0];
}

/**
 * Extract the subpath portion of a bare specifier (everything after the
 * package name).
 *   `'dayjs'`             yields `''`
 *   `'dayjs/locale/en'`   yields `'/locale/en'`
 *   `'@tanstack/query/x'` yields `'/x'`
 *
 * @param {string} spec
 * @returns {string}
 */
export function extractSubpath(spec) {
  if (!spec) return '';
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    if (parts.length <= 2) return '';
    return '/' + parts.slice(2).join('/');
  }
  const idx = spec.indexOf('/');
  return idx < 0 ? '' : spec.slice(idx);
}

/**
 * Recursively scan a directory tree for bare imports in `.js` / `.ts` /
 * `.mjs` / `.mts` files. Skips `node_modules`, `.webjs`, `public`, and
 * any directory starting with `_`. Files marked with `'use server'` are
 * skipped (their imports never reach the browser).
 *
 * @param {string} dir
 * @returns {Promise<Set<string>>}  full bare specifiers (with subpath)
 */
export async function scanBareImports(dir) {
  /** @type {Set<string>} */
  const found = new Set();
  await walk(dir, found);
  for (const b of BUILTIN) found.delete(b);
  return found;
}

/**
 * @param {string} dir
 * @param {Set<string>} found
 */
async function walk(dir, found) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.webjs' || e.name === 'public' || e.name.startsWith('_')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, found);
    } else if (/\.(js|ts|mjs|mts)$/.test(e.name) && !e.name.endsWith('.server.ts') && !e.name.endsWith('.server.js')) {
      try {
        const src = await readFile(full, 'utf8');
        if (src.trimStart().startsWith("'use server'") || src.trimStart().startsWith('"use server"')) continue;
        for (const m of src.matchAll(IMPORT_RE)) {
          const pkg = extractPackageName(m[1]);
          if (pkg && !BUILTIN.has(pkg)) found.add(m[1]);
        }
        for (const m of src.matchAll(DYNAMIC_IMPORT_RE)) {
          const pkg = extractPackageName(m[1]);
          if (pkg && !BUILTIN.has(pkg)) found.add(m[1]);
        }
      } catch { /* unreadable file */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Workspace detection (monorepo dev: serve from local source, not CDN)
// ---------------------------------------------------------------------------

/**
 * Return true if `pkgName` resolves to a directory inside the same
 * monorepo as `appDir` (workspace dep), false if it resolves into a real
 * `node_modules` checkout.
 *
 * Used to keep monorepo dev fast: when working on the framework, app
 * imports resolve to the local `packages/core/src/*` instead of round-
 * tripping through esm.sh + cache.
 *
 * @param {string} pkgName
 * @param {string} appDir
 * @returns {boolean}
 */
export function isWorkspaceDep(pkgName, appDir) {
  try {
    // npm hoists workspace packages into node_modules via symlinks, so
    // `require.resolve` always returns a path through node_modules.
    // Resolve the symlink with `realpathSync` to find the actual target
    // directory; if that target sits outside any node_modules tree it's a
    // workspace package, otherwise a real install.
    const linkPath = join(appDir, 'node_modules', pkgName);
    if (!existsSync(linkPath)) return false;
    const real = realpathSync(linkPath);
    return !real.split(sep).includes('node_modules');
  } catch {
    return false;
  }
}

/**
 * Read a package's installed version from its `package.json`.
 *
 * @param {string} pkgName
 * @param {string} appDir
 * @returns {string | null}
 */
export function getPackageVersion(pkgName, appDir) {
  try {
    // Many packages lock down `./package.json` in their `exports` field, so
    // `require.resolve('<pkg>/package.json')` throws ERR_PACKAGE_PATH_NOT_EXPORTED
    // for packages like `@webjsdev/core` that intentionally restrict subpaths.
    // Walk to node_modules/<pkg>/package.json directly via the filesystem
    // (after resolving any symlink, so workspace links also work).
    const linkPath = join(appDir, 'node_modules', pkgName);
    if (!existsSync(linkPath)) return null;
    const real = realpathSync(linkPath);
    const pkg = JSON.parse(readFileSync(join(real, 'package.json'), 'utf8'));
    return pkg.version || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Disk cache (node_modules/.webjs-cache/)
// ---------------------------------------------------------------------------

/**
 * Compute the on-disk path for a cached vendor bundle.
 *
 * @param {string} appDir
 * @param {string} pkgName
 * @param {string} version
 * @param {string} subpath   '' or '/sub/path'
 */
function cachePath(appDir, pkgName, version, subpath) {
  const safeSubpath = subpath.replace(/[\/]/g, '__');
  const fname = `${encodeURIComponent(pkgName)}@${version}${safeSubpath}.js`;
  return join(appDir, 'node_modules', '.webjs-cache', fname);
}

/**
 * Memory then disk cache lookup, in that order.
 *
 * @returns {Promise<string | null>}
 */
async function readCache(appDir, pkgName, version, subpath) {
  const memKey = `${pkgName}@${version}${subpath}`;
  const mem = memoryCache.get(memKey);
  if (mem) return mem;
  try {
    const code = await readFile(cachePath(appDir, pkgName, version, subpath), 'utf8');
    memoryCache.set(memKey, code);
    return code;
  } catch {
    return null;
  }
}

/**
 * Write the bundled source to memory plus disk cache.
 */
async function writeCache(appDir, pkgName, version, subpath, code) {
  const memKey = `${pkgName}@${version}${subpath}`;
  if (memoryCache.size >= MEMORY_CACHE_MAX) {
    const oldest = memoryCache.keys().next().value;
    memoryCache.delete(oldest);
  }
  memoryCache.set(memKey, code);
  const path = cachePath(appDir, pkgName, version, subpath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, code, 'utf8');
}

/**
 * Remove a cached entry from memory plus disk. Used by `webjs vendor unpin`.
 */
export async function removeFromCache(appDir, pkgName, version, subpath = '') {
  const memKey = `${pkgName}@${version}${subpath}`;
  memoryCache.delete(memKey);
  try { await unlink(cachePath(appDir, pkgName, version, subpath)); }
  catch { /* not in cache */ }
}

// ---------------------------------------------------------------------------
// CDN fetch (esm.sh primary, jspm.io fallback)
// ---------------------------------------------------------------------------

/**
 * Fetch a package bundle from the CDN chain. Returns null if every CDN
 * fails. The caller's response should be a clear 404 with remediation
 * pointing at the doc page.
 *
 * @param {string} pkgName
 * @param {string} version
 * @param {string} subpath
 * @returns {Promise<string | null>}
 */
async function fetchFromCdn(pkgName, version, subpath) {
  /** @type {Error[]} */
  const errors = [];
  for (const buildUrl of CDN_TEMPLATES) {
    const url = buildUrl(pkgName, version, subpath);
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) {
        errors.push(new Error(`${url} returned ${res.status}`));
        continue;
      }
      const code = await res.text();
      return code;
    } catch (e) {
      errors.push(/** @type {Error} */(e));
    }
  }
  if (errors.length) {
    console.error(`[webjs] CDN fetch failed for ${pkgName}@${version}${subpath}:\n  ` + errors.map(e => e.message).join('\n  '));
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API: importmap + serving
// ---------------------------------------------------------------------------

/**
 * Build importmap entries for every bare specifier found by
 * `scanBareImports`. Each entry resolves a bare specifier (or
 * subpath import) to a `/__webjs/vendor/<pkg>@<ver>[/<sub>]` URL the
 * dev server handles.
 *
 * Workspace deps (resolved inside the monorepo) are skipped; the
 * server handles them as per-file source imports through the normal
 * package-resolution path.
 *
 * @param {Set<string>} bareImports  output of scanBareImports
 * @param {string} appDir
 * @returns {Record<string, string>}
 */
export function vendorImportMapEntries(bareImports, appDir) {
  /** @type {Record<string, string>} */
  const entries = {};
  for (const spec of bareImports) {
    const pkgName = extractPackageName(spec);
    if (!pkgName || BUILTIN.has(pkgName)) continue;
    if (isWorkspaceDep(pkgName, appDir)) continue;
    const version = getPackageVersion(pkgName, appDir);
    if (!version) continue;
    const subpath = extractSubpath(spec);
    const safeSubpath = subpath.replace(/[\/]/g, '__');
    entries[spec] = `/__webjs/vendor/${encodeURIComponent(pkgName)}@${version}${safeSubpath ? `/${safeSubpath}` : ''}.js`;
  }
  return entries;
}

/**
 * Serve a vendor bundle in response to a `/__webjs/vendor/<id>` URL.
 *
 * `id` is the URL path segment after `/__webjs/vendor/`, in the shape
 * `<pkgName>@<version>` or `<pkgName>@<version>/<safeSubpath>`. The
 * subpath is slash-replaced (forward slashes encoded as `__`) for the
 * filename, decoded here.
 *
 * @param {string} id
 * @param {string} appDir
 * @param {boolean} dev
 * @returns {Promise<Response>}
 */
export async function serveVendorBundle(id, appDir, dev) {
  const decoded = decodeURIComponent(id);
  let slash = decoded.indexOf('/');
  const head = slash < 0 ? decoded : decoded.slice(0, slash);
  const safeSubpath = slash < 0 ? '' : decoded.slice(slash + 1);
  const atIdx = head.lastIndexOf('@');
  if (atIdx <= 0) {
    return notFoundResponse(`malformed vendor id: ${id}`);
  }
  const pkgName = head.slice(0, atIdx);
  const version = head.slice(atIdx + 1);
  const subpath = safeSubpath ? '/' + safeSubpath.replace(/__/g, '/') : '';

  let code = await readCache(appDir, pkgName, version, subpath);
  if (!code) {
    code = await fetchFromCdn(pkgName, version, subpath);
    if (code == null) {
      return notFoundResponse(
        `vendor fetch failed for ${pkgName}@${version}${subpath}. ` +
        `Possible causes: package not on esm.sh/jspm, network down, or ` +
        `the package ships only CJS without a working ESM build. ` +
        `Run "webjs vendor pin ${pkgName}@${version}" to retry, or check ` +
        `https://esm.sh/${pkgName}@${version} directly in a browser.`
      );
    }
    await writeCache(appDir, pkgName, version, subpath, code);
  }
  return new Response(code, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': dev ? 'no-cache' : 'public, max-age=31536000, immutable',
    },
  });
}

function notFoundResponse(msg) {
  return new Response(`/* ${msg} */`, {
    status: 404,
    headers: { 'content-type': 'application/javascript; charset=utf-8' },
  });
}

/**
 * Clear the in-memory cache. Called by the file watcher on rebuild so
 * a newly added bare import is picked up on the next request. The disk
 * cache is intentionally NOT cleared (it remains valid across rebuilds
 * and restarts).
 */
export function clearVendorCache() {
  memoryCache.clear();
}

// ---------------------------------------------------------------------------
// CLI-facing functions for `webjs vendor pin / unpin / list`
// ---------------------------------------------------------------------------

/**
 * Pin a single package: fetch from CDN, write to disk cache. Used by
 * `webjs vendor pin <pkg>` to populate the cache eagerly before deploy.
 *
 * @returns {Promise<{ ok: boolean, bytes: number, error?: string }>}
 */
export async function pinPackage(appDir, pkgName, version, subpath = '') {
  const code = await fetchFromCdn(pkgName, version, subpath);
  if (code == null) {
    return { ok: false, bytes: 0, error: `CDN fetch failed for ${pkgName}@${version}${subpath}` };
  }
  await writeCache(appDir, pkgName, version, subpath, code);
  return { ok: true, bytes: code.length };
}

/**
 * Pin every bare import discovered by scanning the app's client-reachable
 * source. Used by `webjs vendor pin` (no args) to populate the cache
 * with everything the app currently uses.
 *
 * @param {string} appDir
 * @returns {Promise<Array<{ spec: string, ok: boolean, bytes: number, error?: string }>>}
 */
export async function pinAll(appDir) {
  const bare = await scanBareImports(appDir);
  const results = [];
  for (const spec of bare) {
    const pkgName = extractPackageName(spec);
    if (!pkgName || BUILTIN.has(pkgName)) continue;
    if (isWorkspaceDep(pkgName, appDir)) continue;
    const version = getPackageVersion(pkgName, appDir);
    if (!version) {
      results.push({ spec, ok: false, bytes: 0, error: 'package not installed' });
      continue;
    }
    const subpath = extractSubpath(spec);
    const res = await pinPackage(appDir, pkgName, version, subpath);
    results.push({ spec, ...res });
  }
  return results;
}

/**
 * List cached packages by reading the cache directory.
 *
 * @returns {Promise<Array<{ pkg: string, version: string, subpath: string, bytes: number }>>}
 */
export async function listCache(appDir) {
  const dir = join(appDir, 'node_modules', '.webjs-cache');
  let files;
  try { files = await readdir(dir); } catch { return []; }
  const entries = [];
  for (const f of files) {
    if (!f.endsWith('.js')) continue;
    const stem = f.slice(0, -3); // drop .js
    const atIdx = stem.lastIndexOf('@');
    if (atIdx <= 0) continue;
    const pkgName = decodeURIComponent(stem.slice(0, atIdx));
    const rest = stem.slice(atIdx + 1);
    const subIdx = rest.indexOf('__');
    const version = subIdx < 0 ? rest : rest.slice(0, subIdx);
    const subpath = subIdx < 0 ? '' : '/' + rest.slice(subIdx + 2).replace(/__/g, '/');
    const st = await stat(join(dir, f));
    entries.push({ pkg: pkgName, version, subpath, bytes: st.size });
  }
  return entries;
}
