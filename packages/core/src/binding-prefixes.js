import { nothing, noChange } from './sentinels.js';
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

/**
 * Serialize an ordinary whole-value attribute expression for SSR and client
 * commits. Nullish values become empty strings and booleans stringify.
 * `nothing` omits the attribute. `noChange` omits it on initial SSR; client
 * updates handle that sentinel before serialization to retain the prior value.
 *
 * @param {string} _name attribute name (kept for the shared call signature)
 * @param {unknown} value the expression value (`live()` already unwrapped)
 * @returns {string | null}
 */
export function attrHoleValue(_name, value) {
  if (value === nothing || value === noChange) return null;
  return String(value ?? '');
}
