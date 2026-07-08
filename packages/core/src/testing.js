/**
 * Testing utilities for WebJs components.
 *
 * **When to use (AI hint):** Import from `'@webjsdev/core/testing'` in test files
 * to create, render, and interact with web components in a Node.js test
 * environment using linkedom (a lightweight DOM implementation).
 *
 * ```js
 * import { fixture, waitForUpdate } from '@webjsdev/core/testing';
 * import { html } from '@webjsdev/core';
 *
 * const el = await fixture(html`<my-counter count="5"></my-counter>`);
 * assert.equal(el.shadowRoot.textContent.trim(), '5');
 *
 * el.setAttribute('count', '10');
 * await waitForUpdate(el);
 * assert.equal(el.shadowRoot.textContent.trim(), '10');
 * ```
 *
 * @module testing
 */

/**
 * Create a component from a TemplateResult, connect it to a DOM,
 * and wait for its first render to complete.
 *
 * Uses linkedom (if available) to create a minimal DOM environment
 * in Node.js. Falls back to the global `document` in a browser.
 *
 * **When to use (AI hint):** Use `fixture()` in unit tests to quickly
 * mount a component and assert against its rendered shadow DOM.
 * This is the primary test helper: start every component test with it.
 *
 * @param {import('./html.js').TemplateResult | string} template
 *   Either a `html\`…\`` result or a raw HTML string.
 * @returns {Promise<Element>} The first child element of the rendered container.
 */
export async function fixture(template) {
  const container = getContainer();
  if (typeof template === 'string') {
    container.innerHTML = template;
  } else if (template && typeof template === 'object' && template._$webjs === 'template') {
    // Render using the server renderer to produce HTML with DSD,
    // then parse it into the container.
    const { renderToString } = await import('./render-server.js');
    const html = await renderToString(template, { ssr: true });
    container.innerHTML = html;
  } else {
    throw new Error('fixture() expects an html`…` template or an HTML string');
  }

  // Wait a microtask for component connectedCallback + first render
  await new Promise((r) => setTimeout(r, 0));

  const el = container.firstElementChild;
  if (!el) throw new Error('fixture() produced no element');
  return el;
}

/**
 * Server-render a template THEN hydrate it in the same browser session,
 * awaiting the element's native `updateComplete` so the post-hydration DOM
 * is observable deterministically.
 *
 * This is the SSR + hydrate entry, distinct from `fixture()`. `fixture()`
 * server-renders and parses the HTML into the container, but it only waits
 * two macrotasks and never awaits the real update cycle. `ssrFixture()`
 * renders the SAME SSR markup (with DSD), lets the browser upgrade the
 * custom element, then awaits the element's `updateComplete` promise (the
 * actual render-cycle resolution), not a timer.
 *
 * **What it proves.** The SSR'd markup and the post-hydration DOM agree.
 * Because the returned element is the live, hydrated element, a hydration
 * mismatch (the server rendered one thing, the client rendered another) is
 * observable: compare the SSR'd inner HTML against `el.innerHTML` /
 * `el.shadowRoot.innerHTML` after this resolves and a divergence shows up.
 *
 * **When to use (AI hint):** Use `ssrFixture()` when the test is about the
 * SSR-then-hydrate round-trip (does the server paint survive hydration, does
 * a `.prop` decode back, does a signal-backed render match). Use the plain
 * `fixture()` for a quick mount where the SSR-vs-hydrate distinction does not
 * matter.
 *
 * Requires a real DOM (the WTR Chromium session). The component class must
 * already be registered (the test imports its module, same as `fixture()`).
 *
 * @param {import('./html.js').TemplateResult | string} template
 *   Either a `html\`…\`` result or a raw HTML string.
 * @returns {Promise<Element>} The hydrated root element.
 */
export async function ssrFixture(template) {
  const container = getContainer();
  if (typeof template === 'string') {
    container.innerHTML = template;
  } else if (template && typeof template === 'object' && template._$webjs === 'template') {
    const { renderToString } = await import('./render-server.js');
    const html = await renderToString(template, { ssr: true });
    container.innerHTML = html;
  } else {
    throw new Error('ssrFixture() expects an html`…` template or an HTML string');
  }

  const el = container.firstElementChild;
  if (!el) throw new Error('ssrFixture() produced no element');

  // Drive the real update cycle. The browser upgrades the SSR'd custom
  // element on innerHTML assignment; its connectedCallback queues the first
  // render. Awaiting the native updateComplete promise (not a timer) is the
  // whole point: the test observes the post-hydration DOM deterministically.
  await flushUpdate(el);
  return el;
}

/**
 * Wait for a component's next render cycle to complete.
 *
 * **When to use (AI hint):** Call after `setAttribute()`, a property
 * assignment, `requestUpdate()`, or a signal `set()` the component
 * subscribes to, any change that triggers a re-render. The re-render
 * is async (microtask-batched), so you need to await before asserting.
 *
 * Awaits the element's native `updateComplete` promise when present (the
 * real render-cycle resolution), falling back to a microtask flush for a
 * plain element that has no `updateComplete` (back-compatible).
 *
 * @param {Element} el  The component element.
 * @returns {Promise<void>}
 */
export async function waitForUpdate(el) {
  await flushUpdate(el);
}

