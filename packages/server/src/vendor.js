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

import { readFile, readdir, writeFile, mkdir, unlink, stat, rename } from 'node:fs/promises';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname, basename, sep } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

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
 * Resolve a SINGLE `pkg@version` (or `pkg@version/subpath`) install via
 * api.jspm.io/generate. Returns the imports fragment (typically one or
 * two entries; subpath installs sometimes include the root package).
 *
 * Per-package isolation is the whole point: api.jspm.io/generate fails
 * the ENTIRE batch with a 401 when any single package can't be
 * resolved (e.g. a transitive that has no jspm.io-compatible exports).
 * Calling per-package means one bad dep can no longer poison the
 * importmap for legitimate deps.
 *
 * Cached in-process by the install spec. Failures are logged loudly
 * with the package name and the reason jspm.io returned.
 *
 * @param {string} install  e.g. 'dayjs@1.11.13' or 'dayjs@1.11.13/plugin/utc'
 * @returns {Promise<Record<string, string>>}
 */
async function jspmResolveOne(install) {
  const existing = jspmCache.get(install);
  if (existing) return existing;

  const promise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), JSPM_GENERATE_TIMEOUT_MS);
    try {
      const response = await fetch(JSPM_GENERATE_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          install: [install],
          // flattenScope:true merges transitive ESM deps into the
          // flat `imports` map instead of returning them in a
          // separate `scopes` field. Webjs only consumes `imports`
          // (the importmap output doesn't carry `scopes`), so
          // without this any package with an unbundled ESM
          // transitive (e.g. react-dom imports `scheduler`)
          // would break in the browser with an unresolved-bare-
          // specifier error. Matches importmap-rails's posture.
          flattenScope: true,
          env: ['browser', 'production', 'module'],
          provider: 'jspm.io',
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        // jspm.io returns the error reason in the body with a 401 (its
        // quirk: 401 is what it sends for unresolvable installs, not
        // auth failures). Surface it so the user sees WHICH dep failed
        // and why, not just a generic "vendor pipeline broken".
        let detail = '';
        try {
          const body = await response.json();
          if (body && typeof body.error === 'string') detail = `: ${body.error}`;
        } catch { /* non-JSON body */ }
        console.error(
          `[webjs] could not vendor '${install}' via jspm.io (status ${response.status})${detail}`,
        );
        jspmCache.delete(install);
        return {};
      }
      const result = await response.json();
      return (result && result.map && result.map.imports) || {};
    } catch (e) {
      const msg = e && e.name === 'AbortError'
        ? `timed out after ${JSPM_GENERATE_TIMEOUT_MS}ms`
        : `${e && e.message}`;
      console.error(`[webjs] could not vendor '${install}' via jspm.io: ${msg}`);
      jspmCache.delete(install);
      return {};
    } finally {
      clearTimeout(timer);
    }
  })();

  jspmCache.set(install, promise);
  return promise;
}

/**
 * Resolve a list of `pkg@version` installs to importmap entries by
 * calling api.jspm.io/generate ONCE PER INSTALL in parallel. Per-package
 * isolation prevents one bad dep from collapsing the whole importmap
 * (see jspmResolveOne for the rationale).
 *
 * The merge is last-write-wins per key. In practice subpath installs
 * never collide with each other (their keys include the subpath), and
 * the bare-package install for `dayjs` always produces the same root
 * URL as `dayjs@x.y.z/plugin/foo`'s incidental `dayjs` entry.
 *
 * @param {Array<string>} installs  e.g. ['dayjs@1.11.13', 'clsx@2.1.1']
 * @returns {Promise<Record<string, string>>}
 */
