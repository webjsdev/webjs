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
 * Merge additional vendor entries into the import map.
 * Called by the server after scanning for bare imports.
 * @param {Record<string, string>} entries
 */
export function setVendorEntries(entries) {
  _extraEntries = entries;
}

export function buildImportMap() {
  return {
    imports: {
      '@webjsdev/core':               '/__webjs/core/index.js',
      '@webjsdev/core/':              '/__webjs/core/src/',
      '@webjsdev/core/client-router': '/__webjs/core/src/router-client.js',
      '@webjsdev/core/lazy-loader':   '/__webjs/core/src/lazy-loader.js',
      '@webjsdev/core/directives':    '/__webjs/core/src/directives.js',
      '@webjsdev/core/context':       '/__webjs/core/src/context.js',
      '@webjsdev/core/testing':       '/__webjs/core/src/testing.js',
      '@webjsdev/core/task':          '/__webjs/core/src/task.js',
      ..._extraEntries,
    },
  };
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
 * @param {{ nonce?: string }} [opts]
 */
export function importMapTag(opts = {}) {
  const n = opts.nonce ? ` nonce="${opts.nonce.replace(/"/g, '&quot;')}"` : '';
  return `<script type="importmap"${n}>${JSON.stringify(buildImportMap())}</script>`;
}
