// Reactive-prop option coverage for the `default` (declarative initial value,
// lit-parity) and custom `attribute` (custom HTML attribute name) options.
// Both were previously DOCUMENTED but not implemented; these tests pin the
// implementation. Uses a linkedom DOM so attributeChangedCallback fires.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

let WebComponent, prop;

before(async () => {
  const { window } = parseHTML('<!doctype html><html><head></head><body></body></html>');
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Element = window.Element;
  globalThis.Node = window.Node;
  globalThis.customElements = window.customElements;
  ({ WebComponent, prop } = await import('../../index.js'));
});

test('default option: a value default is applied at construction', () => {
  class C extends WebComponent({ count: prop(Number, { default: 7 }) }) {}
  customElements.define('def-value', C);
  assert.equal(new C().count, 7);
});

test('default option: a function default runs per instance (fresh object/array)', () => {
  class C extends WebComponent({ items: prop(Array, { default: () => [] }) }) {}
  customElements.define('def-fn', C);
  const a = new C();
  const b = new C();
  a.items.push('x');
  assert.deepEqual(a.items, ['x']);
  assert.deepEqual(b.items, [], 'each instance gets a fresh array, no shared reference');
});

test('default option: a falsy default (0 / false / empty string) is applied', () => {
  // The implementation guards on `!== undefined` precisely so falsy defaults
  // land rather than being skipped as "no default".
  class C extends WebComponent({
    n: prop(Number, { default: 0 }),
    b: prop(Boolean, { default: false }),
    s: prop(String, { default: '' }),
  }) {}
  customElements.define('def-falsy', C);
  const el = new C();
  assert.equal(el.n, 0);
  assert.equal(el.b, false);
  assert.equal(el.s, '');
});

test('default option counterfactual: a prop WITHOUT default is undefined', () => {
  class C extends WebComponent({ count: prop(Number) }) {}
  customElements.define('def-none', C);
  assert.equal(new C().count, undefined, 'no default means no initial value (proves default is what sets it)');
});

test('default option precedence: a constructor assignment overrides the default', () => {
  // `default` is applied inside super() (_initializeProperties); the subclass
  // constructor body runs AFTER super(), so an explicit assignment wins. The
  // default is the fallback, not an override.
  class C extends WebComponent({ count: prop(Number, { default: 7 }) }) {
    constructor() { super(); this.count = 5; }
  }
  customElements.define('def-ctor-precedence', C);
  assert.equal(new C().count, 5, 'the constructor value (5) wins over the default (7)');
});

test('default option: an applied attribute overrides the default', () => {
  class C extends WebComponent({ count: prop(Number, { default: 7 }) }) {}
  customElements.define('def-attr-override', C);
  document.body.innerHTML = '<def-attr-override count="42"></def-attr-override>';
  const el = /** @type any */ (document.querySelector('def-attr-override'));
  el.connectedCallback();
  assert.equal(el.count, 42, 'the count="42" attribute overrides the default of 7');
});

test('attribute option: observedAttributes uses the custom name, not the kebab', () => {
  class C extends WebComponent({ showCloseButton: prop(Boolean, { attribute: 'closable' }) }) {}
  const observed = C.observedAttributes;
  assert.ok(observed.includes('closable'), 'custom attribute name is observed');
  assert.ok(!observed.includes('show-close-button'), 'the auto-kebab name is NOT used when a custom one is given');
});

test('attribute option: the custom attribute maps to the property', () => {
  class C extends WebComponent({ open: prop(Boolean, { attribute: 'is-open' }) }) {}
  customElements.define('attr-custom', C);
  document.body.innerHTML = '<attr-custom is-open></attr-custom>';
  const el = /** @type any */ (document.querySelector('attr-custom'));
  el.connectedCallback();
  el.attributeChangedCallback('is-open', null, '');
  assert.equal(el.open, true, 'setting the custom attribute updates the prop');
});

test('attribute option: reflect writes to the custom attribute name', async () => {
  class C extends WebComponent({ active: prop(Boolean, { attribute: 'data-active', reflect: true }) }) {}
  customElements.define('attr-reflect', C);
  document.body.innerHTML = '<attr-reflect></attr-reflect>';
  const el = /** @type any */ (document.querySelector('attr-reflect'));
  el.connectedCallback();
  el.active = true;
  await el.updateComplete;
  assert.ok(el.hasAttribute('data-active'), 'reflects to the custom attribute name');
  assert.ok(!el.hasAttribute('active'), 'does not reflect to the property name');
});

test("default attribute name: Lit's lowercase name is primary, the kebab name a read alias", async () => {
  class C extends WebComponent({ isOpen: prop(Boolean, { reflect: true }), maxItems: Number }) {}
  customElements.define('attr-lower', C);
  const observed = C.observedAttributes;
  assert.ok(observed.includes('isopen') && observed.includes('is-open'));
  document.body.innerHTML = '<attr-lower></attr-lower>';
  const el = /** @type any */ (document.querySelector('attr-lower'));
  el.connectedCallback();
  el.isOpen = true;
  await el.updateComplete;
  assert.ok(el.hasAttribute('isopen'), 'reflects to the lowercase name, as Lit does');
  assert.ok(!el.hasAttribute('is-open'), 'never to the kebab alias');
  el.attributeChangedCallback('max-items', null, '3');
  assert.equal(el.maxItems, 3, 'the kebab spelling still reads');
  el.attributeChangedCallback('maxitems', null, '4');
  assert.equal(el.maxItems, 4);
});

test('attribute: true is the default name, not an attribute called "true"', () => {
  class C extends WebComponent({ userName: prop(String, { attribute: true }) }) {}
  customElements.define('attr-true', C);
  assert.ok(C.observedAttributes.includes('username'));
  assert.ok(!C.observedAttributes.includes('true'));
});
