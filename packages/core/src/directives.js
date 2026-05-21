/**
 * Built-in directives for the webjs `html` tagged template system.
 *
 * lit-html parity. Imports look like:
 *
 * ```js
 * import { html } from '@webjskit/core';
 * import {
 *   unsafeHTML, live,
 *   keyed, guard, templateContent, ref, createRef,
 *   cache, until, asyncAppend, asyncReplace,
 * } from '@webjskit/core/directives';
 * ```
 *
 * `repeat()` lives in `./repeat.js` (re-exported from the package root).
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

/* ================================================================
 * keyed (lit-html parity)
 * ================================================================ */

/**
 * Wrap a template with a key. When the key changes between renders, the
 * renderer discards the prior DOM and creates fresh. Useful for forcing
 * a remount when the logical identity of the rendered content changes
 * even though the template literal structure is the same.
 *
 * ```js
 * import { keyed } from '@webjskit/core/directives';
 *
 * // Form fully resets (input values, focus, etc.) when userId changes.
 * html`${keyed(this.userId, html`<edit-form .user=${this.user}></edit-form>`)}`;
 * ```
 *
 * On the server, the key is ignored (one-shot render). In the browser,
 * the renderer compares the new key to the previously-rendered key at
 * the same position and remounts on inequality.
 *
 * @template T
 * @param {unknown} key  Compared with `Object.is` against the previous render.
 * @param {T} template   Any value the renderer accepts (typically a `TemplateResult`).
 * @returns {{ _$webjs: 'keyed', key: unknown, value: T }}
 */
export function keyed(key, template) {
  return { _$webjs: 'keyed', key, value: template };
}

/** @param {unknown} x */
export function isKeyed(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'keyed';
}

/* ================================================================
 * guard (lit-html parity)
 * ================================================================ */

/**
 * Memoize a sub-template by its dependencies. If the deps array hasn't
 * changed shallowly between renders, the renderer skips re-evaluating
 * the value-producing function.
 *
 * ```js
 * import { guard } from '@webjskit/core/directives';
 *
 * render() {
 *   return html`
 *     <header>${guard([this.title], () => html`<h1>${this.title}</h1>`)}</header>
 *     <main>${this.body}</main>
 *   `;
 * }
 * ```
 *
 * On the server, `fn()` is always invoked (one-shot render, no cache).
 * In the browser, the renderer maintains a per-part cache keyed by the
 * shallow-compared deps array.
 *
 * @template T
 * @param {readonly unknown[]} deps  Shallow-compared between renders
 * @param {() => T} fn               Value-producing function
 * @returns {{ _$webjs: 'guard', deps: readonly unknown[], fn: () => T }}
 */
export function guard(deps, fn) {
  return { _$webjs: 'guard', deps, fn };
}

/** @param {unknown} x */
export function isGuard(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'guard';
}

/* ================================================================
 * templateContent (lit-html parity)
 * ================================================================ */

/**
 * Render the content of a `<template>` element. The template's content
 * is cloned on the client; on the server, its `innerHTML` is emitted.
 *
 * ```js
 * import { templateContent } from '@webjskit/core/directives';
 *
 * const tpl = document.querySelector('#my-tpl');
 * html`<div>${templateContent(tpl)}</div>`;
 * ```
 *
 * The HTML inside the template element is trusted: it is NOT escaped.
 * Do not pass templates whose content was assembled from user input.
 *
 * @param {HTMLTemplateElement | { innerHTML?: string, content?: DocumentFragment }} template
 * @returns {{ _$webjs: 'template-content', template: any }}
 */
export function templateContent(template) {
  return { _$webjs: 'template-content', template };
}

/** @param {unknown} x */
export function isTemplateContent(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'template-content';
}

/* ================================================================
 * ref (lit-html parity)
 * ================================================================ */

