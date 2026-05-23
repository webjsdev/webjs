/**
 * Auto-bundle npm dependencies for the browser.
 *
 * When user code imports a bare specifier (e.g. `import dayjs from 'dayjs'`)
 * from a client-side file, the browser can't resolve it natively. This module
 * provides Vite-style `optimizeDeps` behaviour:
 *
 *   1. On startup (and rebuild), scan client-reachable source for bare import
 *      specifiers that aren't already in the import map.
 *
 *   2. For each discovered package, bundle it into a single ESM file via
 *      esbuild (inlining transitive deps) and cache the result.
 *
 *   3. Serve the bundle at `/__webjs/vendor/<pkg>.js` and add it to the
 *      import map automatically.
 *
 * This is intentionally lazy + cached: the first request for a vendor bundle
 * triggers the esbuild build; subsequent requests are served from the in-memory
 * cache. A file watcher rebuild clears the cache so new deps are picked up.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { createRequire } from 'node:module';

/**
 * Cache of bundled vendor modules.
 * @type {Map<string, string>}
 */
const vendorCache = new Map();
const VENDOR_CACHE_MAX = 100;

/**
 * Set of package names known to be built-in / already mapped.
 * These are never auto-bundled.
 */
const BUILTIN = new Set(['@webjsdev/core', '@webjsdev/core/', '@webjsdev/core/client-router']);

/**
 * Scan source files under `dir` for bare import specifiers reachable
 * from the browser. Returns a Set of package names.
 *
 * Excludes:
 *   - `node_modules`, `.webjs`, `public` directories
 *   - Any directory starting with `_` (webjs `_private/` convention)
 *   - `test/` and `tests/` (server-only by webjs convention)
 *   - Files whose name marks them as server-only:
 *       * `*.server.{js,ts,mjs,mts}` (path-level boundary)
 *       * `route.{js,ts,mjs,mts}` (file-router HTTP handler)
 *       * `middleware.{js,ts,mjs,mts}` (file-router middleware)
 *   - Any file whose first non-whitespace content is `'use server'`
 *   - `import type` statements (TypeScript erases them at compile time)
 *   - `import` strings inside `/* … *​/` block comments or `//` line comments
 *
 * @param {string} dir
 * @returns {Promise<Set<string>>}
 */
export async function scanBareImports(dir) {
  /** @type {Set<string>} */
  const found = new Set();
  await walk(dir, found);
  // Remove built-ins
  for (const b of BUILTIN) found.delete(b);
  return found;
}

/**
 * Extract the package name from a bare specifier.
 * `'dayjs'`             → `'dayjs'`
 * `'dayjs/locale/en'`   → `'dayjs'`
 * `'@tanstack/query'`   → `'@tanstack/query'`
 * `'@tanstack/query/x'` → `'@tanstack/query'`
 * `'./foo'`, `'../bar'`, `'/baz'` → `null` (relative/absolute)
 *
 * @param {string} spec
 * @returns {string | null}
 */
export function extractPackageName(spec) {
  if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('__')) return null;
  // Protocol URLs (http:, data:, blob:, etc.)
  if (/^[a-z]+:/.test(spec)) return null;
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  }
  return spec.split('/')[0];
}

