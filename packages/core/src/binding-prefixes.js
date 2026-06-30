/**
 * The template attribute-binding prefixes the renderers recognise.
 *
 * A binding hole whose attribute name starts with one of these is NOT a
 * plain attribute: `@event` is a client event listener (dropped at SSR,
 * wired only after hydration), `.prop` is a DOM property, `?bool` a
 * boolean attribute. This object is the SINGLE source of truth for that
 * set: both the client renderer (`render-client.js`) and the server
 * renderer (`render-server.js`, two sites) read it instead of hardcoding
 * the prefix characters inline.
 *
 * It is also the anchor for the elision drift guard. The analyser
 * (`packages/server/src/component-elision.js`) classifies every prefix as
 * either a client-behaviour ship signal (it drops at SSR and implies the
 * component does client work, so a component using it must ship) or an
 * SSR-safe round-trip (it survives into the served HTML, so it is not a
 * ship signal). The guard test
 * (`packages/server/test/elision/sigil-coverage.test.js`) asserts that
 * classification covers EXACTLY these keys, so a new prefix cannot be
 * added here without the analyser being taught which kind it is. That
 * closes the one gap the prototype-introspection guard
 * (`lifecycle-coverage.test.js`) cannot reach, because a sigil is syntax,
 * not a prototype method or a named export.
 *
 * @type {Readonly<Record<string, 'event' | 'prop' | 'bool'>>}
 */
export const BINDING_PREFIXES = Object.freeze({
  '@': 'event',
  '.': 'prop',
  '?': 'bool',
});

/**
 * True if `ch` is a recognised binding prefix. A single-character string is
 * expected (the first char of an attribute name).
 *
 * @param {string} ch
 * @returns {boolean}
 */
export function isBindingPrefix(ch) {
  return Object.prototype.hasOwnProperty.call(BINDING_PREFIXES, ch);
}
