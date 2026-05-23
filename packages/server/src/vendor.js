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
import { join, extname, sep } from 'node:path';
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
 * Bundle an npm package into a single ESM file for the browser.
 *
 * @param {string} pkgName  e.g. `'dayjs'`
 * @param {string} appDir   app root for resolving node_modules
 * @param {boolean} dev
 * @returns {Promise<string | null>}  bundled JS source, or null if not found
 */
export async function bundlePackage(pkgName, appDir, dev) {
  const cached = vendorCache.get(pkgName);
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
    vendorCache.set(pkgName, code);
    return code;
  } catch (e) {
    // Build failed (native module, server-only dep, etc.): skip silently
    return null;
  }
}

/**
 * Build extra import map entries for discovered bare imports.
 *
 * @param {Set<string>} bareImports  from scanBareImports()
 * @returns {Record<string, string>}
 */
export function vendorImportMapEntries(bareImports) {
  /** @type {Record<string, string>} */
  const entries = {};
  for (const pkg of bareImports) {
    if (BUILTIN.has(pkg)) continue;
    entries[pkg] = `/__webjs/vendor/${encodeURIComponent(pkg)}.js`;
  }
  return entries;
}

/**
 * Clear the vendor cache (called on file-watcher rebuild so newly added
 * deps are picked up on next request).
 */
export function clearVendorCache() {
  vendorCache.clear();
}

/**
 * Serve a vendor bundle for the given package name.
 *
 * @param {string} pkgName
 * @param {string} appDir
 * @param {boolean} dev
 * @returns {Promise<Response>}
 */
export async function serveVendorBundle(pkgName, appDir, dev) {
  const code = await bundlePackage(pkgName, appDir, dev);
  if (code == null) {
    return new Response(`/* vendor bundle failed for ${pkgName} */`, {
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
