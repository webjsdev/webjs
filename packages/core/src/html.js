/**
 * Tagged template literal producing a {@link TemplateResult}.
 *
 * A TemplateResult is an isomorphic description of HTML: the static string
 * pieces plus the dynamic values. Server and client renderers both consume it.
 *
 * @typedef {{ _$webjs: 'template', strings: TemplateStringsArray | string[], values: unknown[] }} TemplateResult
 *
 * @param {TemplateStringsArray | string[]} strings
 * @param {...unknown} values
 * @returns {TemplateResult}
 */
export function html(strings, ...values) {
  return { _$webjs: 'template', strings, values };
}

/**
 * Identity check for TemplateResult.
 * @param {unknown} x
 * @returns {x is TemplateResult}
 */
export function isTemplate(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'template';
}

/**
 * Marker used in the DOM to find hydration points. It is interpolated into
 * BOTH comment markers (`<!--${MARKER}0-->`) and part-sentinel ATTRIBUTE names
 * (`data-${MARKER}0`), so it MUST contain only characters valid in an XML
 * qualified name. A `$` (the original value `'w$'`) is NOT valid in an
 * attribute name: most engines tolerate it, but iOS WebKit's `setAttribute`
 * enforces the spec and throws `InvalidCharacterError: Invalid qualified name`,
 * which crashed `createInstance` for every slot template on iOS (#730). Keep it
 * to `[a-z][a-z0-9-]*`. Enforced by `test/rendering/marker-valid-attr-name.test.js`.
 */
export const MARKER = 'wjm-';
