/**
 * The `css` tag and the style plumbing both renderers share.
 *
 * Portions derived from Lit (`@lit/reactive-element` css-tag.ts and
 * reactive-element.ts `finalizeStyles`), Copyright Google LLC,
 * BSD-3-Clause.
 */

/**
 * The value `css` and `unsafeCSS` return, Lit's `CSSResult`. `cssText` is the
 * style text; `styleSheet` is a constructed `CSSStyleSheet` built on first
 * read in the browser (undefined on the server), cached per result so every
 * element adopting it shares one sheet.
 *
 * The `_$webjsCss` brand, not `instanceof`, is what identifies a result:
 * `@webjsdev/core` resolves to a bundle while a subpath resolves to source, so
 * two copies of this class can meet in one page.
 */
export class CSSResult {
  /** @param {string} cssText */
  constructor(cssText) {
    /** @type {true} */
    this._$webjsCss = true;
    /** @type {string} */
    this.cssText = cssText;
    /** @type {CSSStyleSheet | undefined} */
    this._styleSheet = undefined;
  }

  /** The style text, also readable as `cssText` (Lit's name). */
  get text() {
    return this.cssText;
  }

  /** A constructed stylesheet for `adoptedStyleSheets`, or undefined where there is none (the server). */
  get styleSheet() {
    if (this._styleSheet === undefined && typeof CSSStyleSheet !== 'undefined') {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(this.cssText);
      this._styleSheet = sheet;
    }
    return this._styleSheet;
  }

  toString() {
    return this.cssText;
  }
}

/**
 * Tagged template literal producing a {@link CSSResult}, Lit's `css`. A hole
 * may hold another `css` result (composed in as text) or a number. Anything
 * else throws: a string in a hole is how untrusted text reaches a stylesheet,
 * so it has to go through `unsafeCSS()` on purpose, as in Lit.
 *
 * @param {TemplateStringsArray | string[]} strings
 * @param {...unknown} values
 * @returns {CSSResult}
 */
export function css(strings, ...values) {
  let text = strings[0];
  for (let i = 1; i < strings.length; i++) {
    text += cssValue(values[i - 1]) + strings[i];
  }
  return new CSSResult(text);
}

/** @param {unknown} value */
function cssValue(value) {
  if (isCSS(value)) return /** @type {any} */ (value).cssText ?? /** @type {any} */ (value).text;
  if (typeof value === 'number') return String(value);
  throw new Error(
    `[webjs] Value passed to 'css' must be a 'css' result or a number, got ${describe(value)}. ` +
      `Compose another css\`...\` result, or wrap a trusted string in unsafeCSS() from '@webjsdev/core'. ` +
      `Never pass user input through unsafeCSS().`,
  );
}

/** @param {unknown} value */
function describe(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value.length > 40 ? value.slice(0, 40) + '...' : value);
  return typeof value;
}

/**
 * Wrap a string (or any value, stringified) as a {@link CSSResult}, Lit's
 * `unsafeCSS`. The text is used as is, so only pass trusted values: CSS from
 * user input can exfiltrate data through `url()` and attribute selectors.
 *
 * @param {unknown} value
 * @returns {CSSResult}
 */
export function unsafeCSS(value) {
  return new CSSResult(typeof value === 'string' ? value : String(value));
}

/** @param {unknown} x @returns {x is CSSResult} */
export function isCSS(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjsCss === true;
}

/**
 * Lit's `finalizeStyles`: turn a class's `static styles` (a result, a sheet,
 * or arbitrarily nested arrays of them) into the flat list both renderers
 * apply. A style included twice keeps its LAST position, so a later override
 * still wins the cascade, as in Lit.
 *
 * @param {unknown} styles
 * @returns {(CSSResult | CSSStyleSheet)[]}
 */
export function finalizeStyles(styles) {
  /** @type {(CSSResult | CSSStyleSheet)[]} */
  const out = [];
  if (Array.isArray(styles)) {
    const unique = new Set(styles.flat(Infinity).reverse());
    for (const s of unique) if (isStyle(s)) out.unshift(/** @type {any} */ (s));
  } else if (isStyle(styles)) {
    out.push(/** @type {any} */ (styles));
  }
  return out;
}

/** @param {unknown} s */
function isStyle(s) {
  return isCSS(s) || (typeof CSSStyleSheet !== 'undefined' && s instanceof CSSStyleSheet);
}

/**
 * Apply styles to a shadow root (client-side only). Uses adoptedStyleSheets
 * when available, falls back to a <style> element.
 *
 * @param {ShadowRoot | Document} root
 * @param {(CSSResult | CSSStyleSheet)[]} styles
 */
export function adoptStyles(root, styles) {
  if (!styles || !styles.length) return;
  if ('adoptedStyleSheets' in root && typeof CSSStyleSheet !== 'undefined') {
    /** @type {any} */ (root).adoptedStyleSheets = styles.map((s) => {
      if (s instanceof CSSStyleSheet) return s;
      const shared = /** @type {any} */ (s).styleSheet;
      if (shared) return shared;
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(styleText(s));
      return sheet;
    });
  } else {
    const host = /** @type {any} */ (root);
    const el = document.createElement('style');
    el.textContent = styles.map(styleText).join('\n');
    host.appendChild(el);
  }
}

/** @param {any} s @returns {string} */
function styleText(s) {
  if (isCSS(s)) return s.cssText ?? s.text;
  if (s && s.cssRules) return Array.from(s.cssRules, (r) => /** @type {any} */ (r).cssText).join('\n');
  return '';
}

/**
 * Serialise styles to a <style> tag string (server-side). A constructed
 * `CSSStyleSheet` has no server equivalent, so only `css` results render.
 * @param {(CSSResult | CSSStyleSheet)[]} styles
 */
export function stylesToString(styles) {
  if (!styles || !styles.length) return '';
  const text = styles.filter(isCSS).map(styleText);
  return text.length ? `<style>${text.join('\n')}</style>` : '';
}

/**
 * The error a light-DOM component with `static styles` gets: the styles are
 * adopted into a shadow root, and the component has none. One string, used by
 * the server renderer (logged during SSR) and by the browser element, so the
 * two cannot drift. Internal: not re-exported from the package.
 * @param {string} tag
 * @returns {string}
 */
export function lightDomStylesMessage(tag) {
  return (
    `[webjs] <${tag}> declares static styles but renders into light DOM, so the styles are never applied. ` +
    `Add \`static shadow = true\` to scope them in a shadow root, or style the light-DOM markup with Tailwind ` +
    `utilities or a global stylesheet (prefix custom class selectors with the tag name).`
  );
}
