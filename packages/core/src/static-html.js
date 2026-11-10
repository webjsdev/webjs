/**
 * Static expressions, lit's `lit/static-html.js` under a WebJs path:
 * `@webjsdev/core/static-html`.
 *
 * Portions derived from Lit, Copyright Google LLC, BSD-3-Clause.
 *
 * A static value is spliced into the template's STRINGS before the renderer
 * ever sees them, so it can sit where an ordinary hole cannot: a tag name, an
 * attribute name. The classic use is a component whose child tag is chosen at
 * runtime.
 *
 * ```js
 * import { html, literal, unsafeStatic } from '@webjsdev/core/static-html';
 *
 * const tag = literal`my-button`;
 * html`<${tag} label="Save"></${tag}>`;
 *
 * // A string from data must go through unsafeStatic, which trusts it as markup.
 * html`<${unsafeStatic(level)}>Title</${unsafeStatic(level)}>`;
 * ```
 *
 * The merged strings array is cached by its joined text, so every render of
 * the same static shape hands the renderers the SAME array, which is what
 * their template caches key on (identity). A static that changes between
 * renders produces a different shape, and so a fresh template, exactly as in
 * lit.
 *
 * NEVER pass user input to `unsafeStatic`: it is inserted as markup.
 *
 * @module static-html
 */

import { html as coreHtml, svg as coreSvg, mathml as coreMathml } from './html.js';

/**
 * Brand on every static value. `Symbol.for` so a value made by one loaded copy
 * of this module is recognised by another (the source module and a bundle).
 */
const STATIC = Symbol.for('webjs.static');

/**
 * @typedef {{ _$webjsStatic: string, r: symbol }} StaticValue
 */

/** @param {unknown} value @returns {string | undefined} */
function unwrapStaticValue(value) {
  if (value && typeof value === 'object' && /** @type {any} */ (value).r === STATIC) {
    return /** @type {any} */ (value)._$webjsStatic;
  }
  return undefined;
}

/**
 * Wrap a string so it is inserted as static markup, lit's `unsafeStatic`. The
 * string is trusted: NEVER pass user input.
 *
 * @param {string} value
 * @returns {StaticValue}
 */
export function unsafeStatic(value) {
  return { _$webjsStatic: value, r: STATIC };
}

/**
 * A static value from a template literal, lit's `literal`. Every interpolated
 * value must itself be a static value (another `literal` or `unsafeStatic`),
 * so a literal can never carry untrusted text.
 *
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {StaticValue}
 */
export function literal(strings, ...values) {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    const s = unwrapStaticValue(values[i]);
    if (s === undefined) {
      throw new Error(
        `Value passed to 'literal' function must be a 'literal' result: ${String(values[i])}. ` +
        `Use 'unsafeStatic' to pass non-literal values, but take care to ensure page security.`,
      );
    }
    text += s + strings[i + 1];
  }
  return { _$webjsStatic: text, r: STATIC };
}

/**
 * One strings array per static shape, kept for the life of the process as Lit
 * keeps it: the renderers key their template caches on its identity, so a
 * shape still in use must never get a new array. Only literal statics belong
 * here; `unsafeStatic` over request data makes a new shape per value.
 * @type {Map<string, string[]>}
 */
const stringsCache = new Map();

/**
 * Wrap a template tag so it accepts static values, lit's `withStatic`.
 *
 * @template R
 * @param {(strings: TemplateStringsArray | string[], ...values: unknown[]) => R} coreTag
 * @returns {(strings: TemplateStringsArray | string[], ...values: unknown[]) => R}
 */
export function withStatic(coreTag) {
  return (strings, ...values) => {
    const l = values.length;
    /** @type {string[]} */
    const staticStrings = [];
    /** @type {unknown[]} */
    const dynamicValues = [];
    let hasStatics = false;
    let i = 0;
    while (i < l) {
      let s = strings[i];
      let staticValue;
      while (i < l && (staticValue = unwrapStaticValue(values[i])) !== undefined) {
        s += staticValue + strings[++i];
        hasStatics = true;
      }
      if (i !== l) dynamicValues.push(values[i]);
      staticStrings.push(s);
      i++;
    }
    if (i === l) staticStrings.push(strings[l]);
    if (!hasStatics) return coreTag(strings, ...values);
    // A NUL separator cannot occur in template source, so two different
    // shapes never share a key.
    const key = staticStrings.join('\u0000');
    let cached = stringsCache.get(key);
    if (cached === undefined) {
      /** @type {any} */ (staticStrings).raw = staticStrings;
      cached = staticStrings;
      stringsCache.set(key, cached);
    }
    return coreTag(cached, ...dynamicValues);
  };
}

/** `html` that accepts static values (`literal` / `unsafeStatic`). */
export const html = withStatic(coreHtml);
/** `svg` that accepts static values. */
export const svg = withStatic(coreSvg);
/** `mathml` that accepts static values. */
export const mathml = withStatic(coreMathml);
