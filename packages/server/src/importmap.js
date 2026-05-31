import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { digestHex } from './crypto-utils.js';
import { jsonForScriptTag } from './script-tag-json.js';

// Local attribute escaper. Matches ssr.js's escapeAttr (the source
// of truth for HTML attribute escaping in this package). Kept inline
// to avoid a cross-file dependency for one small helper.
function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Build the import map JSON injected into every SSR HTML document.
 *
 * Additional vendor entries are added automatically when the bare-import
 * scanner discovers npm packages used by client code. The resolution
 * happens via `vendor.js`'s `resolveVendorImports`, which reads the
 * committed `.webjs/vendor/importmap.json` if present, else calls
 * `api.jspm.io/generate` once on the first request (memoized), never at
 * boot. Browser fetches vendor packages
 * directly from jspm.io's CDN (default) or from local `/__webjs/vendor/`
 * paths (after `webjs vendor pin --download`).
 */

/** @type {Record<string, string>} */
let _extraEntries = {};

/**
 * SRI integrity hashes keyed by FINAL URL (post-importmap-rewrite).
 * Populated only when a pin file with `integrity` is present;
 * live-API mode skips it.
 * @type {Record<string, string>}
 */
let _vendorIntegrity = {};

/**
 * Merge additional vendor entries into the import map and precompute
 * the importmap-hash so `importMapHash()` can stay synchronous on the
 * per-request SSR hot path. Called from `ensureReady()` on the first
 * request and on every vendor rebuild.
 *
 * @param {Record<string, string>} entries
 * @param {Record<string, string>} [integrity]  SRI hashes keyed by URL
 * @returns {Promise<void>}
 */
export async function setVendorEntries(entries, integrity) {
  _extraEntries = entries;
  _vendorIntegrity = integrity || {};
  _importMapHash = await digestHex('SHA-256', JSON.stringify(buildImportMap()));
}

/**
 * Stable SHA-256 of the current importmap JSON, used as the
 * `data-webjs-build` attribute on `<script type="importmap">` and
 * as the `X-Webjs-Build` response header on every SSR response.
 *
 * Purpose: the X-Webjs-Have partial-response optimization in ssr.js
 * short-circuits at the outermost cached layout and returns only the
 * inner body (no head, no importmap). Without the build header the
 * client router has no way to detect a deploy that bumped the
 * importmap. After a `webjs vendor pin` rerun the user's next
 * intra-shell nav would stay on the stale importmap and the new
 * vendor URLs would never load. The header lets applySwap detect
 * the change and hard-reload before applying the swap.
 *
 * Synchronous accessor. The hash is precomputed eagerly inside
 * `setVendorEntries` (which `ensureReady()` `await`s on the first request
 * and on every rebuild) so the per-request SSR hot path can return the
 * cached string without crossing a Promise boundary.
 *
 * Returns an empty string if `setVendorEntries` has never run; the
 * client router treats an empty `X-Webjs-Build` as "version unknown"
 * and skips the importmap drift check, which is the right behaviour
 * for tests / embedding contexts that never set vendor entries.
 *
 * @returns {string}  e.g. `abc123…` (hex, 64 chars)
 */
let _importMapHash = '';
export function importMapHash() {
  return _importMapHash;
}

/**
 * Look up the SRI integrity hash for a vendor URL, or empty string if
 * none. Used by ssr.js to add `integrity="..."` to modulepreload tags
 * pointing at vendor URLs.
 *
 * @param {string} url
 * @returns {string}
 */
export function vendorIntegrityFor(url) {
  return _vendorIntegrity[url] || '';
}

/**
 * The `@webjsdev/core` install's importmap entries, derived from its
 * own `package.json` `exports` field. Populated by `setCoreInstall`
 * at boot.
 *
 * Initialized to the two minimum-safe defaults (the bare specifier
 * pointing at the browser source-mode entry and the catch-all prefix
 * pointing at `src/`) so any consumer that calls `buildImportMap()`
 * before `setCoreInstall` runs still gets a usable map. Pre-#118 the
 * legacy `coreMappings` were always derived from a boolean and so
 * could not be empty; this keeps that fail-open posture for embedded
 * SSR test helpers and one-shot tooling that imports `importmap.js`
 * without booting `dev.js`.
 *
 * @type {Record<string, string>}
 */
let _coreEntries = {
  '@webjsdev/core': '/__webjs/core/index-browser.js',
  '@webjsdev/core/': '/__webjs/core/src/',
};