/**
 * Bind a Ref object or callback to the element produced at this position.
 *
 * ```js
 * import { createRef, ref } from '@webjskit/core/directives';
 *
 * class MyForm extends WebComponent {
 *   _input = createRef();
 *   render() {
 *     return html`<input ${ref(this._input)}>`;
 *   }
 *   firstUpdated() {
 *     this._input.value?.focus();
 *   }
 * }
 * ```
 *
 * Pass a callback instead of a Ref object to receive the element directly:
 *
 * ```js
 * html`<input ${ref((el) => this._captureEl(el))}>`;
 * ```
 *
 * On the server, `ref()` is a no-op: no DOM exists yet. The reference is
 * populated after the first client-side render. The callback receives
 * `undefined` when the element is removed.
 *
 * @param {{ value: unknown } | ((el: Element | undefined) => void)} refOrCallback
 * @returns {{ _$webjs: 'ref', target: any }}
 */
export function ref(refOrCallback) {
  return { _$webjs: 'ref', target: refOrCallback };
}

/** @param {unknown} x */
export function isRef(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'ref';
}

/**
 * Create a Ref object suitable for `ref()`. The element is assigned to
 * `ref.value` after the first render commit.
 *
 * @template {Element} T
 * @returns {{ value: T | undefined }}
 */
export function createRef() {
  return { value: undefined };
}

/* ================================================================
 * cache (lit-html parity)
 * ================================================================ */

/**
 * Cache prior template instances by their `strings` array so that
 * toggling between sub-templates preserves their detached DOM (input
 * state, scroll position, focus). When the inner value is a template
 * whose `strings` were cached on a previous render, the renderer
 * re-attaches the stashed nodes and reconciles values against the new
 * template instead of creating fresh DOM.
 *
 * ```js
 * import { cache } from '@webjskit/core/directives';
 *
 * render() {
 *   return html`
 *     <button @click=${() => this.tab = 'a'}>A</button>
 *     <button @click=${() => this.tab = 'b'}>B</button>
 *     ${cache(this.tab === 'a' ? html`<panel-a></panel-a>` : html`<panel-b></panel-b>`)}
 *   `;
 * }
 * ```
 *
 * On the server, `cache` is a pass-through (one-shot render, no DOM to
 * cache).
 *
 * @template T
 * @param {T} value
 * @returns {{ _$webjs: 'cache', value: T }}
 */
export function cache(value) {
  return { _$webjs: 'cache', value };
}

/** @param {unknown} x */
export function isCache(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'cache';
}

/* ================================================================
 * until (lit-html parity)
 * ================================================================ */

/**
 * Render the first synchronous value from a list of candidates. Any
 * Promises in the list are unwrapped on the server (the first to
 * resolve wins).
 *
 * ```js
 * import { until } from '@webjskit/core/directives';
 *
 * html`<div>${until(this.dataPromise, html`<p>Loading…</p>`)}</div>`;
 * ```
 *
 * Priority is left-to-right: `args[0]` is highest priority. The
 * highest-priority synchronous candidate (if any) renders immediately.
 * Higher-priority Promises that later resolve replace the rendered
 * value; lower-priority Promises are ignored once a higher-priority
 * candidate is in place. When the marker is torn down (e.g. the
 * parent re-renders with a different value), in-flight tracking is
 * cleared so late Promise resolutions cannot overwrite newer DOM.
 *
 * SSR awaits `Promise.race` when all candidates are Promises;
 * otherwise SSR renders the highest-priority synchronous candidate.
 * For component-scoped async data with full pending/error states,
 * prefer the `Task` controller (`@webjskit/core/task`).
 *
 * @param  {...unknown} args
 * @returns {{ _$webjs: 'until', args: unknown[] }}
 */
export function until(...args) {
  return { _$webjs: 'until', args };
}

/** @param {unknown} x */
export function isUntil(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'until';
}

/* ================================================================
 * asyncAppend / asyncReplace (lit-html parity)
 * ================================================================ */