export async function jspmGenerate(installs) {
  if (installs.length === 0) return {};
  const perPackage = await Promise.all(installs.map(jspmResolveOne));
  const merged = {};
  for (const fragment of perPackage) Object.assign(merged, fragment);
  return merged;
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
 *   bundleFilenameWithSubpath('dayjs', '1.11.13', '')             returns 'dayjs@1.11.13.js'
 *   bundleFilenameWithSubpath('dayjs', '1.11.13', '/plugin/utc')  returns 'dayjs@1.11.13__plugin__utc.js'
 *   bundleFilenameWithSubpath('@hotwired/turbo', '8.0.0', '')     returns '@hotwired--turbo@8.0.0.js'
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

/**
 * Compute the SHA-384 SRI hash for a bundle body. Matches the format
 * the browser's importmap `integrity` field and the `integrity`
 * attribute on `<link rel="modulepreload">` expect.
 *
 * @param {string | Buffer} body
 * @returns {string}  e.g. `sha384-<base64>`
 */
export function sha384Integrity(body) {
  const digest = createHash('sha384').update(body).digest('base64');
  return `sha384-${digest}`;
}

/**
 * Read the committed pin importmap if one exists. Returns the parsed
 * `{ imports, integrity? }` shape or null if no pin file. The
 * `integrity` field is optional: pin files written before SRI support
 * lack it; pin files written by `webjs vendor pin` (current version)
 * include it.
 *
 * @param {string} appDir
 * @returns {Promise<{ imports: Record<string, string>, integrity?: Record<string, string> } | null>}
 */
export async function readPinFile(appDir) {
  try {
    const raw = await readFile(pinFilePath(appDir), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.imports !== 'object' || Array.isArray(parsed.imports)) {
      return null;
    }
    // Validate every imports entry. Drop:
    // - non-string keys/values (numbers, nulls, objects from malformed
    //   hand-edits would otherwise land structurally-invalid entries in
    //   the served importmap and break the browser parser);
    // - keys containing newlines or other control chars (they would
    //   serialize to escape sequences in JSON and confuse downstream
    //   diffing logic);
    // - values whose URL scheme isn't `http(s)://` or a path starting
    //   with `/` (relative to the app's origin). `javascript:` and
    //   `data:` URLs in a malicious pin file would otherwise be
    //   accepted by the browser's importmap parser and let an attacker
    //   ship code via a single-line pin diff. Tightest acceptable
    //   set: matches what `webjs vendor pin` itself produces
    //   (`https://ga.jspm.io/...` or `/__webjs/vendor/...`).
    /** @type {Record<string, string>} */
    const cleanImports = {};
    for (const [k, v] of Object.entries(parsed.imports)) {
      if (typeof k !== 'string' || typeof v !== 'string') continue;
      if (/[\x00-\x1f\x7f]/.test(k)) continue;
      // Require a non-slash byte after the scheme prefix so a
      // hand-edited or tampered pin file cannot smuggle a
      // protocol-relative URL like `//attacker.tld/x.js` past the
      // filter. Browsers resolve `//host/path` against the document
      // origin and would happily fetch attacker-controlled code if
      // the importmap accepted it. The framework itself only writes
      // `https://ga.jspm.io/...` or `/__webjs/vendor/...`, which both
      // satisfy the tighter form.
      if (!/^(?:https?:\/\/[^/]|\/[^/])/.test(v)) continue;
      cleanImports[k] = v;
    }
    if (Object.keys(cleanImports).length === 0) return null;

    /** @type {Record<string, string>} */
    const cleanIntegrity = {};
    if (parsed.integrity && typeof parsed.integrity === 'object' && !Array.isArray(parsed.integrity)) {
      for (const [k, v] of Object.entries(parsed.integrity)) {
        // Integrity values must look like SRI hashes end-to-end
        // (`sha(256|384|512)-<base64>`). Anchor the regex on both
        // ends and constrain the body to the base64 alphabet so a
        // hand-edited or tampered pin file can't slip an attribute
        // injection (e.g. `sha384-x"><script>`) past the prefix
        // check and through to `integrity="..."` emission in ssr.js
        // unescaped.
        if (typeof k === 'string' && typeof v === 'string' && /^sha(256|384|512)-[A-Za-z0-9+/=]+$/.test(v)) {
          cleanIntegrity[k] = v;
        }
      }
    }
    const out = { imports: cleanImports };
    if (Object.keys(cleanIntegrity).length) out.integrity = cleanIntegrity;
    return out;
  } catch {
    return null;
  }
}

/**
 * Write the pin importmap to `.webjs/vendor/importmap.json`. Ensures
 * the directory exists. Pretty-printed for human-reviewable diffs.
 *
 * When `integrity` is provided and non-empty, it's included alongside
 * `imports` as a sibling key (matching the browser importmap-integrity
 * spec: a flat `{url: 'sha384-...'}` map). Omitted entirely when empty
 * so older webjs versions read the file as before.
 *
 * @param {string} appDir
 * @param {Record<string, string>} imports
 * @param {Record<string, string>} [integrity]
 */
async function writePinFile(appDir, imports, integrity) {
  await mkdir(pinDir(appDir), { recursive: true });
  const payload = integrity && Object.keys(integrity).length
    ? { imports, integrity }
    : { imports };
  const body = JSON.stringify(payload, null, 2) + '\n';
  // Atomic write: stage into a sibling tmp file, then rename onto the
  // final path. Rename within the same directory is atomic on POSIX
  // and on Windows since Node 14+, so a crash mid-write can leave the
  // tmp file as garbage but cannot corrupt the live pin file. Without
  // this, a partially-written importmap.json round-trips through
  // readPinFile as null (fail-closed) but still requires the user to
  // notice and rerun pin; the rename keeps the live file intact across
  // every failure mode.
  const finalPath = pinFilePath(appDir);
  const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, body, 'utf8');
  await rename(tmpPath, finalPath);
}

