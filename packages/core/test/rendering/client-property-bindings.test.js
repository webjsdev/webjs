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

  ({ WebComponent, html } = await import('../../index.js'));
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

test('subclass without overriding connectedCallback still hydrates', () => {
  class Base extends WebComponent {
    static properties = { val: { type: Number } };
    constructor() { super(); this.val = 0; }
    render() { return html`<p>${this.val}</p>`; }
  }
  class Subclass extends Base {
    // Inherits connectedCallback from WebComponent base; hydration
    // must still run via that inherited method.
  }
  customElements.define('subclass-noop-probe', Subclass);

  document.body.innerHTML = `<subclass-noop-probe data-webjs-prop-val="11"></subclass-noop-probe>`;
  const el = /** @type any */ (document.querySelector('subclass-noop-probe'));
  el.connectedCallback();
  assert.equal(el.val, 11);
  assert.equal(el.hasAttribute('data-webjs-prop-val'), false);
});

test('subclass that overrides connectedCallback + calls super still hydrates', () => {
  let userHookFired = false;
  class Base extends WebComponent {
    static properties = { val: { type: Number } };
    constructor() { super(); this.val = 0; }
    render() { return html`<p>${this.val}</p>`; }
  }
  class WithUserHook extends Base {
    connectedCallback() {
      super.connectedCallback();
      userHookFired = true;
    }
  }
  customElements.define('subclass-super-probe', WithUserHook);

  document.body.innerHTML = `<subclass-super-probe data-webjs-prop-val="22"></subclass-super-probe>`;
  const el = /** @type any */ (document.querySelector('subclass-super-probe'));
  el.connectedCallback();
  assert.equal(el.val, 22, 'super.connectedCallback must trigger hydration');
  assert.equal(userHookFired, true, 'user code after super still runs');
  assert.equal(el.hasAttribute('data-webjs-prop-val'), false);
});

test('subclass that overrides connectedCallback and forgets super does NOT hydrate', () => {
  // Negative test documenting the existing pattern: subclasses MUST
  // call super.connectedCallback() to inherit framework lifecycle,
  // including prop-attribute hydration. This matches WebComponent's
  // documented lifecycle contract for every other behaviour
  // (rendering, controllers, etc.).
  class Base extends WebComponent {
    static properties = { val: { type: Number } };
    constructor() { super(); this.val = 0; }
    render() { return html`<p>${this.val}</p>`; }
  }
  class Forgetful extends Base {
    connectedCallback() {
      // No super call. Hydration must be skipped.
    }
  }
  customElements.define('subclass-forgetful-probe', Forgetful);

  document.body.innerHTML = `<subclass-forgetful-probe data-webjs-prop-val="33"></subclass-forgetful-probe>`;
  const el = /** @type any */ (document.querySelector('subclass-forgetful-probe'));
  el.connectedCallback();
  assert.equal(el.val, 0, 'no super call: hydration skipped, constructor default kept');
  assert.equal(
    el.hasAttribute('data-webjs-prop-val'), true,
    'attribute remains because hydration never ran',
  );
});

test('multiple data-webjs-prop-* attributes on the same element all decode', () => {
  class Many extends WebComponent {
    static properties = {
      first: { type: Number },
      second: { type: Number },
      third: { type: Number },
    };
    constructor() { super(); this.first = 0; this.second = 0; this.third = 0; }
    render() { return html`<p>${this.first}+${this.second}+${this.third}</p>`; }
  }
  customElements.define('many-props-probe', Many);

  document.body.innerHTML =
    `<many-props-probe ` +
    `data-webjs-prop-first="1" data-webjs-prop-second="2" data-webjs-prop-third="3">` +
    `</many-props-probe>`;
  const el = /** @type any */ (document.querySelector('many-props-probe'));
  el.connectedCallback();
  assert.equal(el.first, 1);
  assert.equal(el.second, 2);
  assert.equal(el.third, 3);
  assert.equal(el.attributes.length, 0, 'all data-webjs-prop-* attributes stripped');
});

test('a malformed data-webjs-prop-* attribute is skipped, others still apply', () => {
  // The framework warns once but does not crash. Other props still
  // hydrate normally.
  const orig = console.warn;
  /** @type {unknown[]} */
  const warns = [];
  console.warn = (msg) => warns.push(msg);
  try {
    class Mixed extends WebComponent {
      static properties = { good: { type: Number }, bad: { type: Object } };
      constructor() { super(); this.good = 0; this.bad = { sentinel: true }; }
      render() { return html`<p>${this.good}</p>`; }
    }
    customElements.define('mixed-malformed-probe', Mixed);

    document.body.innerHTML =
      `<mixed-malformed-probe data-webjs-prop-good="7" data-webjs-prop-bad="not-valid-json{">` +
      `</mixed-malformed-probe>`;
    const el = /** @type any */ (document.querySelector('mixed-malformed-probe'));
    el.connectedCallback();

    assert.equal(el.good, 7, 'good prop hydrated');
    assert.deepEqual(el.bad, { sentinel: true }, 'bad prop kept the constructor default');
    assert.ok(warns.length >= 1, 'at least one warning emitted for the malformed value');
  } finally {
    console.warn = orig;
  }
});