/**
 * Bind the importmap to a specific `@webjsdev/core` install. The
 * builder reads the package's `package.json` exports field once and
 * derives one importmap entry per exported subpath, picking the
 * `default` (bundled `dist/`) condition when `distMode` is true and
 * the `source` (per-file `src/`) condition when it's false. The
 * derivation lets the framework drop the 9-line hardcoded mapping
 * table that used to live here, and means the importmap follows the
 * shipped package whenever subpaths are renamed or added.
 *
 * The bare `@webjsdev/core` specifier still hardcodes its target
 * (the browser-only entry shipped at `index-browser.js` /
 * `dist/webjs-core-browser.js`) because that file is not declared
 * in the exports field, by design: it is a server-stripped surface
 * meant for the importmap-driven browser route, not Node resolution.
 *
 * Called once by `dev.js` at boot. Not re-called on file-watcher
 * rebuilds today; if `@webjsdev/core/package.json` is edited in a
 * long-running dev session (e.g. workspace dev that runs a fresh
 * `npm run build:dist`), the derivation is refreshed on next server
 * restart, not on the watcher tick. Pre-#118 the legacy
 * `setCoreDistMode` had the same behaviour: only the dist-presence
 * boolean was watched, not the package.json itself.
 *
 * Like `setVendorEntries`, the importmap-hash is recomputed eagerly
 * so `importMapHash()` stays synchronous on the per-request SSR
 * hot path.
 *
 * @param {string} coreDir   absolute path to the resolved `@webjsdev/core` install
 * @param {boolean} distMode true when both `webjs-core.js` and `webjs-core-browser.js` exist in `dist/`
 * @returns {Promise<void>}
 */
export async function setCoreInstall(coreDir, distMode) {
  _coreEntries = buildCoreEntries(coreDir, !!distMode);
  _importMapHash = await digestHex('SHA-256', JSON.stringify(buildImportMap()));
}

/**
 * Read `<coreDir>/package.json` and derive importmap entries from
 * its `exports` field. The function is pure (no side effects) and
 * exported so tests can exercise the derivation directly.
 *
 * For each subpath in `exports` whose value is an object form, emit
 * one entry. Pick the `default` value in dist mode (a bundled
 * `dist/webjs-core-*.js`) and the `source` value in src mode (a
 * per-file `src/*.js`). When `source` is absent (e.g. `./component`,
 * whose shape is `{ types, default }` and whose `default` is itself
 * a `src/` path), fall back to `default` in src mode so the import
 * still resolves with a `.js` extension on the URL.
 *
 * Subpaths with a plain string value (`./client`, `./server`,
 * `./registry`, `./signals`, `./package.json`) are not mapped
 * explicitly; the catch-all `@webjsdev/core/` prefix routes them
 * through `/__webjs/core/src/`. Future-added subpaths added in
 * string form land on the catch-all the same way.
 *
 * Path-traversal guard: any `default` / `source` value that contains
 * `..` is skipped. The trust boundary today is the framework's own
 * `@webjsdev/core/package.json`, but the guard makes a future shift
 * to user-controlled `coreDir` (e.g. via a `--core-dir` flag) safe
 * by construction.
 *
 * @param {string} coreDir
 * @param {boolean} distMode
 * @returns {Record<string, string>}
 */
