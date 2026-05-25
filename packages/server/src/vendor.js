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

import { readFile, readdir, writeFile, mkdir, unlink, stat } from 'node:fs/promises';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname, basename, sep } from 'node:path';
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
 * Tooling config files at any depth. They import test runners, build
 * helpers, AI plugins etc. that legitimately cannot resolve through
 * jspm.io (e.g. `@web/test-runner-playwright` pulls in `playwright-core`
 * with subpaths jspm.io can't bundle). Their bare imports must never
 * reach the importmap.
 */
const CONFIG_FILE_RE = /\.config\.(js|ts|mjs|mts|cjs|cts)$/;

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
      e.name.startsWith('_') ||
      // Skip ALL dot-prefixed dirs (.opencode, .claude, .github, .husky,
      // .git, .vscode, .idea, .cursor, …). They hold tooling / IDE /
      // agent state that imports packages the browser will never load
      // (e.g. `@opencode-ai/plugin`). The walker visits dirs and files
      // separately; this guard only fires for directory entries because
      // dot-prefixed *files* (e.g. `.env.d.ts` someday) still need the
      // extension check below.
      (e.isDirectory() && e.name.startsWith('.'))
    ) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, found);
    } else if (/\.(js|ts|mjs|mts)$/.test(e.name) && !isServerOnlyFile(e.name) && !CONFIG_FILE_RE.test(e.name)) {
      try {
        const raw = await readFile(full, 'utf8');
        if (raw.trimStart().startsWith("'use server'") || raw.trimStart().startsWith('"use server"')) continue;
        const src = stripComments(raw);
        // We keep the FULL specifier (with subpath), not just the package
        // name. `import 'dayjs/plugin/utc'` adds `'dayjs/plugin/utc'` to the
        // set, not just `'dayjs'`. vendorImportMapEntries needs the
        // subpath to emit a per-specifier importmap entry; jspm.io
        // resolves each subpath independently via the package's `exports`
        // field. extractPackageName is still applied to filter out
        // relative / absolute / protocol-URL specifiers.
        for (const m of src.matchAll(IMPORT_RE)) {
          if (extractPackageName(m[1])) found.add(m[1]);
        }
        for (const m of src.matchAll(DYNAMIC_IMPORT_RE)) {
          if (extractPackageName(m[1])) found.add(m[1]);
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

  // Cache pending Promises, not just resolved values. Two concurrent
  // callers with the same install list share the in-flight request
  // (only one HTTP round trip to api.jspm.io). Without this, two
  // simultaneous rebuilds during dev (chokidar firing twice in quick
  // succession) would each issue their own jspm.io request.
  const existing = jspmCache.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
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
        // Drop the failed Promise from the cache so the next call
        // retries instead of returning {} forever.
        jspmCache.delete(cacheKey);
        return {};
      }
      const result = await response.json();
      const imports = (result && result.map && result.map.imports) || {};
      return imports;
    } catch (e) {
      const msg = e && e.name === 'AbortError'
        ? `api.jspm.io/generate timed out after ${JSPM_GENERATE_TIMEOUT_MS}ms`
        : `api.jspm.io/generate failed: ${e && e.message}`;
      console.error(`[webjs] ${msg}. Vendor packages will not be resolved.`);
      // Same: drop the failed Promise so retries work.
      jspmCache.delete(cacheKey);
      return {};
    } finally {
      clearTimeout(timer);
    }
  })();

  jspmCache.set(cacheKey, promise);
  return promise;
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
  for (const spec of bareImports) {
    if (BUILTIN.has(spec)) continue;
    const pkg = extractPackageName(spec);
    if (!pkg || BUILTIN.has(pkg)) continue;
    const version = getPackageVersion(pkg, appDir);
    if (!version) continue;
    // Splice the version into the specifier: 'dayjs/plugin/utc' with
    // version 1.11.13 becomes 'dayjs@1.11.13/plugin/utc'. jspm.io's
    // Generator API resolves subpaths individually via the package's
    // `exports` field. Root imports stay as `<pkg>@<version>` with no
    // trailing subpath.
    const subpath = spec.slice(pkg.length);
    installs.push(`${pkg}@${version}${subpath}`);
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

// ---------------------------------------------------------------------------
// File-based pin (.webjs/vendor/importmap.json, optional --download bundles)
// ---------------------------------------------------------------------------

const PIN_DIR_REL = ['.webjs', 'vendor'];
const PIN_FILE = 'importmap.json';

/** Compute the absolute path of the pin directory for an app. */
function pinDir(appDir) {
  return join(appDir, ...PIN_DIR_REL);
}

/** Compute the absolute path of the importmap config file for an app. */
function pinFilePath(appDir) {
  return join(pinDir(appDir), PIN_FILE);
}

/**
 * Filesystem-safe filename for a downloaded bundle. Encodes the full
 * specifier (which may include a subpath) into a flat filename:
 *
 *   bundleFilename('dayjs', '1.11.13', '')             → 'dayjs@1.11.13.js'
 *   bundleFilename('dayjs', '1.11.13', '/plugin/utc')  → 'dayjs@1.11.13__plugin__utc.js'
 *   bundleFilename('@hotwired/turbo', '8.0.0', '')     → '@hotwired--turbo@8.0.0.js'
 *
 * Scoped names use `--` to encode `/`; subpath separators use `__`.
 * Both are reversible round-trip so unpin / list can parse the
 * package + version + subpath back from the filename.
 */
function bundleFilenameWithSubpath(pkgName, version, subpath) {
  const safeName = pkgName.replace(/\//g, '--');
  const safeSubpath = subpath.replace(/\//g, '__');
  return `${safeName}@${version}${safeSubpath}.js`;
}

/** Backwards-compatible alias for root-package bundle filenames. */
function bundleFilename(pkgName, version) {
  const safeName = pkgName.replace(/\//g, '--');
  return `${safeName}@${version}.js`;
}

/**
 * Read the committed pin importmap if one exists. Returns the parsed
 * `{ imports: Record<string, string> }` shape or null if no pin file.
 *
 * @param {string} appDir
 * @returns {Promise<{ imports: Record<string, string> } | null>}
 */
export async function readPinFile(appDir) {
  try {
    const raw = await readFile(pinFilePath(appDir), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && parsed.imports && typeof parsed.imports === 'object') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write the pin importmap to `.webjs/vendor/importmap.json`. Ensures
 * the directory exists. Pretty-printed for human-reviewable diffs.
 *
 * @param {string} appDir
 * @param {Record<string, string>} imports
 */
async function writePinFile(appDir, imports) {
  await mkdir(pinDir(appDir), { recursive: true });
  const body = JSON.stringify({ imports }, null, 2) + '\n';
  await writeFile(pinFilePath(appDir), body, 'utf8');
}

/**
 * Download a single jspm.io URL and write the body to
 * `.webjs/vendor/<filename>`. Returns the number of bytes written, or
 * null on failure.
 *
 * @param {string} url
 * @param {string} appDir
 * @param {string} filename
 * @returns {Promise<number | null>}
 */
async function downloadBundle(url, appDir, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[webjs] download ${url} returned ${response.status}`);
      return null;
    }
    const body = await response.text();
    await mkdir(pinDir(appDir), { recursive: true });
    await writeFile(join(pinDir(appDir), filename), body, 'utf8');
    return body.length;
  } catch (e) {
    console.error(`[webjs] download ${url} failed: ${e && e.message}`);
    return null;
  }
}

/**
 * After writing the new pin output, delete any file in the pin
 * directory that doesn't belong. Handles three orphan scenarios
 * uniformly: version-bump leftovers, removed packages, and mode
 * switches (default <-> download).
 *
 * @param {string} appDir
 * @param {Set<string>} expected  filenames that should remain
 * @returns {Promise<string[]>}   list of pruned filenames
 */
async function pruneOrphans(appDir, expected) {
  const dir = pinDir(appDir);
  let files;
  try { files = await readdir(dir); } catch { return []; }
  const pruned = [];
  for (const f of files) {
    if (expected.has(f)) continue;
    try {
      await unlink(join(dir, f));
      pruned.push(f);
    } catch { /* race or permission; ignore */ }
  }
  return pruned;
}

/**
 * Pin all currently-imported npm packages to `.webjs/vendor/
 * importmap.json`. Two modes:
 *
 *   - Default: importmap URLs point at jspm.io (browser fetches from
 *     CDN directly at runtime). Only `importmap.json` is committed.
 *   - `download: true`: also fetches each bundle from jspm.io and
 *     writes it to `.webjs/vendor/<pkg>@<version>.js`. importmap URLs
 *     become local paths (`/__webjs/vendor/<filename>`), and the
 *     server handler serves them from disk. Both `importmap.json` and
 *     the bundle files are committed to source control.
 *
 * After pinning, prunes any orphan file in `.webjs/vendor/` not
 * produced by the current run. Pin is idempotent with respect to the
 * current source + node_modules: removed packages, bumped versions,
 * and mode switches all leave a clean directory.
 *
 * @param {string} appDir
 * @param {{ download?: boolean }} [opts]
 * @returns {Promise<{
 *   pins: Array<{ pkg: string, version: string, url: string, bytes?: number }>,
 *   pruned: string[],
 *   downloaded: number,
 * }>}
 */
export async function pinAll(appDir, opts = {}) {
  const download = !!opts.download;
  const bare = await scanBareImports(appDir);
  const installs = [];
  /**
   * Map from install spec (`pkg@version<subpath>`) to its components,
   * so we can recover the pkg + version + subpath when iterating jspm.io's
   * resolved imports.
   * @type {Map<string, { pkg: string, version: string, subpath: string }>}
   */
  const partsByInstall = new Map();
  for (const spec of bare) {
    if (BUILTIN.has(spec)) continue;
    const pkg = extractPackageName(spec);
    if (!pkg || BUILTIN.has(pkg)) continue;
    const version = getPackageVersion(pkg, appDir);
    if (!version) continue;
    const subpath = spec.slice(pkg.length);
    const install = `${pkg}@${version}${subpath}`;
    installs.push(install);
    partsByInstall.set(spec, { pkg, version, subpath });
  }
  const resolved = await jspmGenerate(installs);

  /** @type {Record<string, string>} */
  const importmap = {};
  /** @type {Array<{ pkg: string, version: string, url: string, bytes?: number }>} */
  const pins = [];
  const expected = new Set([PIN_FILE]);
  let downloaded = 0;

  for (const [spec, jspmUrl] of Object.entries(resolved)) {
    const parts = partsByInstall.get(spec);
    if (!parts) continue;
    const { pkg, version, subpath } = parts;
    if (download) {
      const filename = bundleFilenameWithSubpath(pkg, version, subpath);
      const bytes = await downloadBundle(jspmUrl, appDir, filename);
      if (bytes == null) continue;
      importmap[spec] = `/__webjs/vendor/${filename}`;
      expected.add(filename);
      pins.push({ pkg: spec, version, url: importmap[spec], bytes });
      downloaded++;
    } else {
      importmap[spec] = jspmUrl;
      pins.push({ pkg: spec, version, url: jspmUrl });
    }
  }

  await writePinFile(appDir, importmap);
  const pruned = await pruneOrphans(appDir, expected);
  return { pins, pruned, downloaded };
}

/**
 * Remove a single package from the committed pin output. Deletes the
 * package's entry from `importmap.json`, and (if a bundle file
 * exists for it) deletes that file too.
 *
 * @param {string} appDir
 * @param {string} pkg
 * @returns {Promise<{ removed: boolean, deletedFile?: string }>}
 */
export async function unpinPackage(appDir, pkg) {
  const file = await readPinFile(appDir);
  if (!file || !(pkg in file.imports)) return { removed: false };
  const url = file.imports[pkg];
  delete file.imports[pkg];
  await writePinFile(appDir, file.imports);

  let deletedFile;
  if (url.startsWith('/__webjs/vendor/')) {
    const filename = url.slice('/__webjs/vendor/'.length);
    try {
      await unlink(join(pinDir(appDir), filename));
      deletedFile = filename;
    } catch { /* file already gone; ignore */ }
  }
  return { removed: true, deletedFile };
}

/**
 * List entries from the committed pin file. Parses the package
 * version from the URL (jspm.io URL or the local file's @version).
 *
 * @param {string} appDir
 * @returns {Promise<Array<{ pkg: string, version: string, url: string, bytes?: number }>>}
 */
export async function listPinned(appDir) {
  const file = await readPinFile(appDir);
  if (!file) return [];
  const entries = [];
  for (const [pkg, url] of Object.entries(file.imports)) {
    let version = '(unknown)';
    let bytes;
    const jspmMatch = /\/npm:[^@]+@([^/]+)\//.exec(url);
    if (jspmMatch) {
      version = jspmMatch[1];
    } else if (url.startsWith('/__webjs/vendor/')) {
      const filename = url.slice('/__webjs/vendor/'.length);
      const atIdx = filename.lastIndexOf('@');
      if (atIdx > 0) {
        // Strip trailing `.js`, split off any `__subpath` segment, keep
        // only the version. `dayjs@1.11.13__plugin__utc.js` parses as
        // version `1.11.13` (not `1.11.13__plugin__utc`).
        const afterAt = filename.slice(atIdx + 1, -3);
        const subIdx = afterAt.indexOf('__');
        version = subIdx < 0 ? afterAt : afterAt.slice(0, subIdx);
      }
      try {
        const st = await stat(join(pinDir(appDir), filename));
        bytes = st.size;
      } catch { /* file missing; bytes stays undefined */ }
    }
    entries.push({ pkg, version, url, bytes });
  }
  return entries;
}

/**
 * Resolve the vendor importmap fragment for runtime use. Prefers the
 * committed pin file over a live api.jspm.io call. Called by dev.js
 * at server boot.
 *
 * Order of preference:
 *   1. `.webjs/vendor/importmap.json` (committed; no network needed)
 *   2. Live api.jspm.io/generate (fallback when no pin file exists)
 *
 * @param {Set<string>} bareImports
 * @param {string} appDir
 * @returns {Promise<Record<string, string>>}
 */
export async function resolveVendorImports(bareImports, appDir) {
  const file = await readPinFile(appDir);
  if (file) return file.imports;
  return vendorImportMapEntries(bareImports, appDir);
}

/**
 * Serve a downloaded vendor bundle from `.webjs/vendor/<filename>`.
 * Called by dev.js when the importmap contains `/__webjs/vendor/`
 * paths (i.e. user ran `webjs vendor pin --download`).
 *
 * @param {string} filename  e.g. `'dayjs@1.11.13.js'`
 * @param {string} appDir
 * @param {boolean} dev
 * @returns {Promise<Response>}
 */
export async function serveDownloadedBundle(filename, appDir, dev) {
  if (!filename.endsWith('.js') || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return new Response(`/* invalid vendor filename: ${filename} */`, {
      status: 400,
      headers: { 'content-type': 'application/javascript; charset=utf-8' },
    });
  }
  try {
    const body = await readFile(join(pinDir(appDir), filename), 'utf8');
    return new Response(body, {
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': dev ? 'no-cache' : 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response(`/* vendor bundle not found: ${filename}. Run webjs vendor pin --download */`, {
      status: 404,
      headers: { 'content-type': 'application/javascript; charset=utf-8' },
    });
  }
}