// Matches `import { x } from 'pkg'`, `import 'pkg'`, `import * as x from 'pkg'`.
// The `(?!type\s)` negative lookahead skips `import type … from 'pkg'`
// because TypeScript type-only imports are fully erased at compile time
// and never reach the browser, so they must not enter the vendor pipeline.
const IMPORT_RE = /\bimport\s+(?!type\s)(?:(?:[\w*{}\s,]+)\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

// Strip `/* … */` block comments and `// …` line comments before running
// the import regex. Comments in source files (JSDoc examples especially)
// frequently contain `import 'foo'` snippets that aren't real imports;
// without stripping, the scanner picks them up as bare specifiers and
// the vendor pipeline tries (and fails) to bundle them.
const BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT_RE = /(^|[^:])\/\/.*$/gm;
function stripComments(src) {
  return src.replace(BLOCK_COMMENT_RE, '').replace(LINE_COMMENT_RE, '$1');
}

/**
 * Filename matches webjs's server-only file-router conventions.
 * Returns true for `route.{ts,js,mjs,mts}` and
 * `middleware.{ts,js,mjs,mts}`, plus any `.server.{ts,js,mjs,mts}`
 * suffix file. These files never reach the browser, so their bare
 * imports must not enter the vendor pipeline.
 *
 * @param {string} name  basename of the file
 */
function isServerOnlyFile(name) {
  if (/\.server\.(js|ts|mjs|mts)$/.test(name)) return true;
  if (/^route\.(js|ts|mjs|mts)$/.test(name)) return true;
  if (/^middleware\.(js|ts|mjs|mts)$/.test(name)) return true;
  return false;
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
    // Skip directories that never contain browser-reachable code.
    if (
      e.name === 'node_modules' ||
      e.name === '.webjs' ||
      e.name === 'public' ||
      e.name === 'test' ||
      e.name === 'tests' ||
      e.name.startsWith('_')
    ) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, found);
    } else if (/\.(js|ts|mjs|mts)$/.test(e.name) && !isServerOnlyFile(e.name)) {
      try {
        const raw = await readFile(full, 'utf8');
        // Skip files with 'use server' pragma (their exports never reach the browser).
        if (raw.trimStart().startsWith("'use server'") || raw.trimStart().startsWith('"use server"')) continue;
        const src = stripComments(raw);
        for (const m of src.matchAll(IMPORT_RE)) {
          const pkg = extractPackageName(m[1]);
          if (pkg) found.add(pkg);
        }
        for (const m of src.matchAll(DYNAMIC_IMPORT_RE)) {
          const pkg = extractPackageName(m[1]);
          if (pkg) found.add(pkg);
        }
      } catch { /* unreadable file */ }
    }
  }
}

/**
 * Resolve a package's actual directory on disk, handling both direct
 * installation and npm workspace hoisting. Returns null when the
 * package isn't resolvable from `appDir`.
 *
 * @param {string} pkgName
 * @param {string} appDir
 * @returns {string | null}
 */
