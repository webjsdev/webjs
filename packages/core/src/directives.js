/**
 * Built-in directives for the webjs `html` tagged template system.
 *
 * Currently exported from this file:
 * - `unsafeHTML(str)`. Render trusted raw HTML. Never use with user input.
 * - `live(value)`. Force `.value` to sync with the live DOM property.
 *
 * `repeat()` is in `./repeat.js` for keyed list reconciliation.
 *
 * More directives (full lit-html parity) are being added as part of the
 * lit-API parity initiative. See the project memo for the locked scope.
 *
 * @module directives
 */

/* ================================================================
 * unsafeHTML
 * ================================================================ */

/**
 * Render a raw HTML string without escaping. The string is injected
 * directly into the DOM as parsed HTML nodes.
 *
 * **When to use (AI hint):** Use ONLY for trusted HTML: CMS content,
 * markdown-to-HTML output, or sanitized rich text. NEVER use for
 * user-supplied input: this is an XSS vector.
 *
 * ```js
 * import { html } from '@webjskit/core';
 * import { unsafeHTML } from '@webjskit/core/directives';
 *
 * // Good: trusted markdown output
 * html`<article>${unsafeHTML(markdownToHtml(post.body))}</article>`;
 *
 * // DANGEROUS: user input: use ${text} instead (auto-escaped)
 * // html`<p>${unsafeHTML(userInput)}</p>`;  // ← XSS!
 * ```
 *
 * @param {string | null | undefined} htmlString
 *   Trusted HTML string to render without escaping.
 * @returns {{ _$webjs: 'unsafe-html', value: string }}
 */
export function unsafeHTML(htmlString) {
  return { _$webjs: 'unsafe-html', value: String(htmlString ?? '') };
}

/**
 * Type guard: returns `true` if `x` is a marker produced by `unsafeHTML()`.
 * @param {unknown} x
 * @returns {x is { _$webjs: 'unsafe-html', value: string }}
 */
export function isUnsafeHTML(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'unsafe-html';
}

/* ================================================================
 * live
 * ================================================================ */

/**
 * Dirty-check a value against the **live DOM value** instead of the
 * last rendered value. Essential for `<input>` two-way binding where
 * the user can modify the DOM value between renders.
 *
 * **When to use (AI hint):** Use `live()` on `.value` or `.checked`
 * bindings for `<input>`, `<textarea>`, `<select>` elements where the
 * user types/selects between renders. Without `live()`, the renderer
 * skips the update because its cached value matches: even though the
 * DOM value has changed.
 *
 * ```js
 * import { html } from '@webjskit/core';
 * import { live } from '@webjskit/core/directives';
 *
 * html`<input .value=${live(this.state.query)}
 *             @input=${e => this.setState({ query: e.target.value })}>`;
 * ```
 *
 * On the server, `live()` is a no-op: it unwraps to the inner value.
 *
 * @param {unknown} value  The value to set on the element.
 * @returns {{ _$webjs: 'live', value: unknown }}
 */
export function live(value) {
  return { _$webjs: 'live', value };
}

/**
 * Type guard: returns `true` if `x` is a marker produced by `live()`.
 * @param {unknown} x
 * @returns {x is { _$webjs: 'live', value: unknown }}
 */
export function isLive(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'live';
}
