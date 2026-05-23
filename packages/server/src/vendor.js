/**
 * Resolve bare npm imports to browser-loadable URLs via jspm.io.
 *
 * webjs follows the Rails 7 + importmap-rails posture exactly. When user
 * code imports a bare specifier (e.g. `import dayjs from 'dayjs'`), the
 * browser can't resolve it natively. The framework's job is to emit an
 * importmap that translates each bare specifier to a real URL.
 *
 * The URL points at **jspm.io**, the same CDN Rails uses by default:
 *
 *   importmap: { "dayjs": "https://ga.jspm.io/npm:dayjs@1.11.13/index.js" }
 *
 * The browser fetches the bundle directly from jspm.io. The webjs server
 * does not proxy, cache, or bundle anything. jspm.io has done the work
 * server-side (CJS-to-ESM conversion, transitive bundling, browser
 * polyfills).
 *
 * Why jspm.io: institutional backing (37signals, CacheFly for CDN
 * infrastructure, Rails ecosystem dependency creates downstream pressure
 * for continued operation), status page at status.jspm.io, standards-
 * first maintenance by Guy Bedford (TC39 contributor on ESM and import
 * maps). Years of uptime track record.
 *
 * URL resolution: jspm.io's bare-package URL (without entry path)
 * returns metadata, not JavaScript. The correct entry file (e.g.,
 * `/dayjs.min.js`, `/index.js`) varies per package and must be
 * resolved from the JSPM Generator API. The Generator is called once
 * per server boot for the full set of bare imports; results are
 * cached in-memory for the process lifetime.
 *
 * Server boot connectivity: the Generator API call happens during
 * `setVendorEntries` at boot. If api.jspm.io is unreachable, the
 * importmap will be missing vendor entries and the browser will
 * report "unresolved bare specifier" errors. The server itself still
 * boots and serves user routes; only vendor-importing pages break
 * until api.jspm.io is reachable again. Failure is loud and clear.
 *
 * No local bundler. No disk cache. No memory cache of bundle bytes.
 * Matches Rails' "no build" posture literally.
 */

import { readFile, readdir } from 'node:fs/promises';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { createRequire } from 'node:module';

/**
 * Set of package names known to be framework-internal (served per-file
 * via /__webjs/core/ handler in dev.js, not via the vendor pipeline).
 * These never enter the importmap as vendor entries.
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
// and never reach the browser.
const IMPORT_RE = /\bimport\s+(?!type\s)(?:(?:[\w*{}\s,]+)\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

const BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT_RE = /(^|[^:])\/\/.*$/gm;
function stripComments(src) {
  return src.replace(BLOCK_COMMENT_RE, '').replace(LINE_COMMENT_RE, '$1');
}

/**
 * Filename matches webjs's server-only file-router conventions.
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
 * Resolve a package's installed directory on disk, handling both direct
 * installation and npm workspace hoisting.
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
 * down `./package.json` in their exports field.
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

// ---------------------------------------------------------------------------
// JSPM Generator API client
// ---------------------------------------------------------------------------

/**
 * In-memory cache of resolved importmap fragments from api.jspm.io.
 * Keyed by the sorted+joined list of `pkg@version` install specs.
 * Per-process; cleared by `clearVendorCache` on file-watcher rebuild
 * so new versions get re-resolved.
 *
 * @type {Map<string, Record<string, string>>}
 */
const jspmCache = new Map();

const JSPM_GENERATE_ENDPOINT = 'https://api.jspm.io/generate';
const JSPM_GENERATE_TIMEOUT_MS = 10_000;

/**
 * Call api.jspm.io/generate to resolve a list of `pkg@version` installs
 * into a fully-formed importmap fragment. Returns the importmap's
 * `imports` map.
 *
 * Cached in-process by the exact install-list cache key. A rebuild
 * (via clearVendorCache) drops the cache so version bumps get
 * re-resolved on next boot.
 *
 * If the API call fails (network down, jspm.io 5xx, timeout), logs
 * the failure and returns an empty map. The server still boots and
 * serves user routes; vendor-importing pages get an "unresolved bare
 * specifier" error in the browser until the API is reachable again.
 *
 * @param {Array<string>} installs  e.g. ['dayjs@1.11.13', '@hotwired/turbo@8.0.0']
 * @returns {Promise<Record<string, string>>}
 */
export async function jspmGenerate(installs) {
  if (installs.length === 0) return {};
  const cacheKey = [...installs].sort().join('\n');
  if (jspmCache.has(cacheKey)) return jspmCache.get(cacheKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JSPM_GENERATE_TIMEOUT_MS);
  try {
    const response = await fetch(JSPM_GENERATE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        install: installs,
        env: ['browser', 'production', 'module'],
        provider: 'jspm.io',
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(
        `[webjs] api.jspm.io/generate returned ${response.status}. ` +
        `Vendor packages will not be resolved until api.jspm.io is reachable.`,
      );
      return {};
    }
    const result = await response.json();
    const imports = (result && result.map && result.map.imports) || {};
    jspmCache.set(cacheKey, imports);
    return imports;
  } catch (e) {
    const msg = e && e.name === 'AbortError'
      ? `api.jspm.io/generate timed out after ${JSPM_GENERATE_TIMEOUT_MS}ms`
      : `api.jspm.io/generate failed: ${e && e.message}`;
    console.error(`[webjs] ${msg}. Vendor packages will not be resolved.`);
    return {};
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build importmap entries for discovered bare imports. For each scanned
 * package, resolve its installed version from node_modules, then ask
 * api.jspm.io/generate for the full importmap fragment.
 *
 * Async because the Generator API call is networked. Called from
 * `setVendorEntries` during server boot and rebuild; not per request.
 *
 * @param {Set<string>} bareImports  from scanBareImports()
 * @param {string} appDir
 * @returns {Promise<Record<string, string>>}
 */
export async function vendorImportMapEntries(bareImports, appDir) {
  const installs = [];
  for (const pkg of bareImports) {
    if (BUILTIN.has(pkg)) continue;
    const version = getPackageVersion(pkg, appDir);
    if (!version) continue;
    installs.push(`${pkg}@${version}`);
  }
  return jspmGenerate(installs);
}

/**
 * Clear the resolved-importmap cache. Called on file-watcher rebuild
 * so newly-added bare imports trigger a fresh api.jspm.io/generate
 * call on the next request to populate the in-memory cache.
 */
export function clearVendorCache() {
  jspmCache.clear();
}
