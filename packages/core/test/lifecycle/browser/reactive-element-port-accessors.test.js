/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Port of Lit's reactive-element suite to WebJs, part 3 of 4: updates driven
 * by properties and attributes, user-defined accessors, `noAccessor`, and
 * `createProperty` / `getPropertyDescriptor` customization.
 *
 * Upstream: lit/packages/reactive-element/src/test/reactive-element_test.ts
 * (lit commit b17fb144), lines 1663 to 1964 and 2210 to 2878; lines 1966 to
 * 2208 (`firstUpdated` and properties set during `update()`) are in
 * reactive-element-port-updates.test.js. The translation rules are listed in
 * reactive-element-port-properties.test.js.
 *
 * Covered by lifecycle-port.test.js and not repeated here:
 *   - "update lifecycle order" (its port asserts the same order plus the
 *     controller hooks).
 */
import { WebComponent } from '../../../src/component.js';

import { assert } from '../../../../../test/browser-assert.js';

let __ctr = 0;
const tag = () => `re-port-acc-${++__ctr}`;

/** Lit's `defaultConverter`, which its "default property declaration" test delegates to. */
const defaultConverter = {
  toAttribute(value, type) {
    switch (type) {
      case Boolean: return value ? '' : null;
      case Object:
      case Array: return value == null ? value : JSON.stringify(value);
    }
    return value;
  },
  fromAttribute(value, type) {
    switch (type) {
      case Boolean: return value !== null;
      case Number: return value === null ? null : Number(value);
      case Object:
      case Array:
        try { return JSON.parse(value); } catch { return null; }
    }
    return value;
  },
};

