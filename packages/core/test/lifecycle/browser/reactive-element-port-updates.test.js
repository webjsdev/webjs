/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Port of Lit's reactive-element suite to WebJs, part 4 of 4: `firstUpdated`,
 * properties set during `update()` and `updated()`, updateComplete timing,
 * scheduleUpdate overrides, properties set before upgrade, initializers,
 * exceptions, and customized observedAttributes.
 *
 * Upstream: lit/packages/reactive-element/src/test/reactive-element_test.ts
 * (lit commit b17fb144), lines 1966 to 2208 and 2880 to 3980. The translation
 * rules are listed in reactive-element-port-properties.test.js.
 *
 * Not ported (compile-time only, no runtime assertion):
 *   - "PropertyValues<this> type-checks"
 *   - "Maps can be used for changedProperties"
 *   - "PropertyValues<T> works with subtyping"
 *
 * Covered by lifecycle-port.test.js and not repeated here:
 *   - "setting properties in `updated` can await until updateComplete returns
 *     true" (its "updateComplete can be awaited in a loop until it returns
 *     true" is the same loop).
 *   - "update does not occur before element is connected".
 *
 * The `exceptions` suite is kept as skipped tests: WebJs gives every component
 * an error boundary (packages/core/AGENTS.md "Lit JavaScript API
 * compatibility", test/conformance/differences.json `diff-lit-model`), so a
 * throwing lifecycle hook is caught and logged and `updateComplete` resolves
 * instead of rejecting. The recovery half of each of those tests is covered by
 * the "does not deadlock" tests in lifecycle-port.test.js.
 */
import { WebComponent } from '../../../src/component.js';

import { assert } from '../../../../../test/browser-assert.js';

let __ctr = 0;
const tag = () => `re-port-upd-${++__ctr}`;

const ERROR_BOUNDARY = 'WebJs error boundary: a throwing lifecycle hook is caught and logged, and updateComplete resolves instead of rejecting';

/**
 * A Map's entries sorted by key. chai's `deepEqual` compares Maps without
 * regard to insertion order, and this helper's `deepEqual` does not, so a
 * Lit assertion that lists entries in another order is compared through this.
 * @param {Map<string, unknown>} map
 */
const byKey = (map) => [...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

suite('ReactiveElement port: updates (reactive-element_test.ts)', () => {
  let container;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  teardown(() => {
    if (container && container.parentNode) container.parentNode.removeChild(container);
  });

  test('`firstUpdated` called when element first updates', async () => {
    class E extends WebComponent {
      static properties = { foo: {} };
      wasUpdatedCount = 0;
      wasFirstUpdated = 0;
      changedProperties = undefined;
      constructor() { super(); this.foo = 1; }
      update(changedProperties) {
        this.wasUpdatedCount++;
        super.update(changedProperties);
      }
      firstUpdated(changedProperties) {
        this.changedProperties = changedProperties;
        this.wasFirstUpdated++;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    const testMap = new Map();
    testMap.set('foo', undefined);
    assert.deepEqual(el.changedProperties, testMap);
    assert.equal(el.wasUpdatedCount, 1);
    assert.equal(el.wasFirstUpdated, 1);
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(el.wasUpdatedCount, 2);
    assert.equal(el.wasFirstUpdated, 1);
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(el.wasUpdatedCount, 3);
    assert.equal(el.wasFirstUpdated, 1);
  });

  test('`firstUpdated` called when element first updates even if first `shouldUpdate` returned false', async () => {
    class E extends WebComponent {
      static properties = { foo: {} };
      triedToUpdatedCount = 0;
      wasUpdatedCount = 0;
      wasFirstUpdated = 0;
      changedProperties = undefined;
      constructor() { super(); this.foo = 1; }
      shouldUpdate() {
        this.triedToUpdatedCount++;
        return this.triedToUpdatedCount > 1;
      }
      update(changedProperties) {
        this.wasUpdatedCount++;
        super.update(changedProperties);
      }
      firstUpdated(changedProperties) {
        this.changedProperties = changedProperties;
        this.wasFirstUpdated++;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.triedToUpdatedCount, 1);
    assert.equal(el.wasUpdatedCount, 0);
    assert.equal(el.wasFirstUpdated, 0);
    el.requestUpdate();
    await el.updateComplete;
    assert.deepEqual(el.changedProperties, new Map());
    assert.equal(el.triedToUpdatedCount, 2);
    assert.equal(el.wasUpdatedCount, 1);
    assert.equal(el.wasFirstUpdated, 1);
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(el.triedToUpdatedCount, 3);
    assert.equal(el.wasUpdatedCount, 2);
    assert.equal(el.wasFirstUpdated, 1);
  });

  test('setting properties in update does not trigger update', async () => {
    class E extends WebComponent {
      static get properties() { return { foo: {} }; }
      updateCount = 0;
      updatedText = '';
      constructor() { super(); this.foo = 0; }
      update(props) {
        this.updateCount++;
        this.foo++;
        super.update(props);
      }
      updated() { this.updatedText = `${this.foo}`; }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.foo, 1);
    assert.equal(el.updateCount, 1);
    assert.equal(el.updatedText, '1');
    el.foo = 5;
    await el.updateComplete;
    assert.equal(el.foo, 6);
    assert.equal(el.updateCount, 2);
    assert.equal(el.updatedText, '6');
  });

  test('setting properties in update after calling `super.update` *does* trigger update', async () => {
    class E extends WebComponent {
      static get properties() { return { foo: {} }; }
      updateCount = 0;
      updatedText = '';
      constructor() { super(); this.foo = 0; }
      update(props) {
        this.updateCount++;
        super.update(props);
        if (this.foo < 1) this.foo++;
      }
      updated() { this.updatedText = `${this.foo}`; }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    while (!(await el.updateComplete)) { /* settle */ }
    assert.equal(el.foo, 1);
    assert.equal(el.updateCount, 2);
    assert.equal(el.updatedText, '1');
  });

  test('setting properties in update reflects to attribute and is included in `changedProperties`', async () => {
    class E extends WebComponent {
      static get properties() { return { foo: {}, bar: {}, zot: { reflect: true } }; }
      changedProperties = undefined;
      update(changedProperties) {
        this.zot = this.foo + this.bar;
        super.update(changedProperties);
        this.changedProperties = changedProperties;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    const testMap = new Map();
    testMap.set('zot', undefined);
    assert.deepEqual(byKey(el.changedProperties), byKey(testMap));
    assert.isNaN(el.zot);
    assert.equal(el.getAttribute('zot'), 'NaN');
    el.bar = 1;
    el.foo = 1;
    await el.updateComplete;
    assert.equal(el.foo, 1);
    assert.equal(el.bar, 1);
    assert.equal(el.zot, 2);
    testMap.clear();
    testMap.set('foo', undefined);
    testMap.set('bar', undefined);
    testMap.set('zot', NaN);
    assert.deepEqual(byKey(el.changedProperties), byKey(testMap));
    assert.equal(el.getAttribute('zot'), '2');
    el.bar = 2;
    await el.updateComplete;
    assert.equal(el.bar, 2);
    assert.equal(el.zot, 3);
    testMap.clear();
    testMap.set('bar', 1);
    testMap.set('zot', 2);
    assert.deepEqual(byKey(el.changedProperties), byKey(testMap));
    assert.equal(el.getAttribute('zot'), '3');
  });

  test('setting properties in `updated` does trigger update and does not block updateComplete', async () => {
    class E extends WebComponent {
      static get properties() { return { foo: {} }; }
      updateCount = 0;
      fooMax = 2;
      constructor() { super(); this.foo = 0; }
      update(changed) {
        this.updateCount++;
        super.update(changed);
      }
      updated() {
        if (this.foo < this.fooMax) this.foo++;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    let result = await el.updateComplete;
    assert.isFalse(result);
    assert.equal(el.foo, 1);
    assert.equal(el.updateCount, 1);
    result = await el.updateComplete;
    assert.isFalse(result);
    assert.equal(el.foo, 2);
    assert.equal(el.updateCount, 2);
    result = await el.updateComplete;
    assert.isTrue(result);
  });

  test('`updateComplete` can block properties set in `updated`', async () => {
    class E extends WebComponent {
      static get properties() { return { foo: {} }; }
      updateCount = 0;
      fooMax = 10;
      constructor() { super(); this.foo = 1; }
      update(changed) {
        this.updateCount++;
        super.update(changed);
      }
      updated() {
        if (this.foo < this.fooMax) this.foo++;
      }
      get updateComplete() {
        return super.updateComplete.then((v) => v || this.updateComplete);
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    const result = await el.updateComplete;
    assert.isTrue(result);
    assert.equal(el.foo, 10);
    assert.equal(el.updateCount, 10);
  });

  test('can await promise in `updateComplete`', async () => {
    class E extends WebComponent {
      static get properties() { return { foo: {} }; }
      promiseFulfilled = false;
      get updateComplete() {
        return (async () => {
          return (
            (await super.updateComplete) &&
            (await new Promise((resolve) => {
              setTimeout(() => {
                this.promiseFulfilled = true;
                resolve(true);
              }, 1);
            }))
          );
        })();
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    const result = await el.updateComplete;
    assert.isTrue(result);
    assert.isTrue(el.promiseFulfilled);
  });

  test('can await sub-element `updateComplete`', async () => {
    class E extends WebComponent {
      static get properties() { return { foo: {} }; }
      promiseFulfilled = false;
      updatedText = '';
      constructor() { super(); this.foo = 'hi'; }
      get updateComplete() {
        return super.updateComplete.then(
          () =>
            new Promise((resolve) =>
              setTimeout(() => {
                this.promiseFulfilled = true;
                resolve(true);
              }, 1),
            ),
        );
      }
      updated() { this.updatedText = this.foo; }
    }
    const inner = tag();
    customElements.define(inner, E);

    class F extends WebComponent {
      inner = null;
      firstUpdated() {
        this.inner = document.createElement(inner);
        this.renderRoot.appendChild(this.inner);
      }
      get updateComplete() {
        return super.updateComplete.then(() => {
          this.inner.foo = 'yo';
          return this.inner.updateComplete;
        });
      }
    }
    customElements.define(tag(), F);
    const el = new F();
    container.appendChild(el);
    const result = await el.updateComplete;
    assert.isTrue(result);
    assert.equal(el.inner.updatedText, 'yo');
    assert.isTrue(el.inner.promiseFulfilled);
  });

  test('properties set before upgrade are applied', async () => {
    let changedProperties = undefined;
    class E extends WebComponent {
      static get properties() { return { foo: {}, bar: {}, zug: {} }; }
      constructor() {
        super();
        this.foo = '';
        this.bar = true;
        this.zug = null;
      }
      update(properties) {
        super.update(properties);
        changedProperties = properties;
      }
    }
    const name = tag();
    const el = document.createElement(name);
    container.appendChild(el);

    // Set properties before the element is defined.
    const objectValue = {};
    el.foo = 'hi';
    el.bar = false;
    el.zug = objectValue;

    customElements.define(name, E);
    await el.updateComplete;

    // Properties should have the pre-upgraded values.
    assert.equal(el.foo, 'hi');
    assert.equal(el.bar, false);
    assert.equal(el.zug, objectValue);
    assert.isTrue(changedProperties.has('foo'));

    // Check that the element is still reactive.
    changedProperties = undefined;
    el.foo = 'bye';
    await el.updateComplete;
    assert.isTrue(changedProperties.has('foo'));
  });

  test('can override scheduleUpdate()', async () => {
    let resolve;
    class A extends WebComponent {
      scheduleUpdateCalled = false;
      updateCalled = false;
      async scheduleUpdate() {
        this.scheduleUpdateCalled = true;
        await new Promise((r) => (resolve = r));
        await super.scheduleUpdate();
      }
      update(changedProperties) {
        this.updateCalled = true;
        super.update(changedProperties);
      }
    }
    customElements.define(tag(), A);
    const a = new A();
    container.appendChild(a);

    // update is not called synchronously
    assert.isFalse(a.updateCalled);
    // update is not called after a microtask
    await 0;
    assert.isFalse(a.updateCalled);
    // update is not called after a small amount of time
    await new Promise((r) => setTimeout(r, 10));
    assert.isFalse(a.updateCalled);
    // update is called after scheduleUpdate allowed to complete
    resolve();
    await a.updateComplete;
    assert.isTrue(a.updateCalled);
  });

  test('overriding scheduleUpdate() allows nested invalidations', async () => {
    class A extends WebComponent {
      scheduleUpdateCalledCount = 0;
      updatedCalledCount = 0;
      async scheduleUpdate() {
        this.scheduleUpdateCalledCount++;
        await new Promise((r) => setTimeout(r));
        super.scheduleUpdate();
      }
      updated() {
        this.updatedCalledCount++;
        // trigger a nested invalidation just once
        if (this.updatedCalledCount === 1) this.requestUpdate();
      }
    }
    customElements.define(tag(), A);
    const a = new A();
    container.appendChild(a);
    assert.equal(a.updatedCalledCount, 0);

    const updateComplete1 = a.updateComplete;
    await updateComplete1;
    assert.equal(a.updatedCalledCount, 1);
    assert.equal(a.scheduleUpdateCalledCount, 1);

    const updateComplete2 = a.updateComplete;
    assert.notStrictEqual(updateComplete1, updateComplete2);

    await updateComplete2;
    assert.equal(a.updatedCalledCount, 2);
    assert.equal(a.scheduleUpdateCalledCount, 2);
  });

  test('early access of updateComplete waits until first update', async () => {
    class A extends WebComponent {
      didUpdate = false;
      updated() { this.didUpdate = true; }
    }
    customElements.define(tag(), A);
    const a = new A();
    let updated = false;
    a.updateComplete.then(() => {
      updated = true;
      assert.isTrue(a.didUpdate);
    });
    await new Promise((r) => setTimeout(r, 20));
    assert.isFalse(updated);
    container.appendChild(a);
    await a.updateComplete;
    assert.isTrue(updated);
  });

  test('property reflects after setting attribute in same update cycle', async () => {
    class A extends WebComponent {
      static get properties() {
        return { foo: { type: Boolean, reflect: true }, bar: { type: String, reflect: true } };
      }
    }
    customElements.define(tag(), A);
    const a = new A();
    container.appendChild(a);
    a.setAttribute('foo', '');
    a.removeAttribute('foo');
    a.foo = true;
    await a.updateComplete;
    assert.isTrue(a.hasAttribute('foo'));
    a.setAttribute('bar', 'hi');
    a.bar = 'yo';
    await a.updateComplete;
    assert.equal(a.getAttribute('bar'), 'yo');
  });

  suite('initializers', () => {
    class Base extends WebComponent {}
    Base.addInitializer((a) => {
      a.prop1 = 'prop1';
    });
    Base.addInitializer((a) => {
      a.prop2 = 'prop2';
    });
    Base.addInitializer((a) => {
      a.addEventListener('click', (e) => (a.event = e.type));
    });
    customElements.define(tag(), Base);

    test('addInitializer', () => {
      const a = new Base();
      container.appendChild(a);
      assert.equal(a.prop1, 'prop1');
      assert.equal(a.prop2, 'prop2');
      a.dispatchEvent(new Event('click'));
      assert.equal(a.event, 'click');
    });

    class Sub extends Base {}
    Sub.addInitializer((a) => {
      a.prop3 = 'prop3';
    });
    customElements.define(tag(), Sub);

    test('addInitializer on subclass', () => {
      const s = new Sub();
      container.appendChild(s);
      assert.equal(s.prop1, 'prop1');
      assert.equal(s.prop2, 'prop2');
      assert.equal(s.prop3, 'prop3');
      s.dispatchEvent(new Event('click'));
      assert.equal(s.event, 'click');
    });

    test('addInitializer on subclass independent from superclass', () => {
      const b = new Base();
      container.appendChild(b);
      assert.notOk(b.prop3);
    });
  });

  suite('exceptions', () => {
    test.skip(`exceptions in \`update\` do not prevent further updates (${ERROR_BOUNDARY})`, () => {});
    test.skip(`exceptions in \`update\` prevent \`firstUpdated\` and \`updated\` from being called (${ERROR_BOUNDARY}, and the boundary commits renderError() and runs the post-commit hooks)`, () => {});
    test.skip(`exceptions in \`shouldUpdate\` do not prevent further updates (${ERROR_BOUNDARY})`, () => {});
    test.skip(`exceptions in \`updated\` do not prevent further or reentrant updates (${ERROR_BOUNDARY})`, () => {});
    test.skip(`exceptions in \`performUpdate\` do not prevent further updates (${ERROR_BOUNDARY})`, () => {});
    test.skip(`exceptions in the update cycle are visible via window event (${ERROR_BOUNDARY}; reported with console.error, not as an unhandledrejection)`, () => {});
  });

  suite('customizing observedAttributes', () => {
    test('does not interfere with properties', () => {
      class E extends WebComponent {
        static properties = { foo: {}, bar: {} };
        static get observedAttributes() {
          // Note, `finalize` must be called when not supering to observedAttributes
          this.finalize();
          return ['custom'];
        }
      }
      assert.doesNotThrow(() => {
        customElements.define(tag(), E);
      });
      const el = new E();
      container.appendChild(el);
      const ctor = el.constructor;
      assert.deepEqual(ctor.observedAttributes, ['custom']);
      assert.deepEqual(Array.from(ctor.elementProperties.keys()), ['foo', 'bar']);
    });

    test('using super on base class', () => {
      class E extends WebComponent {
        static get observedAttributes() {
          return ['foo', ...super.observedAttributes];
        }
      }
      assert.doesNotThrow(() => {
        customElements.define(tag(), E);
      });
      const el = new E();
      container.appendChild(el);
      assert.deepEqual(el.constructor.observedAttributes, ['foo']);
    });

    test('using superclass properties', () => {
      class S extends WebComponent {
        static properties = { foo: {}, bar: {} };
      }
      class E extends S {
        static get observedAttributes() {
          return ['custom', ...super.observedAttributes];
        }
      }
      assert.doesNotThrow(() => {
        customElements.define(tag(), E);
      });
      const el = new E();
      container.appendChild(el);
      assert.deepEqual(el.constructor.observedAttributes, ['custom', 'foo', 'bar']);
    });

    /**
     * Lit's `MyMixin`, in its two spellings: reading the superclass's list
     * through `super.observedAttributes`, or straight off `superclass`.
     */
    function myMixin(superclass, direct) {
      return class E extends superclass {
        static get observedAttributes() {
          const inherited = direct ? superclass.observedAttributes : super.observedAttributes;
          return [...(inherited ?? []), 'custom'];
        }
        constructor(...a) {
          super(...a);
        }
        attrValue = '';
        attributeChangedCallback(name, oldVal, newVal) {
          const observed = direct ? superclass.observedAttributes : super.constructor.observedAttributes;
          if (!observed?.includes?.(name)) this.attrValue = name;
          super.attributeChangedCallback?.(name, oldVal, newVal);
        }
      };
    }

    test('using mixin, calling super.observedAttributes', () => {
      const E = myMixin(WebComponent, false);
      assert.doesNotThrow(() => {
        customElements.define(tag(), E);
      });
      const el = new E();
      container.appendChild(el);
      assert.deepEqual(el.constructor.observedAttributes, ['custom']);

      class F extends WebComponent {
        static properties = { foo: {}, bar: {} };
      }
      const FE = myMixin(F, false);
      assert.doesNotThrow(() => {
        customElements.define(tag(), FE);
      });
      const el2 = new FE();
      container.appendChild(el2);
      const ctor = el2.constructor;
      assert.deepEqual(ctor.observedAttributes, ['foo', 'bar', 'custom']);
      assert.deepEqual(Array.from(ctor.elementProperties.keys()), ['foo', 'bar']);
      el2.setAttribute('custom', 'custom');
      assert.equal(el2.attrValue, 'custom');
      el2.setAttribute('foo', 'foo');
      assert.equal(el2.attrValue, 'custom');

      class GE extends FE {
        static properties = { zot: {}, nug: {} };
      }
      assert.doesNotThrow(() => {
        customElements.define(tag(), GE);
      });
      const el3 = new GE();
      container.appendChild(el3);
      const ctor3 = el3.constructor;
      assert.deepEqual(ctor3.observedAttributes, ['foo', 'bar', 'zot', 'nug', 'custom']);
      assert.deepEqual(Array.from(ctor3.elementProperties.keys()), ['foo', 'bar', 'zot', 'nug']);
      el3.setAttribute('custom', 'custom');
      assert.equal(el3.attrValue, 'custom');
      el3.setAttribute('foo', 'foo');
      assert.equal(el3.attrValue, 'custom');
    });

    test('using mixin, calling superclass.observedAttributes directly', () => {
      const E = myMixin(WebComponent, true);
      assert.doesNotThrow(() => {
        customElements.define(tag(), E);
      });
      const el = new E();
      container.appendChild(el);
      assert.deepEqual(el.constructor.observedAttributes, ['custom']);

      class F extends WebComponent {
        static properties = { foo: {}, bar: {} };
      }
      const FE = myMixin(F, true);
      assert.doesNotThrow(() => {
        customElements.define(tag(), FE);
      });
      const el2 = new FE();
      container.appendChild(el2);
      const ctor2 = el2.constructor;
      assert.deepEqual(ctor2.observedAttributes, ['foo', 'bar', 'custom']);
      assert.deepEqual(Array.from(ctor2.elementProperties.keys()), ['foo', 'bar']);
      el2.setAttribute('custom', 'custom');
      assert.equal(el2.attrValue, 'custom');
      el2.setAttribute('foo', 'foo');
      assert.equal(el2.attrValue, 'custom');
    });
  });
});