/**
 * Await the real update cycle of an element. For a WebComponent this awaits
 * the native `updateComplete` promise; for anything else it yields two
 * macrotasks (the legacy behaviour) so cascading updates settle.
 *
 * @param {Element} el
 * @returns {Promise<void>}
 */
async function flushUpdate(el) {
  const uc = el && /** @type {any} */ (el).updateComplete;
  if (uc && typeof uc.then === 'function') {
    await uc;
    // A microtask yield lets any cascading child update flush too.
    await Promise.resolve();
    return;
  }
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

/**
 * Assert an element's subtree has no accessibility violations, using the
 * axe-core engine in the real browser. OPT-IN: nothing calls this for you,
 * it is never a forced gate.
 *
 * axe-core is a TEST-ONLY peer: it is imported dynamically here, so it is
 * NOT a hard dependency of `@webjsdev/core`. An app that does not do a11y
 * testing never needs it. Install it where you run the test:
 * `npm install -D axe-core`.
 *
 * On a violation it throws an Error whose message lists each violation's id,
 * impact, a short help string, and the failing nodes' selectors, so the test
 * failure is actionable. On zero violations it resolves.
 *
 * ```js
 * import { ssrFixture, assertNoA11yViolations } from '@webjsdev/core/testing';
 * const el = await ssrFixture(html`<my-form></my-form>`);
 * await assertNoA11yViolations(el);
 * // tune rules: await assertNoA11yViolations(el, { rules: { 'color-contrast': { enabled: false } } });
 * ```
 *
 * @param {Element} el  The element (subtree root) to scan.
 * @param {object} [opts]  Options passed through to `axe.run` (e.g. `rules`).
 * @returns {Promise<void>}
 */
export async function assertNoA11yViolations(el, opts) {
  if (!el || typeof el !== 'object') {
    throw new Error('assertNoA11yViolations() expects a DOM element');
  }
  let axe;
  try {
    const mod = await import('axe-core');
    // axe-core ships a UMD bundle. Depending on how the test runner / bundler
    // wraps it, the engine may sit on the namespace, on `.default`, on a
    // nested `.default.default`, or only as the `window.axe` side-effect the
    // UMD installs. Probe in that order for a `run` function.
    const candidates = [mod, mod && mod.default, mod && mod.default && mod.default.default,
      typeof globalThis !== 'undefined' ? globalThis.axe : undefined];
    axe = candidates.find((c) => c && typeof c.run === 'function');
  } catch {
    throw new Error(
      'assertNoA11yViolations needs axe-core. Install it: npm install -D axe-core'
    );
  }
  if (!axe || typeof axe.run !== 'function') {
    throw new Error(
      'assertNoA11yViolations needs axe-core. Install it: npm install -D axe-core'
    );
  }

  const results = await axe.run(el, opts || {});
  const violations = results.violations || [];
  if (violations.length === 0) return;

  const lines = violations.map((v) => {
    const targets = (v.nodes || [])
      .map((n) => (n.target || []).join(' '))
      .filter(Boolean)
      .join(', ');
    return `  - [${v.id}] (${v.impact || 'unknown'}) ${v.help}${targets ? ` -> ${targets}` : ''}`;
  });
  const err = new Error(
    `a11y: ${violations.length} accessibility violation(s) found:\n${lines.join('\n')}`
  );
  err.name = 'AssertionError';
  throw err;
}

/**
 * Simulate a click event on an element.
 *
 * **When to use (AI hint):** Use to test click handlers in components
 * without a real browser. Works with elements inside shadow DOM.
 *
 * @param {Element} el  The element to click.
 */
export function click(el) {
  el.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
}

/**
 * Query an element inside a component's shadow root.
 *
 * **When to use (AI hint):** Shorthand for `el.shadowRoot.querySelector(sel)`.
 * Returns null if no shadow root or no match.
 *
 * @param {Element} el  The component host element.
 * @param {string} selector  CSS selector.
 * @returns {Element | null}
 */
export function shadowQuery(el, selector) {
  return el.shadowRoot?.querySelector(selector) ?? null;
}

/**
 * Get all matching elements inside a component's shadow root.
 *
 * @param {Element} el  The component host element.
 * @param {string} selector  CSS selector.
 * @returns {NodeList}
 */
export function shadowQueryAll(el, selector) {
  return el.shadowRoot?.querySelectorAll(selector) ?? [];
}

/* ------------------------------------------------------------------ */
/* Internal: DOM container management                                  */
/* ------------------------------------------------------------------ */

let _doc = null;
let _container = null;

function getContainer() {
  if (_container) {
    _container.innerHTML = '';
    return _container;
  }

  // Browser environment
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    _container = document.createElement('div');
    document.body?.appendChild(_container);
    return _container;
  }

  // Node.js environment: use linkedom
  try {
    const { parseHTML } = /** @type {any} */ (
      // Dynamic import syntax can't be used in a sync function,
      // but linkedom is a CJS package that works with createRequire.
      (() => {
        const { createRequire } = /** @type {any} */ (globalThis).__webjs_require ||
          (() => { throw new Error('no require'); })();
        return createRequire(import.meta.url)('linkedom');
      })()
    );
    const { document: doc } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    _doc = doc;
    _container = doc.createElement('div');
    doc.body.appendChild(_container);
    return _container;
  } catch {
    throw new Error(
      'fixture() requires a DOM environment. In Node.js, install linkedom: npm i -D linkedom'
    );
  }
}
