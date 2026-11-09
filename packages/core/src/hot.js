/**
 * The dev hot-swap seam (#1689). The dev server's reload client installs a hot
 * client on `globalThis[Symbol.for('webjs.hot')]` before any component module
 * runs; production never does, so each read here is one global lookup that
 * finds nothing. No logic lives in core: the client is inlined into
 * `/__webjs/reload.js` from `@webjsdev/server`'s `dev-hot-client.js`.
 */
const HOT = Symbol.for('webjs.hot');
const g = /** @type {any} */ (globalThis);

/**
 * The template strings `html()` / `svg()` keep. Under the dev hot client,
 * textually identical templates share one strings object across module
 * evaluations, so a hot swap rebuilds only the templates whose text changed.
 * @param {TemplateStringsArray | string[]} s
 * @param {0 | 1} kind
 * @returns {TemplateStringsArray | string[]}
 */
export function hotStrings(s, kind) { const h = g[HOT]; return h === undefined ? s : h.strings(s, kind); }

/** @returns {((tag: string, prev: Function, next: Function) => Function) | null} */
export function hotReplacer() { const h = g[HOT]; return h === undefined ? null : h.replace; }
