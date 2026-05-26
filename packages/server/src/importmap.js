import { jsonForScriptTag } from './script-tag-json.js';

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
  const imports = {
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
  // Emit `integrity` per the importmap-integrity spec (Chrome 132+,
  // Safari 18.4+, Firefox flagged). Browsers without support ignore
  // the field; per-tag SRI on modulepreload covers them.
  const out = { imports };
  if (Object.keys(_vendorIntegrity).length) {
    out.integrity = { ..._vendorIntegrity };
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
  const n = opts.nonce ? ` nonce="${opts.nonce.replace(/"/g, '&quot;')}"` : '';
  return `<script type="importmap"${n}>${jsonForScriptTag(buildImportMap())}</script>`;
}
