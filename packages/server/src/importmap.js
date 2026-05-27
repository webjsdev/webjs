import { createHash } from 'node:crypto';
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
 * `api.jspm.io/generate` once at boot. Browser fetches vendor packages
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
 * Merge additional vendor entries into the import map.
 * Called by the server after scanning for bare imports.
 * @param {Record<string, string>} entries
 * @param {Record<string, string>} [integrity]  SRI hashes keyed by URL
 */
export function setVendorEntries(entries, integrity) {
  _extraEntries = entries;
  _vendorIntegrity = integrity || {};
  // Bust the importmap-hash cache. Next call to importMapHash()
  // recomputes against the new entries.
  _importMapHash = '';
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
 * Cached because buildImportMap + JSON.stringify per request would
 * be wasteful; setVendorEntries invalidates the cache.
 *
 * @returns {string}  e.g. `abc123…` (hex, 64 chars)
 */
let _importMapHash = '';
export function importMapHash() {
  if (!_importMapHash) {
    _importMapHash = createHash('sha256')
      .update(JSON.stringify(buildImportMap()))
      .digest('hex');
  }
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

export function buildImportMap() {
  const merged = {
    '@webjsdev/core':               '/__webjs/core/index.js',
    '@webjsdev/core/':              '/__webjs/core/src/',
    '@webjsdev/core/client-router': '/__webjs/core/src/router-client.js',
    '@webjsdev/core/lazy-loader':   '/__webjs/core/src/lazy-loader.js',
    '@webjsdev/core/directives':    '/__webjs/core/src/directives.js',
    '@webjsdev/core/context':       '/__webjs/core/src/context.js',
    '@webjsdev/core/testing':       '/__webjs/core/src/testing.js',
    '@webjsdev/core/task':          '/__webjs/core/src/task.js',
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
  const out = { imports };
  const intKeys = Object.keys(_vendorIntegrity).sort();
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