function resolvePackageDir(pkgName, appDir) {
  try {
    const require = createRequire(join(appDir, 'package.json'));
    const entry = require.resolve(pkgName);
    const parts = entry.split(sep);
    const nmIdx = parts.lastIndexOf('node_modules');
    if (nmIdx < 0) {
      // Workspace-symlinked dep resolved to source location. Walk up
      // to find the package.json.
      let dir = dirname(entry);
      for (let i = 0; i < 8; i++) {
        if (existsSync(join(dir, 'package.json'))) return realpathSync(dir);
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return null;
    }
    const segmentsAfterNm = pkgName.startsWith('@') ? 2 : 1;
    const root = parts.slice(0, nmIdx + 1 + segmentsAfterNm).join(sep);
    return realpathSync(root);
  } catch {
    return null;
  }
}

/**
 * Read the installed version of a package from `node_modules/<pkg>/
 * package.json`. Handles workspace hoisting and packages that lock
 * down `./package.json` in their exports field (which break a naive
 * `require.resolve('<pkg>/package.json')`).
 *
 * @param {string} pkgName
 * @param {string} appDir
 * @returns {string | null}
 */
export function getPackageVersion(pkgName, appDir) {
  const real = resolvePackageDir(pkgName, appDir);
  if (!real) return null;
  try {
    const pkg = JSON.parse(readFileSync(join(real, 'package.json'), 'utf8'));
    return pkg.version || null;
  } catch {
    return null;
  }
}

/**
 * Bundle an npm package into a single ESM file for the browser.
 * Cache is keyed by `<pkgName>@<version>` so version bumps naturally
 * miss and re-bundle without colliding with the previous version's
 * bytes.
 *
 * @param {string} pkgName  e.g. `'dayjs'`
 * @param {string} version  installed version (e.g. `'1.11.13'`)
 * @param {string} appDir   app root for resolving node_modules
 * @param {boolean} dev
 * @returns {Promise<string | null>}  bundled JS source, or null if not found
 */
export async function bundlePackage(pkgName, version, appDir, dev) {
  const cacheKey = `${pkgName}@${version}`;
  const cached = vendorCache.get(cacheKey);
  if (cached) return cached;

  let build;
  try { ({ build } = await import('esbuild')); }
  catch { return null; }

  // Locate the package entry via Node resolution
  const require = createRequire(join(appDir, 'package.json'));
  let entryPoint;
  try {
    entryPoint = require.resolve(pkgName);
  } catch {
    return null;
  }

  try {
    const result = await build({
      entryPoints: [entryPoint],
      bundle: true,
      format: 'esm',
      target: 'es2022',
      platform: 'browser',
      write: false,
      minify: !dev,
      // External: don't bundle packages already in the import map
      external: [...BUILTIN],
    });
    const code = result.outputFiles[0].text;
    if (vendorCache.size >= VENDOR_CACHE_MAX) {
      const oldest = vendorCache.keys().next().value;
      vendorCache.delete(oldest);
    }
    vendorCache.set(cacheKey, code);
    return code;
  } catch (e) {
    // Build failed (native module, server-only dep, etc.): skip silently
    return null;
  }
}

/**
 * Build extra import map entries for discovered bare imports.
 *
 * URL shape: `/__webjs/vendor/<safe-name>@<version>.js`. Scoped
 * packages encode `/` as `--` (filesystem and URL safe, mirrors the
 * Rails 7 + importmap-rails vendor convention). Including the version
 * in the URL means browser caches invalidate automatically on every
 * version bump (no more stale-bundle bug after `npm install pkg@new`).
 *
 * Packages whose version can't be resolved from `appDir/node_modules/`
 * are skipped (no importmap entry emitted). The browser will surface
 * an "unresolved bare specifier" error at first import, which is the
 * right signal that the package isn't installed.
 *
 * @param {Set<string>} bareImports  from scanBareImports()
 * @param {string} appDir
 * @returns {Record<string, string>}
 */
export function vendorImportMapEntries(bareImports, appDir) {
  /** @type {Record<string, string>} */
  const entries = {};
  for (const pkg of bareImports) {
    if (BUILTIN.has(pkg)) continue;
    const version = getPackageVersion(pkg, appDir);
    if (!version) continue;
    const safeName = pkg.replace(/\//g, '--');
    entries[pkg] = `/__webjs/vendor/${safeName}@${version}.js`;
  }
  return entries;
}

/**
 * Parse a vendor URL id (the URL path segment after `/__webjs/vendor/`
 * with the trailing `.js` stripped) back into a `{ pkgName, version }`
 * pair. Inverse of `vendorImportMapEntries`'s URL generation.
 *
 * Examples:
 *   `dayjs@1.11.13`          → { pkgName: 'dayjs',           version: '1.11.13' }
 *   `@hotwired--turbo@8.0.0` → { pkgName: '@hotwired/turbo', version: '8.0.0' }
 *
 * Returns null for malformed ids (no `@<version>` segment).
 *
 * @param {string} id  URL path after `/__webjs/vendor/`, without `.js` suffix
 * @returns {{ pkgName: string, version: string } | null}
 */
export function parseVendorId(id) {
  const stem = id.endsWith('.js') ? id.slice(0, -3) : id;
  const atIdx = stem.lastIndexOf('@');
  if (atIdx <= 0) return null;
  const rawName = stem.slice(0, atIdx);
  const version = stem.slice(atIdx + 1);
  if (!version) return null;
  const pkgName = rawName.replace(/--/g, '/');
  return { pkgName, version };
}

/**
 * Clear the vendor cache (called on file-watcher rebuild so newly added
 * deps are picked up on next request).
 */
export function clearVendorCache() {
  vendorCache.clear();
}

/**
 * Serve a vendor bundle in response to a `/__webjs/vendor/<id>.js`
 * request. The id encodes both package name and version (see
 * `parseVendorId`). Malformed ids return 404. Cache headers use
 * `immutable` in production because the version baked into the URL
 * guarantees content addresses are stable: a new version means a new
 * URL, not a new payload behind the old URL.
 *
 * @param {string} id        URL path after `/__webjs/vendor/`, including `.js`
 * @param {string} appDir
 * @param {boolean} dev
 * @returns {Promise<Response>}
 */
export async function serveVendorBundle(id, appDir, dev) {
  const parsed = parseVendorId(id);
  if (!parsed) {
    return new Response(`/* malformed vendor id: ${id} */`, {
      status: 404,
      headers: { 'content-type': 'application/javascript; charset=utf-8' },
    });
  }
  const code = await bundlePackage(parsed.pkgName, parsed.version, appDir, dev);
  if (code == null) {
    return new Response(`/* vendor bundle failed for ${parsed.pkgName}@${parsed.version} */`, {
      status: 404,
      headers: { 'content-type': 'application/javascript; charset=utf-8' },
    });
  }
  return new Response(code, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': dev ? 'no-cache' : 'public, max-age=31536000, immutable',
    },
  });
}