/**
 * Render values from an `AsyncIterable` as they arrive, appending each
 * mapped result before the marker. Iteration runs in the background;
 * tearing down the marker (via a re-render that replaces the directive)
 * aborts the loop.
 *
 * ```js
 * import { asyncAppend } from '@webjskit/core/directives';
 *
 * async function* logTail() {
 *   for await (const line of stream) yield line;
 * }
 *
 * html`<ul>${asyncAppend(logTail(), (line, i) => html`<li>${i}: ${line}</li>`)}</ul>`;
 * ```
 *
 * SSR renders empty (no iteration on a one-shot server render). For
 * page-level streaming, prefer `Suspense({ fallback, children })`.
 *
 * @template T
 * @param {AsyncIterable<T>} iterable
 * @param {(value: T, index: number) => unknown} [mapper]
 * @returns {{ _$webjs: 'async-append', iterable: AsyncIterable<T>, mapper?: (v: T, i: number) => unknown }}
 */
export function asyncAppend(iterable, mapper) {
  return { _$webjs: 'async-append', iterable, mapper };
}

/** @param {unknown} x */
export function isAsyncAppend(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'async-append';
}

/**
 * Render values from an `AsyncIterable`, replacing the previous output
 * each time a new value arrives. The latest yielded value is the only
 * one that remains in the DOM.
 *
 * ```js
 * import { asyncReplace } from '@webjskit/core/directives';
 *
 * async function* ticker() {
 *   for (let i = 0; ; i++) {
 *     yield new Date().toLocaleTimeString();
 *     await new Promise(r => setTimeout(r, 1000));
 *   }
 * }
 *
 * html`<time>${asyncReplace(ticker())}</time>`;
 * ```
 *
 * SSR renders empty. Iteration aborts on teardown.
 *
 * @template T
 * @param {AsyncIterable<T>} iterable
 * @param {(value: T, index: number) => unknown} [mapper]
 * @returns {{ _$webjs: 'async-replace', iterable: AsyncIterable<T>, mapper?: (v: T, i: number) => unknown }}
 */
export function asyncReplace(iterable, mapper) {
  return { _$webjs: 'async-replace', iterable, mapper };
}

/** @param {unknown} x */
export function isAsyncReplace(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'async-replace';
}

/* ================================================================
 * watch (signal binding)
 * ================================================================ */

/**
 * Fine-grained reactive binding for a signal. Reads the signal at
 * render time and subscribes the rendered template hole to subsequent
 * changes. When the signal's value changes, only THIS hole updates,
 * the surrounding component does not re-render.
 *
 * ```js
 * import { html } from '@webjskit/core';
 * import { signal } from '@webjskit/core';
 * import { watch } from '@webjskit/core/directives';
 *
 * const count = signal(0);
 *
 * class Counter extends WebComponent {
 *   render() {
 *     return html`
 *       <p>Count: ${watch(count)}</p>
 *       <button @click=${() => count.set(count.get() + 1)}>+</button>
 *     `;
 *   }
 * }
 * ```
 *
 * Without `watch()`, a plain `${count.get()}` works too (the host
 * component subscribes automatically through its built-in
 * SignalWatcher), but the whole component re-renders on each change.
 * Use `watch()` when the surrounding template is expensive to re-run
 * or when you want signal changes to bypass `shouldUpdate` / `willUpdate`.
 *
 * On SSR, `watch()` reads the signal once and inlines the value.
 *
 * @param {{ get: () => unknown, __isSignal: true }} sig
 * @returns {{ _$webjs: 'watch', signal: { get: () => unknown, __isSignal: true } }}
 */
export function watch(sig) {
  return { _$webjs: 'watch', signal: sig };
}

/** @param {unknown} x */
export function isWatch(x) {
  return !!x && typeof x === 'object' && /** @type {any} */ (x)._$webjs === 'watch';
}