suite('ReactiveElement port: accessors and updates (reactive-element_test.ts)', () => {
  let container;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  teardown(() => {
    if (container && container.parentNode) container.parentNode.removeChild(container);
  });

  test('updates when properties change', async () => {
    class E extends WebComponent {
      static get properties() { return { foo: {} }; }
      updatedText = '';
      constructor() { super(); this.foo = 'one'; }
      updated() { this.updatedText = `${this.foo}`; }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.updatedText, 'one');
    el.foo = 'changed';
    await el.updateComplete;
    assert.equal(el.updatedText, 'changed');
  });

  test('updates when properties and attributes change', async () => {
    class E extends WebComponent {
      static get properties() { return { value: {}, attrValue: {} }; }
      updateCountValue = '';
      updateCountAttrValue = '';
      constructor() { super(); this.value = '1'; this.attrValue = 'attr'; }
      update(props) {
        super.update(props);
        this.updateCountValue = this.value;
        this.updateCountAttrValue = this.attrValue;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.updateCountValue, '1');
    assert.equal(el.updateCountAttrValue, 'attr');
    el.value = '2';
    await el.updateComplete;
    assert.equal(el.updateCountValue, '2');
    assert.equal(el.updateCountAttrValue, 'attr');
    el.attrValue = 'attr2';
    await el.updateComplete;
    assert.equal(el.updateCountValue, '2');
    assert.equal(el.updateCountAttrValue, 'attr2');
    el.setAttribute('attrvalue', 'attr3');
    await el.updateComplete;
    assert.equal(el.updateCountValue, '2');
    assert.equal(el.updateCountAttrValue, 'attr3');
    el.value = '3';
    el.setAttribute('attrvalue', 'attr4');
    await el.updateComplete;
    assert.equal(el.updateCountValue, '3');
    assert.equal(el.updateCountAttrValue, 'attr4');
  });

  test('updates changes when attributes change', async () => {
    class E extends WebComponent {
      static get properties() { return { foo: {} }; }
      updatedText = '';
      constructor() { super(); this.foo = 'one'; }
      updated() { this.updatedText = `${this.foo}`; }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.updatedText, 'one');
    el.setAttribute('foo', 'changed');
    await el.updateComplete;
    assert.equal(el.updatedText, 'changed');
  });

  test('updates when disconnected', async () => {
    let updateCount = 0;
    class E extends WebComponent {
      updated() { updateCount++; }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(updateCount, 1);
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(updateCount, 2);

    container.removeChild(el);
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(updateCount, 3);
    container.appendChild(el);
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(updateCount, 4);
  });

  test('User defined accessor can trigger update', async () => {
    class E extends WebComponent {
      updatedText = '';
      static get properties() { return { foo: {}, bar: {} }; }
      constructor() { super(); this.foo = 0; }
      get bar() { return this.__bar; }
      set bar(value) { this.__bar = Number(value); }
      updated() { this.updatedText = `${this.foo}${this.bar}`; }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    el.setAttribute('bar', '20');
    await el.updateComplete;
    assert.equal(el.bar, 20);
    assert.equal(el.__bar, 20);
    assert.equal(el.updatedText, '020');
  });

  test('User defined accessor can use property options via `requestUpdate`', async () => {
    const fromAttribute = (value) => parseInt(value);
    const toAttribute = (value) => `${value}-attr`;
    const hasChanged = (value, old) => isNaN(old) || value > old;
    class E extends WebComponent {
      updateCount = 0;
      static get properties() {
        return {
          bar: { attribute: 'attr-bar', reflect: true, converter: { fromAttribute, toAttribute }, hasChanged },
        };
      }
      constructor() { super(); this.bar = 5; }
      update(changed) { super.update(changed); this.updateCount++; }
      get bar() { return this.__bar; }
      set bar(value) { this.__bar = Number(value); }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.updateCount, 1);
    assert.equal(el.bar, 5);
    assert.equal(el.getAttribute('attr-bar'), `5-attr`);
    el.setAttribute('attr-bar', '7');
    await el.updateComplete;
    assert.equal(el.updateCount, 2);
    assert.equal(el.bar, 7);
    assert.equal(el.getAttribute('attr-bar'), `7`);
    el.bar = 4;
    await el.updateComplete;
    assert.equal(el.updateCount, 2);
    assert.equal(el.bar, 4);
    assert.equal(el.getAttribute('attr-bar'), `7`);
    el.setAttribute('attr-bar', '3');
    await el.updateComplete;
    assert.equal(el.updateCount, 2);
    assert.equal(el.bar, 3);
    assert.equal(el.getAttribute('attr-bar'), `3`);
  });

  test('User defined accessor not overwritten by subclass, but subclass property options respected', async () => {
    class E extends WebComponent {
      static get properties() { return { bar: { hasChanged: () => false }, foo: {} }; }
      get foo() { return this.__foo; }
      set foo(value) { this.__foo = Number(value); }
    }
    class F extends E {
      static get properties() { return { bar: {}, foo: { reflect: true } }; }
      get bar() { return this.__bar; }
      set bar(value) { this.__bar = value; }
    }
    let changed = 0;
    const hasChanged = () => {
      changed++;
      return true;
    };
    class G extends F {
      static get properties() { return { bar: { hasChanged, reflect: true }, foo: { hasChanged } }; }
    }
    customElements.define(tag(), G);
    const el = new G();
    container.appendChild(el);
    el.foo = 20;
    await el.updateComplete;
    assert.equal(changed, 1);
    assert.equal(el.foo, 20);
    assert.isFalse(el.hasAttribute('foo'));
    el.bar = 'hi';
    await el.updateComplete;
    assert.equal(changed, 2);
    assert.equal(el.bar, 'hi');
    assert.isTrue(el.hasAttribute('bar'));
  });

  test('Internal storage for `@property` does not collide with other properties', async () => {
    let changed = 0;
    const hasChanged = () => {
      changed++;
      return true;
    };
    class E extends WebComponent {
      static get properties() { return { foo: { hasChanged } }; }
      constructor() {
        super();
        this.foo = 111;
        this.__foo = 222;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    el.foo = 333;
    await el.updateComplete;
    assert.equal(changed, 2);
    assert.equal(el.foo, 333);
    assert.equal(el.__foo, 222);
  });

  test('can make properties for native accessors', async () => {
    class E extends WebComponent {
      static get properties() {
        return { id: { reflect: true }, name: { reflect: true }, title: { reflect: true }, foo: {} };
      }
      updatedText = '';
      changedProperties = undefined;
      constructor() { super(); this.foo = ''; }
      update(changedProperties) {
        this.zot = this.foo + this.bar;
        super.update(changedProperties);
        this.changedProperties = changedProperties;
      }
      updated() { this.updatedText = `${this.id}-${this.title}-${this.foo}`; }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    el.foo = 'foo';
    el.id = 'id';
    el.title = 'title';
    await el.updateComplete;
    assert.equal(el.updatedText, 'id-title-foo');
    assert.equal(window.id, el);
    assert.equal(el.getAttribute('id'), 'id');
    el.id = 'id2';
    await el.updateComplete;
    assert.equal(el.updatedText, 'id2-title-foo');
    assert.equal(window.id2, el);
    assert.equal(el.getAttribute('id'), 'id2');
  });

  test('user accessors', async () => {
    class E extends WebComponent {
      _updateCount = 0;
      updatedText = '';
      static get properties() {
        return { foo: { type: String, reflect: true }, bar: { type: String, reflect: true } };
      }
      constructor() {
        super();
        this.foo = 'defaultFoo';
        this.bar = 'defaultBar';
      }
      set foo(value) {
        const old = this._foo;
        this._foo = value;
        this.requestUpdate('foo', old);
      }
      get foo() { return this._foo; }
      set bar(value) {
        const old = this._bar;
        this._bar = value;
        this.requestUpdate('bar', old);
      }
      get bar() { return this._bar; }
      update(changedProperties) {
        this._updateCount++;
        super.update(changedProperties);
      }
      updated() { this.updatedText = `${this.foo}-${this.bar}`; }
    }
    customElements.define(tag(), E);

    const el = new E();
    el.foo = 'foo1';
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.foo, 'foo1');
    assert.equal(el.bar, 'defaultBar');
    assert.equal(el.getAttribute('foo'), 'foo1');
    assert.equal(el.getAttribute('bar'), 'defaultBar');
    assert.equal(el.updatedText, 'foo1-defaultBar');
    assert.equal(el._updateCount, 1);

    el.foo = 'foo2';
    el.bar = 'bar';
    await el.updateComplete;
    assert.equal(el.foo, 'foo2');
    assert.equal(el.bar, 'bar');
    assert.equal(el.getAttribute('foo'), 'foo2');
    assert.equal(el.getAttribute('bar'), 'bar');
    assert.equal(el.updatedText, 'foo2-bar');
    assert.equal(el._updateCount, 2);

    el.foo = 'foo3';
    await el.updateComplete;
    assert.equal(el.foo, 'foo3');
    assert.equal(el.getAttribute('foo'), 'foo3');
    assert.equal(el.getAttribute('bar'), 'bar');
    assert.equal(el.updatedText, 'foo3-bar');
    assert.equal(el._updateCount, 3);
  });

  /** Lit's `Sup`: an accessor that clamps to a maximum of 10 in the setter. */
  function supClass() {
    return class Sup extends WebComponent {
      updatedText = '';
      static get properties() { return { foo: { type: Number } }; }
      constructor() { super(); this.foo = 0; }
      set foo(v) {
        this._supSetCount = (this._supSetCount || 0) + 1;
        const old = this.foo;
        this._foo = Math.min(v, 10);
        this.requestUpdate('foo', old);
      }
      get foo() { return this._foo; }
      update(changedProperties) {
        this._oldFoo = changedProperties.get('foo');
        super.update(changedProperties);
      }
      updated() { this.updatedText = `${this.foo}`; }
    };
  }

  test('user accessors can be extended', async () => {
    const Sup = supClass();
    customElements.define(tag(), Sup);
    // Sub implements an accessor that rounds down in the getter.
    class Sub extends Sup {
      static get properties() { return { foo: { type: Number } }; }
      set foo(v) {
        this._subSetCount = (this._subSetCount || 0) + 1;
        super.foo = v;
      }
      get foo() {
        const v = super.foo;
        return v ? Math.floor(v) : v;
      }
    }
    customElements.define(tag(), Sub);

    const sup = new Sup();
    container.appendChild(sup);
    await sup.updateComplete;
    assert.equal(sup.foo, 0);
    assert.equal(sup._oldFoo, undefined);
    assert.equal(sup._supSetCount, 1);
    assert.equal(sup.updatedText, '0');

    sup.foo = 5;
    await sup.updateComplete;
    assert.equal(sup.foo, 5);
    assert.equal(sup._oldFoo, 0);
    assert.equal(sup._supSetCount, 2);
    assert.equal(sup.updatedText, '5');

    sup.foo = 20;
    await sup.updateComplete;
    assert.equal(sup.foo, 10);
    assert.equal(sup._oldFoo, 5);
    assert.equal(sup._supSetCount, 3);
    assert.equal(sup.updatedText, '10');

    sup.foo = 5;
    await sup.updateComplete;
    assert.equal(sup.foo, 5);
    assert.equal(sup._oldFoo, 10);
    assert.equal(sup._supSetCount, 4);
    assert.equal(sup.updatedText, '5');

    const sub = new Sub();
    container.appendChild(sub);
    await sub.updateComplete;
    assert.equal(sub.foo, 0);
    assert.equal(sub._oldFoo, undefined);
    assert.equal(sub._supSetCount, 1);
    assert.equal(sub._subSetCount, 1);
    assert.equal(sub.updatedText, '0');

    sub.foo = 5;
    await sub.updateComplete;
    assert.equal(sub.foo, 5);
    assert.equal(sub._oldFoo, 0);
    assert.equal(sub._supSetCount, 2);
    assert.equal(sub._subSetCount, 2);
    assert.equal(sub.updatedText, '5');

    sub.foo = 7.5;
    await sub.updateComplete;
    assert.equal(sub.foo, 7);
    assert.equal(sub._oldFoo, 5);
    assert.equal(sub._supSetCount, 3);
    assert.equal(sub._subSetCount, 3);
    assert.equal(sub.updatedText, '7');

    sub.foo = 20;
    await sub.updateComplete;
    assert.equal(sub.foo, 10);
    assert.equal(sub._oldFoo, 7);
    assert.equal(sub._supSetCount, 4);
    assert.equal(sub._subSetCount, 4);
    assert.equal(sub.updatedText, '10');
  });

  test('Using `noAccessor` to set property options for extended user accessors', async () => {
    const Sup = supClass();
    customElements.define(tag(), Sup);
    class Sub extends Sup {
      static get properties() { return { foo: { type: Number, reflect: true, noAccessor: true } }; }
    }
    customElements.define(tag(), Sub);

    const sub = new Sub();
    container.appendChild(sub);
    await sub.updateComplete;
    assert.equal(sub.foo, 0);
    assert.equal(sub._oldFoo, undefined);
    assert.equal(sub._supSetCount, 1);
    assert.equal(sub.updatedText, '0');

    sub.foo = 5;
    await sub.updateComplete;
    assert.equal(sub.foo, 5);
    assert.equal(sub._oldFoo, 0);
    assert.equal(sub._supSetCount, 2);
    assert.equal(sub.updatedText, '5');
    assert.equal(sub.getAttribute('foo'), '5');
  });

  test('can provide a default property declaration', async () => {
    const SpecialNumber = {};
    const myPropertyDeclaration = {
      type: SpecialNumber,
      reflect: true,
      converter: {
        toAttribute(value, type) {
          switch (type) {
            case String: return value === undefined ? null : value;
            default: return defaultConverter.toAttribute(value, type);
          }
        },
        fromAttribute(value, type) {
          switch (type) {
            case SpecialNumber: return Number(value) + 10;
            default: return defaultConverter.fromAttribute(value, type);
          }
        },
      },
    };
    class E extends WebComponent {
      static createProperty(name, options) {
        // Always mix into defaults to preserve custom converter.
        options = Object.assign(Object.create(myPropertyDeclaration), options);
        super.createProperty(name, options);
      }
      static properties = { foo: {}, bar: { type: String } };
      constructor() { super(); this.foo = 5; this.bar = 'bar'; }
    }
    customElements.define(tag(), E);

    const el = new E();
    container.appendChild(el);
    el.setAttribute('foo', '10');
    el.setAttribute('bar', 'attrBar');
    await el.updateComplete;
    assert.equal(el.foo, 20);
    assert.equal(el.bar, 'attrBar');
    el.foo = 5;
    el.bar = undefined;
    await el.updateComplete;
    assert.equal(el.getAttribute('foo'), '5');
    assert.isFalse(el.hasAttribute('bar'));
  });

  test('can customize property options and accessor creation', async () => {
    class E extends WebComponent {
      static getPropertyDescriptor(name, key, options) {
        const defaultDescriptor = super.getPropertyDescriptor(name, key, options);
        return {
          get: defaultDescriptor.get,
          set(value) {
            const oldValue = this[name];
            if (options.validator) value = options.validator(value);
            this[key] = value;
            this.requestUpdate(name, oldValue);
          },
          configurable: defaultDescriptor.configurable,
          enumerable: defaultDescriptor.enumerable,
        };
      }
      updated(changedProperties) {
        super.updated(changedProperties);
        changedProperties.forEach((value, key) => {
          const options = this.constructor.getPropertyOptions(key);
          const observer = options.observer;
          if (typeof observer === 'function') observer.call(this, value);
        });
      }
      constructor() {
        super();
        this.foo = 5;
        this.bar = 'bar';
        this.zot = '';
        this.zot2 = '';
        this.foo2 = 5;
      }
      static properties = {
        foo: { type: Number, validator: (value) => Math.min(10, Math.max(value, 0)) },
        bar: {},
        zot: {
          observer: function (oldValue) {
            this._observedZot = { value: this.zot, oldValue };
          },
        },
        zot2: {
          observer: function (oldValue) {
            this._observedZot2 = { value: this.zot2, oldValue };
          },
        },
        foo2: { type: Number, validator: (value) => Math.min(10, Math.max(value, 0)) },
      };
    }
    customElements.define(tag(), E);

    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    el.foo = 20;
    el.foo2 = 20;
    assert.equal(el.foo, 10);
    assert.equal(el.foo2, 10);
    assert.deepEqual(el._observedZot, { value: '', oldValue: undefined });
    assert.deepEqual(el._observedZot2, { value: '', oldValue: undefined });
    el.foo = -5;
    el.foo2 = -5;
    assert.equal(el.foo, 0);
    assert.equal(el.foo2, 0);
    el.bar = 'bar2';
    assert.equal(el.bar, 'bar2');
    el.zot = 'zot';
    el.zot2 = 'zot';
    await el.updateComplete;
    assert.deepEqual(el._observedZot, { value: 'zot', oldValue: '' });
    assert.deepEqual(el._observedZot2, { value: 'zot', oldValue: '' });
  });

  test('can customize properties to update synchronously', async () => {
    class E extends WebComponent {
      static getPropertyDescriptor(name, key, options) {
        const defaultDescriptor = super.getPropertyDescriptor(name, key, options);
        const setter = defaultDescriptor.set;
        return Object.assign(defaultDescriptor, {
          set(value) {
            setter.call(this, value);
            if (options.sync && this.hasUpdated && !this.isUpdating) this.performUpdate();
          },
        });
      }
      isUpdating = false;
      updateCount = 0;
      performUpdate() {
        this.isUpdating = true;
        super.performUpdate();
        this.isUpdating = false;
      }
      update(changedProperties) {
        this.zug = this.foo + 1;
        super.update(changedProperties);
      }
      updated() { this.updateCount++; }
      static properties = {
        foo: { type: Number, sync: true, reflect: true },
        zug: { type: Number, sync: true },
        bar: {},
      };
      constructor() {
        super();
        this.foo = 5;
        this.zug = this.foo;
        this.bar = 'bar';
      }
    }
    customElements.define(tag(), E);

    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    el.foo = 10;
    assert.equal(el.updateCount, 2);
    el.foo = 1;
    el.foo = 2;
    assert.equal(el.updateCount, 4);
    el.foo = 3;
    await el.updateComplete;
    assert.equal(el.updateCount, 5);
    el.bar = 'bar2';
    assert.equal(el.updateCount, 5);
    await el.updateComplete;
    assert.equal(el.updateCount, 6);
    el.foo = 5;
    assert.equal(el.updateCount, 7);
    el.zug = 60;
    assert.equal(el.updateCount, 8);
  });

  /** Lit's attribute-backed `foo` / `bar` element, with or without its own requestUpdate calls. */
  function attributeStoredClass(callsRequestUpdate) {
    return class E extends WebComponent {
      _updateCount = 0;
      updatedText = '';
      static get properties() { return { foo: { type: String }, bar: { type: String } }; }
      set foo(value) {
        this.setAttribute('foo', value);
        if (callsRequestUpdate) this.requestUpdate();
      }
      get foo() { return this.getAttribute('foo') || 'defaultFoo'; }
      set bar(value) {
        this.setAttribute('bar', value);
        if (callsRequestUpdate) this.requestUpdate();
      }
      get bar() { return this.getAttribute('bar') || 'defaultBar'; }
      update(changedProperties) {
        this._updateCount++;
        super.update(changedProperties);
      }
      updated() { this.updatedText = `${this.foo}-${this.bar}`; }
    };
  }

  /** The assertions both attribute-backed tests share. */
  async function assertAttributeStorage(E) {
    const el = new E();
    el.foo = 'foo1';
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.foo, 'foo1');
    assert.equal(el.bar, 'defaultBar');
    assert.equal(el.updatedText, 'foo1-defaultBar');
    assert.equal(el._updateCount, 1);

    el.foo = 'foo2';
    el.bar = 'bar';
    await el.updateComplete;
    assert.equal(el.foo, 'foo2');
    assert.equal(el.bar, 'bar');
    assert.equal(el.getAttribute('foo'), 'foo2');
    assert.equal(el.getAttribute('bar'), 'bar');
    assert.equal(el.updatedText, 'foo2-bar');
    assert.equal(el._updateCount, 2);

    el.foo = 'foo3';
    await el.updateComplete;
    assert.equal(el.foo, 'foo3');
    assert.equal(el.getAttribute('foo'), 'foo3');
    assert.equal(el.getAttribute('bar'), 'bar');
    assert.equal(el.updatedText, 'foo3-bar');
    assert.equal(el._updateCount, 3);
  }

  test('attribute-based property storage', async () => {
    const E = attributeStoredClass(true);
    customElements.define(tag(), E);
    await assertAttributeStorage(E);
  });

  test('attributeChangedCallback-based updating', async () => {
    class E extends attributeStoredClass(false) {
      attributeChangedCallback(name, old, value) {
        super.attributeChangedCallback(name, old, value);
        this.requestUpdate(name, old);
      }
    }
    customElements.define(tag(), E);
    await assertAttributeStorage(E);
  });
});
