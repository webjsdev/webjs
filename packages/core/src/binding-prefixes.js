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

/**
 * The HTML boolean attributes: present means on, absent means off, and the
 * value is meant to be empty. A boolean in a PLAIN hole on one of these renders
 * exactly like `?attr` (#1579), so `checked=${isDefault}` cannot serve the
 * `checked="false"` that HTML reads as checked. Lowercase, from the HTML spec's
 * attribute index.
 */
const BOOLEAN_ATTRIBUTES = new Set([
  'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'controls',
  'default', 'defer', 'disabled', 'formnovalidate', 'hidden', 'inert',
  'ismap', 'itemscope', 'loop', 'multiple', 'muted', 'nomodule', 'novalidate',
  'open', 'playsinline', 'readonly', 'required', 'reversed', 'selected',
  'shadowrootclonable', 'shadowrootdelegatesfocus', 'shadowrootserializable',
]);

/**
 * What a PLAIN attribute hole (`name=${value}`, unquoted, the whole value)
 * writes, or `null` when the attribute is omitted. The one rule both renderers
 * follow, so the server never serves an attribute the client then removes
 * (#1573, #1579):
 *
 *   - `null` / `undefined` omit the attribute. This is the "omit" value, so a
 *     conditional attribute is `aria-current=${active ? 'page' : null}`.
 *   - `false` omits it too, EXCEPT on an `aria-*` attribute, where it writes
 *     `"false"`. For a tri-state ARIA attribute (`aria-expanded`,
 *     `aria-pressed`, `aria-checked`) `"false"` and absent mean different
 *     things, so the value an author passes is the value the user agent gets.
 *   - `true` on an HTML boolean attribute (`checked`, `selected`, `disabled`,
 *     and the rest) writes the empty value, exactly as `?attr=${true}` does. Anywhere
 *     else it is `"true"`.
 *   - anything else is `String(value)`.
 *
 * A quoted or mixed value (`title="${x}"`, `class="a ${x}"`) is not a plain
 * hole: the author wrote the attribute statically, so it stays and a nullish
 * piece reads as empty text.
 *
 * @param {string} name the attribute name as written
 * @param {unknown} value the hole's value (`live()` already unwrapped)
 * @returns {string | null}
 */
export function attrHoleValue(name, value) {
  if (value == null) return null;
  if (value === false) return /^aria-/i.test(name) ? 'false' : null;
  if (value === true && BOOLEAN_ATTRIBUTES.has(String(name).toLowerCase())) return '';
  return String(value);
}
