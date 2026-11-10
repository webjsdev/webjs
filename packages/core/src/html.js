import { hotStrings } from './hot.js';

/**
 * Tagged template literal producing a {@link TemplateResult}.
 *
 * A TemplateResult is an isomorphic description of HTML: the static string
 * pieces plus the dynamic values. Server and client renderers both consume it.
 *
 * @typedef {{ _$webjs: 'template', strings: TemplateStringsArray | string[], values: unknown[], svg?: boolean, mathml?: boolean }} TemplateResult
 *
 * @param {TemplateStringsArray | string[]} strings
 * @param {...unknown} values
 * @returns {TemplateResult}
 */
export function html(strings, ...values) {
  return { _$webjs: 'template', strings: hotStrings(trusted(strings), 0), values };
}

/**
 * The renderers render a template result's strings as markup only when they
 * carry `raw`, which a tagged template's strings always do, so a result that
 * arrived as data (JSON with the `_$webjs` brand) is refused. A plain array
 * passed to `html()` / `svg()` / `mathml()` is code, as `string[]` in the type
 * says, so it is marked the same way (kept in place so the template cache
 * still keys on it, copied only when frozen).
 * @param {TemplateStringsArray | string[]} strings
 */
function trusted(strings) {
  if (!Array.isArray(strings) || Object.prototype.hasOwnProperty.call(strings, 'raw')) return strings;
  const target = Object.isExtensible(strings) ? strings : strings.slice();
  Object.defineProperty(target, 'raw', { value: target });
  return target;
}

/**
 * Tagged template literal for an SVG FRAGMENT, lit's `svg` tag.
 *
 * Use it for markup that sits INSIDE an `<svg>` element but is built in its
 * own template (a `<rect>` per data point, a `<path>` a helper returns).
 * An `html` template is parsed as HTML on the client, so a `<rect>` there
 * becomes an HTML element and never paints. An `svg` template is parsed
 * inside an `<svg>` wrapper, so its elements are SVG elements. A whole
 * `<svg>` element still belongs in `html`.
 *
 * The server renders it exactly like `html` (markup is text there), so the
 * two differ only in how the client parses the static strings.
 *
 * @param {TemplateStringsArray | string[]} strings
 * @param {...unknown} values
 * @returns {TemplateResult}
 */
export function svg(strings, ...values) {
  return { _$webjs: 'template', strings: hotStrings(trusted(strings), 1), values, svg: true };
}

/**
 * Tagged template literal for a MathML FRAGMENT, lit's `mathml` tag: markup
 * that sits inside a `<math>` element but is built in its own template. The
 * client parses it inside a `<math>` wrapper so its elements land in the
 * MathML namespace; the server renders it exactly like `html`.
 *
 * @param {TemplateStringsArray | string[]} strings
 * @param {...unknown} values
 * @returns {TemplateResult}
 */
export function mathml(strings, ...values) {
  return { _$webjs: 'template', strings: hotStrings(trusted(strings), 2), values, mathml: true };
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
