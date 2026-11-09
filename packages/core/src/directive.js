/**
 * Custom directive authoring, lit's `lit/directive.js` under a WebJs path:
 * `@webjsdev/core/directive`.
 *
 * Portions derived from Lit, Copyright Google LLC, BSD-3-Clause.
 *
 * ```js
 * import { directive, Directive, PartType } from '@webjsdev/core/directive';
 *
 * class Uppercase extends Directive {
 *   constructor(partInfo) {
 *     super(partInfo);
 *     if (partInfo.type !== PartType.CHILD) throw new Error('uppercase() is a child directive');
 *   }
 *   render(text) { return String(text).toUpperCase(); }
 * }
 * export const uppercase = directive(Uppercase);
 *
 * html`<p>${uppercase(name)}</p>`;
 * ```
 *
 * The contract is lit's. One directive INSTANCE lives per template part (per
 * piece of an interpolated attribute) for as long as the same directive class
 * renders there; a different class (or a plain value) replaces it. On the
 * client every render calls `update(part, values)`, whose default forwards to
 * `render(...values)`; on the server only `render(...values)` runs, because
 * there is no DOM to hand `update`. Whatever either returns is rendered at the
 * part like any other value (`noChange` keeps the last commit, `nothing`
 * clears it), so a directive may return a template or another directive.
 *
 * The result is a plain object branded `_$webjs: 'directive'`. Both renderers
 * recognise it by that brand, never by `instanceof`, so a directive built
 * against one loaded copy of this module renders through another (this
 * subpath is source while the root import may be the built bundle).
 *
 * @module directive
 */

/**
 * The kind of template part a directive instance is bound to, lit's values.
 * @type {Readonly<{ ATTRIBUTE: 1, CHILD: 2, PROPERTY: 3, BOOLEAN_ATTRIBUTE: 4, EVENT: 5, ELEMENT: 6 }>}
 */
export const PartType = Object.freeze({
  ATTRIBUTE: 1,
  CHILD: 2,
  PROPERTY: 3,
  BOOLEAN_ATTRIBUTE: 4,
  EVENT: 5,
  ELEMENT: 6,
});

/**
 * Base class for a custom directive. Subclass it, implement `render()`, and
 * optionally override `update()` for DOM access on the client.
 */
export class Directive {
  /**
   * @param {{ type: number, name?: string, tagName?: string, strings?: readonly string[] }} _partInfo
   *   Where the directive is used: `type` is a {@link PartType}; an attribute
   *   part also carries `name`, `tagName` and, when the attribute is
   *   interpolated, its static `strings`.
   */
  constructor(_partInfo) {}

  /**
   * Produce the value to render. Called on the server, and on the client by
   * the default `update()`.
   * @param {...unknown} _values the arguments the directive function was called with
   * @returns {unknown}
   */
  render(..._values) {
    return undefined;
  }

  /**
   * Called on the client on every render with the part (a lit-shaped facade:
   * `type`, `options.host`, and `element` / `name` / `strings` for an element
   * or attribute part, `parentNode` / `startNode` / `endNode` for a child
   * part) and the arguments as an array. The default calls `render()`.
   * @param {unknown} _part
   * @param {unknown[]} values
   * @returns {unknown}
   */
  update(_part, values) {
    return this.render(...values);
  }
}

/**
 * Turn a {@link Directive} subclass into the function templates call, lit's
 * `directive()`. Each call returns a marker carrying the class and its
 * arguments; the renderer owns the instance.
 *
 * @template {new (partInfo: any) => Directive} C
 * @param {C} c
 * @returns {(...values: unknown[]) => { _$webjs: 'directive', ctor: C, values: unknown[] }}
 */
export function directive(c) {
  return (...values) => ({ _$webjs: 'directive', ctor: c, values });
}

/**
 * Whether `x` is the result of calling a `directive()` function.
 * @param {unknown} x
 * @returns {x is { _$webjs: 'directive', ctor: any, values: unknown[] }}
 */
export function isDirectiveResult(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'directive';
}

/**
 * The directive class a directive result was made from, lit's
 * `getDirectiveClass`.
 * @param {unknown} x
 * @returns {Function | undefined}
 */
export function getDirectiveClass(x) {
  return isDirectiveResult(x) ? x.ctor : undefined;
}