export function buildCoreEntries(coreDir, distMode) {
  /** @type {Record<string, string>} */
  const out = {
    // Bare specifier: browser-only entry, slim by design (drops
    // render-server, expose, setCspNonceProvider). Node-side
    // consumers resolve via the package.json exports `default`
    // condition and land on `index.js` instead.
    '@webjsdev/core': distMode
      ? '/__webjs/core/dist/webjs-core-browser.js'
      : '/__webjs/core/index-browser.js',
    // Catch-all: source-only subpaths (`./client`, `./server`,
    // `./component`, `./registry`, `./signals`) and any future
    // subpath not yet enumerated by exports still resolve.
    '@webjsdev/core/': '/__webjs/core/src/',
  };
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(coreDir, 'package.json'), 'utf8'));
  } catch {
    // Without a readable package.json the bare + catch-all entries
    // above are the minimum useful map. Per-subpath entries stay
    // missing; the catch-all picks them up at src/<name> (callers
    // would need to include the .js extension in their import).
    return out;
  }
  const exportsField = pkg && pkg.exports;
  if (!exportsField || typeof exportsField !== 'object') return out;
  for (const [subpath, entry] of Object.entries(exportsField)) {
    // Skip the bare `.` (handled above) and any non-subpath key.
    if (subpath === '.' || !subpath.startsWith('./') || subpath.endsWith('/')) continue;
    // Only object-form entries with both default and source carry
    // a dist mapping. String-form entries (`./client`,
    // `./component` once it loses its types, …) stay on the
    // catch-all.
    if (!entry || typeof entry !== 'object') continue;
    // Pick the condition for the requested mode. In src mode,
    // entries that lack a `source` (e.g. `./component`, whose
    // package.json shape is `{ types, default }`) fall back to
    // `entry.default`. The fallback URL is still a `src/` path on
    // those entries, so it resolves correctly without forcing users
    // to add a `.js` extension to subpath imports.
    let targetRel = distMode ? entry.default : entry.source;
    if (typeof targetRel !== 'string') targetRel = entry.default;
    if (typeof targetRel !== 'string' || !targetRel.startsWith('./')) continue;
    // Reject paths containing `..` to guard against a malformed or
    // adversarial `exports` field producing a path-traversal URL.
    // The check is deliberately broad: `..` substring catches both
    // `../etc/passwd` and `./foo/../bar`.
    if (targetRel.includes('..')) continue;
    // `./directives` → `@webjsdev/core/directives`,
    // `./dist/webjs-core-directives.js` → `/__webjs/core/dist/webjs-core-directives.js`.
    out['@webjsdev/core' + subpath.slice(1)] = '/__webjs/core/' + targetRel.slice(2);
  }
  return out;
}

export function buildImportMap() {
  const merged = {
    ..._coreEntries,
    ..._extraEntries,
  };
  // Sort keys so logically-identical importmaps serialize byte-for-byte
  // identically. The client router compares textContent to detect
  // post-deploy importmap mismatches; without a stable order the
  // scanner's filesystem-iteration order could change between deploys
  // (e.g. after a file rename) and trigger a spurious hard reload
  // even though the content didn't actually change.
  /** @type {Record<string, string>} */
  const imports = {};
  for (const k of Object.keys(merged).sort()) imports[k] = merged[k];

  // Emit `integrity` per the importmap-integrity spec (Chrome 132+,
  // Safari 18.4+, Firefox flagged). Browsers without support ignore
  // the field; per-tag SRI on modulepreload covers them.
  //
  // Filter orphan integrity entries (URLs that aren't actually in
  // imports). The browser only consults integrity for URLs that
  // resolve through the importmap, so orphans are harmless but bloat
  // the JSON, defeat the importMapHash stability invariant on
  // unrelated pin file edits, and leak removed URLs to the wire.
  const out = { imports };
  const usedUrls = new Set(Object.values(imports));
  const intKeys = Object.keys(_vendorIntegrity).filter(k => usedUrls.has(k)).sort();
  if (intKeys.length) {
    /** @type {Record<string, string>} */
    const integrity = {};
    for (const k of intKeys) integrity[k] = _vendorIntegrity[k];
    out.integrity = integrity;
  }
  return out;
}

/**
 * Serialise the import map to an HTML script tag string.
 *
 * When `nonce` is provided (extracted from the incoming
 * Content-Security-Policy header by ssr.js), it's emitted as
 * `nonce="..."` on the script tag. Strict-CSP apps using
 * `script-src 'nonce-...'` require this; without it the browser
 * blocks the importmap and every bare-specifier import fails.
 *
 * Defense-in-depth: JSON content is run through `jsonForScriptTag`
 * so a string value containing `</script>` (e.g. a maliciously
 * crafted vendor URL that somehow slipped past the jspm.io filter)
 * cannot close the importmap tag early and inject script content.
 *
 * @param {{ nonce?: string }} [opts]
 */
export function importMapTag(opts = {}) {
  // Full attribute escape, not just `"` to `&quot;`. The nonce arrives
  // from the request's CSP header (parsed by ssr.js), which we treat
  // as untrusted input even though CSP spec restricts nonce charset to
  // base64-ish. A misconfigured upstream emitting `nonce-<bad>` should
  // not get its `<` rendered raw into our HTML.
  const n = opts.nonce ? ` nonce="${escapeAttr(opts.nonce)}"` : '';
  // Stamp the build hash so the client router can detect post-deploy
  // importmap changes on intra-shell partial-response navigations.
  // See importMapHash() above for the rationale.
  const b = ` data-webjs-build="${importMapHash()}"`;
  return `<script type="importmap"${n}${b}>${jsonForScriptTag(buildImportMap())}</script>`;
}
