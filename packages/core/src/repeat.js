/**
 * `repeat()`: keyed list directive.
 *
 * Usage in a template:
 * ```js
 * import { html, repeat } from '@webjsdev/core';
 * html`<ul>${repeat(items, (it) => it.id, (it) => html`<li>${it.title}</li>`)}</ul>`;
 * ```
 *
 * Without `repeat()`, an array re-render rebuilds every child (losing focus,
 * selection, and scroll). With `repeat()`, the client renderer maintains a
 * `Map<key, TemplateInstance>`: matched items update in place, new items
 * mount fresh, removed items unmount, and the surviving DOM nodes are moved
 * (not recreated) when the order changes.
 *
 * Keys must be stable and unique within the call. Bad keys (array indices)
 * defeat the purpose; prefer a stable id from the data.
 *
 * The two-argument form, `repeat(items, (it) => html`...`)`, is lit's too: with
 * no key function each item is keyed by its INDEX, which makes it a plain
 * positional list (no DOM moves on reorder). Pass a key function whenever item
 * identity has to follow the data.
 *
 * On the server this marker is just iterated: order matters, keys don't.
 */

const REPEAT = Symbol.for('webjs.repeat');

/** The key of an item `repeat(items, template)` was given no key function for. */
const indexKey = (/** @type {unknown} */ _item, /** @type {number} */ i) => i;

/**
 * @template T
 * @param {Iterable<T>} items
 * @param {((item: T, i: number) => unknown)} keyFnOrTemplate the key function,
 *   or, when `templateFn` is omitted, the template function (lit's two-argument form)
 * @param {(item: T, i: number) => unknown} [templateFn]
 */
export function repeat(items, keyFnOrTemplate, templateFn) {
  if (templateFn === undefined) {
    return { [REPEAT]: true, items: [...items], keyFn: indexKey, templateFn: keyFnOrTemplate };
  }
  return { [REPEAT]: true, items: [...items], keyFn: keyFnOrTemplate, templateFn };
}

/** @param {unknown} x */
export function isRepeat(x) {
  return !!x && typeof x === 'object' && /** @type any */ (x)[REPEAT] === true;
}
