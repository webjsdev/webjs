import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WebComponent, prop } from '../../index.js';

// Issue #598: reactive properties must be declared via the
// `extends WebComponent({ … })` factory. A hand-written `static properties`
// in a class body is a hard runtime error.

test('throws when a class declares its own static properties', () => {
  class Bad extends WebComponent {
    static properties = { count: { type: Number } };
  }
  assert.throws(() => new Bad(), /static properties.*no longer supported/s);
});

test('throws even when static properties carries options', () => {
  class Bad extends WebComponent {
    static properties = { open: { type: Boolean, reflect: true } };
  }
  assert.throws(() => new Bad(), /static properties/);
});

test('error names the offending class', () => {
  class MyWidget extends WebComponent {
    static properties = { x: { type: Number } };
  }
  assert.throws(() => new MyWidget(), /MyWidget/);
});

test('does not throw for the factory form (bare constructor type)', () => {
  class Good extends WebComponent({ count: Number }) {
    constructor() {
      super();
      this.count = 0;
    }
  }
  const el = new Good();
  assert.equal(el.count, 0);
  el.count = 5;
  assert.equal(el.count, 5);
});

test('does not throw for the factory form with the prop() helper', () => {
  class Good extends WebComponent({ open: prop(Boolean, { reflect: true }) }) {}
  const el = new Good();
  // The reactive accessor exists (factory installed it).
  el.open = true;
  assert.equal(el.open, true);
});

test('does not throw for a plain component with no reactive properties', () => {
  class Plain extends WebComponent {
    render() {}
  }
  assert.doesNotThrow(() => new Plain());
});

test('does not throw for a subclass of a factory component', () => {
  class Base extends WebComponent({ count: Number }) {}
  class Sub extends Base {}
  assert.doesNotThrow(() => new Sub());
});

test('throws for a subclass that re-declares static properties', () => {
  class Base extends WebComponent({ count: Number }) {}
  class Sub extends Base {
    static properties = { extra: { type: String } };
  }
  assert.throws(() => new Sub(), /static properties/);
});
