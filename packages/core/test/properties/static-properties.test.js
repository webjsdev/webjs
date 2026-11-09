import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WebComponent, prop, html } from '../../index.js';
import { renderToString } from '../../src/render-server.js';

// #1686: reactive properties can be declared through Lit's own spelling,
// `static properties = { ... }`, as well as through the
// `extends WebComponent({ ... })` factory, and they merge down the class
// chain the way Lit's `finalize` merges `elementProperties`.

test('a static properties field declares a reactive property', () => {
  class Counter extends WebComponent {
    static properties = { count: { type: Number } };
  }
  const el = /** @type {any} */ (new Counter());
  el.count = 3;
  assert.equal(el.count, 3);
  assert.ok(Object.getOwnPropertyDescriptor(Counter.prototype, 'count')?.set, 'the accessor is on the prototype');
  assert.deepEqual(Counter.observedAttributes, ['count']);
});

test('options carry through: reflect, state, attribute, default', () => {
  class Opts extends WebComponent {
    static properties = {
      open: { type: Boolean, reflect: true },
      internal: { state: true },
      label: { type: String, attribute: 'aria-label' },
      items: { type: Array, default: () => [] },
    };
  }
  assert.deepEqual(Opts.observedAttributes.sort(), ['aria-label', 'items', 'open'], 'state: true is not observed');
  const a = /** @type {any} */ (new Opts());
  const b = /** @type {any} */ (new Opts());
  assert.deepEqual(a.items, []);
  assert.notEqual(a.items, b.items, 'a function default is called per instance');
});

test('a static get properties() accessor works, as in Lit', () => {
  class Getter extends WebComponent {
    static get properties() { return { n: { type: Number } }; }
  }
  const el = /** @type {any} */ (new Getter());
  el.n = 7;
  assert.equal(el.n, 7);
  assert.deepEqual(Getter.observedAttributes, ['n']);
});

test('a bare constructor value is accepted', () => {
  class Bare extends WebComponent {
    static properties = { count: Number };
  }
  assert.deepEqual(Bare.observedAttributes, ['count']);
});

test("a subclass's own static properties add to its parent's", () => {
  class Base extends WebComponent {
    static properties = { count: { type: Number } };
  }
  class Sub extends Base {
    static properties = { label: { type: String } };
  }
  assert.deepEqual(Sub.observedAttributes, ['count', 'label']);
  const el = /** @type {any} */ (new Sub());
  el.count = 1;
  el.label = 'x';
  assert.equal(el.count, 1);
  assert.equal(el.label, 'x');
  assert.deepEqual(Base.observedAttributes, ['count'], 'the parent keeps only its own');
});

test('a factory class can add a static properties block', () => {
  class Mixed extends WebComponent({ x: Number }) {
    static properties = { y: { type: String } };
  }
  assert.deepEqual(Mixed.observedAttributes, ['x', 'y']);
});

test('a subclass of a factory class inherits its props', () => {
  class Base extends WebComponent({ count: Number }) {}
  class Sub extends Base {
    static properties = { extra: { type: String } };
  }
  assert.deepEqual(Sub.observedAttributes, ['count', 'extra']);
});

test('the factory form keeps working, with and without prop()', () => {
  class Good extends WebComponent({ count: Number, open: prop(Boolean, { reflect: true }) }) {
    constructor() { super(); this.count = 0; }
  }
  const el = /** @type {any} */ (new Good());
  assert.equal(el.count, 0);
  el.open = true;
  assert.equal(el.open, true);
});

test('SSR applies attributes to static properties and reflects them', async () => {
  class SsrStatic extends WebComponent {
    static properties = { count: { type: Number, reflect: true }, label: { type: String } };
    constructor() { super(); this.count = 1; }
    render() { return html`<p>${this.label}:${this.count + 1}</p>`; }
  }
  SsrStatic.register('ssr-static-props');
  class SsrSub extends SsrStatic {
    static properties = { suffix: { type: String } };
    render() { return html`<p>${this.label}:${this.count}${this.suffix}</p>`; }
  }
  SsrSub.register('ssr-static-sub');
  const out = await renderToString(
    html`<ssr-static-props count="4" label="n"></ssr-static-props><ssr-static-sub count="2" label="m" suffix="!"></ssr-static-sub>`,
  );
  assert.match(out, /<p>n:5<\/p>/, 'the attribute is read as a Number');
  assert.match(out, /<p>m:2!<\/p>/, 'the subclass reads its parent props and its own');
});
