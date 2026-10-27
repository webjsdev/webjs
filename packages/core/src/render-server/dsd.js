import { expandHtml } from './walk.js';

/**
 * Declarative Shadow DOM injection over an HTML STRING: the string-input path
 * of the renderer. Since #1646 a page's custom elements are expanded inside
 * the template walk itself (`walk.js` + `expand.js`), and this entry remains
 * for markup that only exists as a string, which `streamSuspenseBoundaries`
 * uses for a streamed boundary's children. It tokenizes the string through
 * the same compiler the templates go through, so a tag inside a comment, a
 * raw-text element or an attribute value is text here too (#1128).
 *
 * @param {string} html
 * @param {import('./stream.js').SuspenseCtx} [ctx]
 * @param {any[]} [ancestors]
 * @param {boolean} [dev]  server dev flag, threaded to the per-component error
 *   template for prod-silence (#483); undefined falls back to NODE_ENV
 * @returns {Promise<string>}
 */
export function injectDSD(html, ctx, ancestors = [], dev) {
  return expandHtml(html, ctx, { ancestors, dev });
}