/**
 * Download a single jspm.io URL and write the body to
 * `.webjs/vendor/<filename>`. Returns `{ bytes, integrity }` on
 * success or null on failure. The integrity hash is computed from the
 * downloaded bytes so it's always consistent with what's on disk.
 *
 * @param {string} url
 * @param {string} appDir
 * @param {string} filename
 * @returns {Promise<{ bytes: number, integrity: string } | null>}
 */
async function downloadBundle(url, appDir, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[webjs] download ${url} returned ${response.status}`);
      return null;
    }
    // Hash raw response bytes, not the UTF-8 decoded string. The
    // browser's SRI implementation hashes the raw body bytes; if we
    // hashed `.text()` here we'd risk encoding round-trip drift on
    // any byte sequence the decode-then-re-encode pipeline doesn't
    // round-trip exactly. arrayBuffer + Buffer.from gives us the
    // same primitive the browser uses.
    const buf = Buffer.from(await response.arrayBuffer());
    await mkdir(pinDir(appDir), { recursive: true });
    await writeFile(join(pinDir(appDir), filename), buf);
    return { bytes: buf.byteLength, integrity: sha384Integrity(buf) };
  } catch (e) {
    console.error(`[webjs] download ${url} failed: ${e && e.message}`);
    return null;
  }
}

/**
 * Fetch a jspm.io URL just to compute its SHA-384 hash, without
 * writing anything to disk. Used by `webjs vendor pin` (default mode)
 * so the importmap can carry SRI hashes even when bundles aren't
 * locally vendored.
 *
 * @param {string} url
 * @returns {Promise<string | null>}  the integrity string, or null on failure
 */
async function fetchIntegrity(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[webjs] hash ${url} returned ${response.status}`);
      return null;
    }
    // Hash raw response bytes so the integrity matches what the
    // browser computes when fetching the same URL. See the
    // matching comment in downloadBundle.
    const buf = Buffer.from(await response.arrayBuffer());
    return sha384Integrity(buf);
  } catch (e) {
    console.error(`[webjs] hash ${url} failed: ${e && e.message}`);
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
 * On success (at least one install resolved), returns
 * `{ pins, pruned, downloaded }`. On total failure (one or more
 * installs were attempted but every jspm.io resolution failed), the
 * pin file is NOT written and the function returns
 * `{ pins: [], pruned: [], downloaded: 0, failed: true, attemptedInstalls }`
 * instead. Callers that need to surface a non-zero exit code key off
 * `failed`; the field is absent on the success path.
 *
 * @param {string} appDir
 * @param {{ download?: boolean }} [opts]
 * @returns {Promise<{
 *   pins: Array<{ pkg: string, version: string, url: string, bytes?: number, integrity?: string }>,
 *   pruned: string[],
 *   downloaded: number,
 *   failed?: boolean,
 *   attemptedInstalls?: string[],
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
  /**
   * SRI integrity by FINAL URL (post-rewrite). The browser's
   * importmap-integrity spec keys on the URL that appears in the
   * importmap, not the source jspm.io URL. For default mode the two
   * are identical; for --download mode the URL is the local
   * /__webjs/vendor/<filename> path.
   * @type {Record<string, string>}
   */
  const integrity = {};
  /** @type {Array<{ pkg: string, version: string, url: string, bytes?: number, integrity?: string }>} */
  const pins = [];
  const expected = new Set([PIN_FILE]);
  let downloaded = 0;

  for (const [spec, jspmUrl] of Object.entries(resolved)) {
    const parts = partsByInstall.get(spec);
    if (!parts) continue;
    const { pkg, version, subpath } = parts;
    if (download) {
      const filename = bundleFilenameWithSubpath(pkg, version, subpath);
      const result = await downloadBundle(jspmUrl, appDir, filename);
      if (result == null) continue;
      const localUrl = `/__webjs/vendor/${filename}`;
      importmap[spec] = localUrl;
      integrity[localUrl] = result.integrity;
      expected.add(filename);
      pins.push({ pkg: spec, version, url: localUrl, bytes: result.bytes, integrity: result.integrity });
      downloaded++;
    } else {
      importmap[spec] = jspmUrl;
      // Fetch the bundle just to hash it. Bytes aren't written to
      // disk; only the SHA-384 reaches the pin file. CDN compromise
      // defense for default mode: if jspm.io serves different bytes
      // later, the browser refuses to execute (integrity mismatch).
      const sri = await fetchIntegrity(jspmUrl);
      if (sri) integrity[jspmUrl] = sri;
      pins.push({ pkg: spec, version, url: jspmUrl, integrity: sri || undefined });
    }
  }

  // If pin was attempted (installs non-empty) but resolved zero, do
  // NOT write the pin file. Writing `{ imports: {} }` would shadow
  // the live-API fallback (which reads when no pin file exists) and
  // leave the browser with an empty importmap, silently breaking
  // every bare-specifier import. Better: surface the failure so the
  // user knows pin didn't take, and let the next boot fall back to
  // live API resolution (which may have recovered by then).
  if (installs.length > 0 && pins.length === 0) {
    return { pins, pruned: [], downloaded, failed: true, attemptedInstalls: installs };
  }

  await writePinFile(appDir, importmap, integrity);
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
  // Also strip the integrity entry for this URL, if present.
  const newIntegrity = { ...(file.integrity || {}) };
  delete newIntegrity[url];
  if (Object.keys(file.imports).length === 0) {
    // The pin file would now be empty. Delete it so the next boot
    // falls back to live API resolution rather than seeing an empty
    // importmap. Same reasoning as pinAll's "don't write empty pin"
    // guard.
    try { await unlink(pinFilePath(appDir)); } catch { /* race or never existed */ }
  } else {
    await writePinFile(appDir, file.imports, newIntegrity);
  }

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
    // Match `/npm:<pkg>@<version>/...`. The non-capturing `(?:@[^/]+\/)?`
    // consumes an optional scope prefix (`@scope/`) so the second
    // `@<version>` is what we capture. Without it, scoped packages
    // (e.g. `/npm:@scope/name@1.2.3/`) would silently fall through to
    // "(unknown)" because the original `[^@]+` couldn't accept a
    // leading `@`.
    const jspmMatch = /\/npm:(?:@[^/]+\/)?[^@/]+@([^/]+)\//.exec(url);
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
 * Returns both `imports` (the URL map) and `integrity` (SRI hashes
 * keyed by URL). Integrity is populated only from the pin file;
 * live-API mode skips it (would require per-package fetches just to
 * hash, defeating the live-mode speed advantage. Users who want SRI
 * run `webjs vendor pin`).
 *
 * @param {Set<string>} bareImports
 * @param {string} appDir
 * @returns {Promise<{ imports: Record<string, string>, integrity: Record<string, string> }>}
 */
export async function resolveVendorImports(bareImports, appDir) {
  const file = await readPinFile(appDir);
  if (file) {
    return { imports: file.imports, integrity: file.integrity || {} };
  }
  const imports = await vendorImportMapEntries(bareImports, appDir);
  return { imports, integrity: {} };
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
  // Strict allowlist. Vendor filenames are framework-generated:
  // `<pkg>@<version>.js` or `<pkg>@<version>__<subpath>.js` plus the
  // `@scope__name` form for scoped packages. The legal charset is
  // alphanumeric plus `@`, `.`, `_`, `-`. Reject anything else
  // (slashes / backslashes / dots-dots / null bytes / Unicode
  // separators / glob chars) without echoing the input.
  if (!/^[A-Za-z0-9@._-]+\.js$/.test(filename) || filename.includes('..')) {
    return new Response(`/* invalid vendor filename */`, {
      status: 400,
      headers: { 'content-type': 'application/javascript; charset=utf-8' },
    });
  }
  try {
    // Read as raw bytes (no encoding arg). downloadBundle writes the
    // file from the response arrayBuffer (the same primitive the
    // browser's SRI implementation hashes), so the bytes on disk are
    // byte-identical to what jspm.io originally served. Reading with
    // utf8 here would decode-then-re-encode and risk dropping the SRI
    // match if any byte didn't round-trip exactly (e.g. invalid
    // surrogate replacement). Keep the I/O binary end-to-end.
    const body = await readFile(join(pinDir(appDir), filename));
    return new Response(body, {
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': dev ? 'no-cache' : 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    // Don't echo `filename` (already validated by the regex above so
    // safe to echo, but keep the body fixed for grep-ability and to
    // discourage anyone copying this pattern with untrusted input).
    return new Response(`/* vendor bundle not found. Run webjs vendor pin --download to (re-)download. */`, {
      status: 404,
      headers: { 'content-type': 'application/javascript; charset=utf-8' },
    });
  }
}
