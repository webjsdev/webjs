/**
 * Browser-side hydration of `data-webjs-prop-*` attributes emitted by
 * SSR. The component's connectedCallback decodes each one via the
 * wire serializer, sets the corresponding camelCase property on the
 * instance, and removes the attribute from the DOM.
 *
 * Runs under linkedom so we can drive connectedCallback() without a
 * real browser. The globals MUST be installed before importing
 * WebComponent so the class extends linkedom's HTMLElement, not the
 * default no-op stub used in pure node:test environments.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

let WebComponent, html;

before(async () => {
  const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>');
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.DocumentFragment = window.DocumentFragment;
  globalThis.Comment = window.Comment;
  globalThis.Text = window.Text;
  globalThis.customElements = window.customElements;
  globalThis.NodeFilter = window.NodeFilter;
  globalThis.MutationObserver = window.MutationObserver;

  ({ WebComponent, html } = await import('../packages/core/index.js'));
});

test('connectedCallback decodes data-webjs-prop-* and strips the attribute', () => {
  class HydrateProbe extends WebComponent {
    static properties = { count: { type: Number } };
    constructor() { super(); this.count = 0; }
    render() { return html`<p>${this.count}</p>`; }
  }
  customElements.define('hydrate-probe-count', HydrateProbe);

  // Use a plain number value so the JSON encoding has no inner
  // quotes; linkedom's attribute parser does not like nested quotes.
  // Wire-format encoding of a number is just the number literal as a
  // string, so we hand-craft it here.
  document.body.innerHTML = `<hydrate-probe-count data-webjs-prop-count="42"></hydrate-probe-count>`;
  const el = /** @type any */ (document.querySelector('hydrate-probe-count'));
  el.connectedCallback();

  assert.equal(el.count, 42);
  assert.equal(
    el.hasAttribute('data-webjs-prop-count'), false,
    'data-webjs-prop-count attribute must be removed after hydration',
  );
});

test('hydration handles kebab-case attribute names back to camelCase property', () => {
  class TwoWords extends WebComponent {
    static properties = { itemCount: { type: Number } };
    constructor() { super(); this.itemCount = 0; }
    render() { return html`<p>${this.itemCount}</p>`; }
  }
  customElements.define('two-words-probe', TwoWords);

  document.body.innerHTML = `<two-words-probe data-webjs-prop-item-count="7"></two-words-probe>`;
  const el = /** @type any */ (document.querySelector('two-words-probe'));
  el.connectedCallback();

  assert.equal(el.itemCount, 7);
});

test('hydration is one-time: the attribute is stripped, second connectedCallback is a no-op', () => {
  class GuardProbe extends WebComponent {
    static properties = { val: { type: Number } };
    constructor() { super(); this.val = 0; }
    render() { return html`<p>${this.val}</p>`; }
  }
  customElements.define('guard-probe-1', GuardProbe);

  document.body.innerHTML = `<guard-probe-1 data-webjs-prop-val="5"></guard-probe-1>`;
  const el = /** @type any */ (document.querySelector('guard-probe-1'));
  el.connectedCallback();
  assert.equal(el.val, 5);
  assert.equal(el.hasAttribute('data-webjs-prop-val'), false);

  // Mutate the property to a known value. A second connectedCallback
  // must not re-read the (now stripped) attribute and clobber the
  // live value back to its decoded form.
  el.val = 99;
  el.connectedCallback();
  assert.equal(el.val, 99, 'second connectedCallback must not re-hydrate');
});
