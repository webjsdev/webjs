/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Port of Lit's reactive-element suite to WebJs, part 2 of 4: attribute
 * deserialization, reflection, symbol-keyed properties and declarations that
 * compose down a class chain.
 *
 * Upstream: lit/packages/reactive-element/src/test/reactive-element_test.ts
 * (lit commit b17fb144), lines 722 to 1661. The translation rules are listed
 * in reactive-element-port-properties.test.js.
 *
 * Where Lit asserts `hasAttributes()` is false the element sets
 * `static shadow = true`: a light-DOM WebJs host carries the framework's
 * `data-wj-host` marker attribute, which a shadow host does not.
 *
 * Covered by lifecycle-port.test.js and not repeated here: none from this
 * range (its reflection tests use the factory, these are Lit's own).
 */
import { WebComponent } from '../../../src/component.js';

import { assert } from '../../../../../test/browser-assert.js';

let __ctr = 0;
const tag = () => `re-port-attrs-${++__ctr}`;

/**
 * Install Lit's `accessor name = value` on `Cls.prototype` for each entry: a
 * get / set pair over per-instance storage that starts at the initializer.
 * A standard auto-accessor desugars to exactly that pair over a private field,
 * and the pair has to exist before the first instance is built, which is when
 * a field-initialised private slot would exist too.
 * @param {Function} Cls
 * @param {Record<string, () => unknown>} initializers
 */
function autoAccessors(Cls, initializers) {
  for (const [name, init] of Object.entries(initializers)) {
    const store = new WeakMap();
    Object.defineProperty(Cls.prototype, name, {
      configurable: true,
      get() {
        if (!store.has(this)) store.set(this, init());
        return store.get(this);
      },
      set(v) { store.set(this, v); },
    });
  }
}

suite('ReactiveElement port: attributes (reactive-element_test.ts)', () => {
  let container;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  teardown(() => {
    if (container && container.parentNode) container.parentNode.removeChild(container);
  });

  test('property/attribute values when attributes removed', async () => {
    class E extends WebComponent {
      static get properties() {
        return {
          bool: { type: Boolean },
          num: { type: Number },
          str: { type: String },
          obj: { type: Object },
          arr: { type: Array },
          reflectBool: { type: Boolean, reflect: true },
          reflectNum: { type: Number, reflect: true },
          reflectStr: { type: String, reflect: true },
          reflectObj: { type: Object, reflect: true },
          reflectArr: { type: Array, reflect: true },
          defaultBool: { type: Boolean },
          defaultNum: { type: Number },
          defaultStr: { type: String },
          defaultObj: { type: Object },
          defaultArr: { type: Array },
          defaultReflectBool: { type: Boolean, reflect: true },
          defaultReflectNum: { type: Number, reflect: true },
          defaultReflectStr: { type: String, reflect: true },
          defaultReflectObj: { type: Object, reflect: true },
          defaultReflectArr: { type: Array, reflect: true },
        };
      }
      constructor() {
        super();
        this.defaultBool = false;
        this.defaultNum = 0;
        this.defaultStr = '';
        this.defaultObj = { defaultObj: false };
        this.defaultArr = [1];
        this.defaultReflectBool = false;
        this.defaultReflectNum = 0;
        this.defaultReflectStr = 'defaultReflectStr';
        this.defaultReflectObj = { defaultReflectObj: true };
        this.defaultReflectArr = [1, 2];
      }
    }
    const name = tag();
    customElements.define(name, E);
    container.innerHTML = `<${name} bool num="2" str="str" obj='{"obj": true}'
      arr='[1]' reflectBool reflectNum="3" reflectStr="reflectStr"
      reflectObj ='{"reflectObj": true}' reflectArr="[1, 2]"
      defaultBool defaultNum="4" defaultStr="defaultStr"
      defaultObj='{"defaultObj": true}' defaultArr="[1, 2, 3]">
      </${name}>`;
    const el = container.firstChild;
    await el.updateComplete;
    assert.equal(el.bool, true);
    assert.equal(el.num, 2);
    assert.equal(el.str, 'str');
    assert.deepEqual(el.obj, { obj: true });
    assert.deepEqual(el.arr, [1]);
    assert.equal(el.reflectBool, true);
    assert.equal(el.reflectNum, 3);
    assert.equal(el.reflectStr, 'reflectStr');
    assert.deepEqual(el.reflectObj, { reflectObj: true });
    assert.deepEqual(el.reflectArr, [1, 2]);
    assert.equal(el.defaultBool, true);
    assert.equal(el.defaultNum, 4);
    assert.equal(el.defaultStr, 'defaultStr');
    assert.deepEqual(el.defaultObj, { defaultObj: true });
    assert.deepEqual(el.defaultArr, [1, 2, 3]);
    assert.equal(el.defaultReflectBool, false);
    assert.equal(el.defaultReflectNum, 0);
    assert.equal(el.defaultReflectStr, 'defaultReflectStr');
    assert.deepEqual(el.defaultReflectObj, { defaultReflectObj: true });
    assert.deepEqual(el.defaultReflectArr, [1, 2]);
    for (const attr of [
      'bool', 'num', 'str', 'obj', 'arr',
      'reflectbool', 'reflectnum', 'reflectstr', 'reflectobj', 'reflectarr',
      'defaultbool', 'defaultnum', 'defaultstr', 'defaultobj', 'defaultarr',
      'defaultreflectbool', 'defaultreflectnum', 'defaultreflectstr', 'defaultreflectobj', 'defaultreflectarr',
    ]) el.removeAttribute(attr);
    await el.updateComplete;
    assert.equal(el.bool, false);
    assert.equal(el.num, null);
    assert.equal(el.str, null);
    assert.deepEqual(el.obj, null);
    assert.deepEqual(el.arr, null);
    assert.equal(el.reflectBool, false);
    assert.equal(el.reflectNum, null);
    assert.equal(el.reflectStr, null);
    assert.deepEqual(el.reflectObj, null);
    assert.deepEqual(el.reflectArr, null);
    assert.equal(el.defaultBool, false);
    assert.equal(el.defaultNum, null);
    assert.equal(el.defaultStr, null);
    assert.deepEqual(el.defaultObj, null);
    assert.deepEqual(el.defaultArr, null);
    assert.equal(el.defaultReflectBool, false);
    assert.equal(el.defaultReflectNum, null);
    assert.equal(el.defaultReflectStr, null);
    assert.deepEqual(el.defaultReflectObj, null);
    assert.deepEqual(el.defaultReflectArr, null);
  });

  test('property/attribute values when attributes removed and useDefault is set', async () => {
    const kinds = ['Bool', 'Num', 'Str', 'Obj', 'Arr'];
    const types = { Bool: Boolean, Num: Number, Str: String, Obj: Object, Arr: Array };
    const initial = { Bool: () => false, Num: () => 0, Str: () => 'str', Obj: () => ({ obj: true }), Arr: () => [0] };
    const groups = ['', 'reflect', 'acc', 'accReflect', 'gs', 'gsReflect'];
    /** `('acc', 'Bool')` -> `accBool`, `('', 'Bool')` -> `bool`. */
    const propName = (g, k) => (g ? g + k : k.toLowerCase());
    const declarations = {};
    for (const g of groups) {
      for (const k of kinds) {
        declarations[propName(g, k)] = { type: types[k], useDefault: true, ...(/reflect/i.test(g) ? { reflect: true } : {}) };
      }
    }
    class E extends WebComponent {
      static shadow = true;
      static get properties() { return declarations; }
      constructor() {
        super();
        for (const g of ['', 'reflect']) for (const k of kinds) this[propName(g, k)] = initial[k]();
      }
    }
    // `accessor accBool = false` and the hand-written `#gsBool` get / set
    // pairs are the same shape at runtime: an accessor on the prototype over
    // per-instance storage.
    const accessorInits = {};
    for (const g of ['acc', 'accReflect', 'gs', 'gsReflect']) {
      for (const k of kinds) accessorInits[propName(g, k)] = initial[k];
    }
    autoAccessors(E, accessorInits);
    const name = tag();
    customElements.define(name, E);
    container.innerHTML = `<${name} bool num="1" str="str1" obj='{"obj1": true}'
      arr='[1]' reflectBool reflectNum="1" reflectStr="str1"
      reflectObj ='{"obj1": true}' reflectArr="[1]"
      accbool accnum="1" accstr="str1" accobj='{"obj1": true}'
      accarr='[1]' accreflectbool accreflectnum="1" accreflectstr="str1"
      accreflectobj ='{"obj1": true}' accreflectarr="[1]"
      gsbool gsnum="1" gsstr="str1" gsobj='{"obj1": true}'
      gsarr='[1]' gsreflectbool gsreflectnum="1" gsreflectstr="str1"
      gsreflectobj ='{"obj1": true}' gsreflectarr="[1]">
      </${name}>`;
    const el = container.firstChild;
    await el.updateComplete;
    const fromAttrs = { Bool: true, Num: 1, Str: 'str1', Obj: { obj1: true }, Arr: [1] };
    for (const g of groups) {
      for (const k of kinds) assert.deepEqual(el[propName(g, k)], fromAttrs[k], `${propName(g, k)} from attribute`);
    }
    for (const g of groups) for (const k of kinds) el.removeAttribute(propName(g, k).toLowerCase());
    const defaults = { Bool: false, Num: 0, Str: 'str', Obj: { obj: true }, Arr: [0] };
    for (const g of groups) {
      for (const k of kinds) assert.deepEqual(el[propName(g, k)], defaults[k], `${propName(g, k)} restored synchronously`);
    }
    await el.updateComplete;
    assert.isFalse(el.hasAttributes(), [...el.attributes].map((a) => a.name).join());
    for (const g of groups) {
      for (const k of kinds) assert.deepEqual(el[propName(g, k)], defaults[k], `${propName(g, k)} after the update`);
    }
  });

  test('fromAttribute can set prop to null or undefined', () => {
    class A extends WebComponent {
      static get properties() {
        return {
          foo: {
            converter: {
              fromAttribute: (value) => {
                if (value === 'undef') return undefined;
                if (value === 'nll') return null;
                return value;
              },
            },
          },
        };
      }
    }
    customElements.define(tag(), A);
    const el = new A();
    container.appendChild(el);
    assert.equal(el.foo, undefined);
    el.setAttribute('foo', 'bar');
    assert.equal(el.foo, 'bar');
    el.setAttribute('foo', 'undef');
    assert.equal(el.foo, undefined);
    el.setAttribute('foo', 'nll');
    assert.equal(el.foo, null);
  });

  test("attributes removed when a reflecting property's value becomes null", async () => {
    class E extends WebComponent {
      static get properties() {
        return {
          bool: { type: Boolean, reflect: true },
          num: { type: Number, reflect: true },
          str: { type: String, reflect: true },
          obj: { type: Object, reflect: true },
          arr: { type: Array, reflect: true },
        };
      }
    }
    const name = tag();
    customElements.define(name, E);
    container.innerHTML = `<${name} bool num="2" str="str" obj='{"obj": true}'
      arr='[1]'>
      </${name}>`;
    const el = container.firstChild;
    await el.updateComplete;
    el.bool = false;
    el.num = null;
    el.str = null;
    el.obj = null;
    el.arr = null;
    await el.updateComplete;
    assert.isFalse(el.hasAttribute('bool'));
    assert.isFalse(el.hasAttribute('num'));
    assert.isFalse(el.hasAttribute('str'));
    assert.isFalse(el.hasAttribute('obj'));
    assert.isFalse(el.hasAttribute('arr'));
  });

  test('if a `reflect: true` returns `undefined`, the attribute is removed', async () => {
    class E extends WebComponent {
      static get properties() {
        return { foo: { reflect: true }, obj: { type: Object, reflect: true } };
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    el.setAttribute('foo', 'foo');
    el.setAttribute('obj', '{"obj": 1}');
    assert.equal(el.foo, 'foo');
    assert.deepEqual(el.obj, { obj: 1 });
    await el.updateComplete;
    el.foo = 'foo2';
    el.obj = { obj: 2 };
    await el.updateComplete;
    assert.equal(el.getAttribute('foo'), 'foo2');
    assert.equal(el.getAttribute('obj'), '{"obj":2}');
    el.foo = undefined;
    el.obj = undefined;
    await el.updateComplete;
    assert.equal(el.getAttribute('foo'), null);
    assert.equal(el.getAttribute('obj'), null);
    el.foo = 'foo3';
    el.obj = { obj: 3 };
    await el.updateComplete;
    assert.equal(el.getAttribute('foo'), 'foo3');
    assert.equal(el.getAttribute('obj'), '{"obj":3}');
  });

  test('property reflects when set in response to another property changing via its attribute being set', async () => {
    class E extends WebComponent {
      static get properties() {
        return {
          prop: { type: Boolean, noAccessor: true, reflect: true },
          secondary: { type: Number, reflect: true },
          tertiary: { type: Number, reflect: true },
        };
      }
      _prop = false;
      propCount = 0;
      constructor() {
        super();
        this.secondary = 0;
        this.tertiary = 0;
      }
      get prop() {
        return this._prop;
      }
      set prop(val) {
        this.propCount++;
        const oldVal = this._prop;
        if (oldVal !== val) {
          this._prop = val;
          this.secondary += 1;
          this.tertiary += 1;
          this.requestUpdate('prop', oldVal);
        }
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.propCount, 0);
    assert.equal(el.getAttribute('secondary'), '0');
    assert.equal(el.getAttribute('tertiary'), '0');
    el.prop = true;
    await el.updateComplete;
    assert.equal(el.propCount, 1);
    assert.equal(el.getAttribute('secondary'), '1');
    assert.equal(el.getAttribute('tertiary'), '1');
    el.prop = false;
    await el.updateComplete;
    assert.equal(el.propCount, 2);
    assert.equal(el.getAttribute('secondary'), '2');
    assert.equal(el.getAttribute('tertiary'), '2');
    el.setAttribute('prop', '');
    await el.updateComplete;
    assert.equal(el.propCount, 3);
    assert.equal(el.getAttribute('secondary'), '3');
    assert.equal(el.getAttribute('tertiary'), '3');
  });

  test('attributes deserialize from html', async () => {
    const fromAttribute = (value) => parseInt(value);
    const toAttributeOnly = (value) =>
      typeof value === 'string' && value.indexOf(`-attr`) > 0 ? value : `${value}-attr`;
    const toAttribute = (value) => `${value}-attr`;
    class E extends WebComponent {
      static get properties() {
        return {
          noAttr: { attribute: false },
          atTr: { attribute: true },
          customAttr: { attribute: 'custom', reflect: true },
          fromAttribute: { converter: fromAttribute },
          toAttribute: { reflect: true, converter: { toAttribute: toAttributeOnly } },
          toAttributeNumber: {
            type: Number,
            reflect: true,
            converter: { toAttribute: (value) => value + ' ' },
          },
          all: { attribute: 'all-attr', converter: { fromAttribute, toAttribute }, reflect: true },
          obj: { type: Object },
          arr: { type: Array },
        };
      }
      constructor() {
        super();
        this.noAttr = 'noAttr';
        this.atTr = 'attr';
        this.customAttr = 'customAttr';
        this.fromAttribute = 1;
        this.toAttribute = 1;
        this.toAttributeNumber = 0;
        this.all = 10;
      }
    }
    const name = tag();
    customElements.define(name, E);
    container.innerHTML = `<${name}
      noattr="1"
      attr="2"
      custom="3"
      fromAttribute="6-attr"
      toAttribute="7"
      toAttributeNumber="8"
      all-attr="11-attr"
      obj='{"foo": true, "bar": 5, "baz": "hi"}'
      arr="[1, 2, 3, 4]"></${name}>`;
    const el = container.firstChild;
    await el.updateComplete;
    assert.equal(el.noAttr, 'noAttr');
    assert.equal(el.getAttribute('noattr'), '1');
    assert.equal(el.atTr, '2');
    assert.equal(el.customAttr, '3');
    assert.equal(el.getAttribute('custom'), '3');
    assert.equal(el.fromAttribute, 6);
    assert.equal(el.toAttribute, '7');
    assert.strictEqual(el.toAttributeNumber, 8);
    assert.equal(el.getAttribute('toattribute'), '7-attr');
    assert.equal(el.all, 11);
    assert.equal(el.getAttribute('all-attr'), '11-attr');
    assert.deepEqual(el.obj, { foo: true, bar: 5, baz: 'hi' });
    assert.deepEqual(el.arr, [1, 2, 3, 4]);
  });

  test('deserializing from invalid values does not produce exception', async () => {
    class E extends WebComponent {
      static get properties() {
        return {
          obj: { type: Object, reflect: true },
          arr: { type: Array, reflect: true },
          prop: { reflect: true },
        };
      }
    }
    const name = tag();
    let error = false;
    const listener = () => {
      error = true;
    };
    window.addEventListener('error', listener);
    customElements.define(name, E);
    container.innerHTML = `<${name}
      obj='{foo: true}'
      arr="[1, 2, 3, 4]"
      prop="prop"></${name}>`;
    const el = container.firstChild;
    await el.updateComplete;
    assert.isFalse(error);
    // Lit's `assert.equal(el.obj, undefined)` is chai's loose `==`, and Lit's
    // default converter yields `null` for invalid JSON. This helper's `equal`
    // is strict, so assert the value Lit produces.
    assert.equal(el.obj, null);
    assert.equal(el.prop, 'prop');
    assert.deepEqual(el.arr, [1, 2, 3, 4]);
    window.removeEventListener('error', listener);
  });

  test('properties defined using symbols', async () => {
    const zug = Symbol();
    class E extends WebComponent {
      static get properties() {
        return { foo: {}, [zug]: {} };
      }
      updateCount = 0;
      constructor() {
        super();
        this.foo = 5;
        this[zug] = 6;
      }
      update(changedProperties) {
        this.updateCount++;
        super.update(changedProperties);
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.updateCount, 1);
    assert.equal(el.foo, 5);
    assert.equal(el[zug], 6);
    el.foo = 55;
    await el.updateComplete;
    assert.equal(el.updateCount, 2);
    assert.equal(el.foo, 55);
    assert.equal(el[zug], 6);
    el[zug] = 66;
    await el.updateComplete;
    assert.equal(el.updateCount, 3);
    assert.equal(el.foo, 55);
    assert.equal(el[zug], 66);
  });

  test('properties as symbols can set property options', async () => {
    const zug = Symbol();
    class E extends WebComponent {
      static get properties() {
        return {
          [zug]: {
            attribute: 'zug',
            reflect: true,
            converter: (value) => Number(value) + 100,
          },
        };
      }
      constructor() {
        super();
        this[zug] = 5;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el[zug], 5);
    assert.equal(el.getAttribute('zug'), '5');
    el[zug] = 6;
    await el.updateComplete;
    assert.equal(el[zug], 6);
    assert.equal(el.getAttribute('zug'), '6');
    el.setAttribute('zug', '7');
    await el.updateComplete;
    assert.equal(el.getAttribute('zug'), '7');
    assert.equal(el[zug], 107);
  });

  test('property options compose when subclassing', async () => {
    const hasChanged = (value, old) => old === undefined || value > old;
    const fromAttribute = (value) => parseInt(value);
    const toAttribute = (value) => `${value}-attr`;
    class E extends WebComponent {
      static get properties() {
        return {
          noAttr: { attribute: false },
          atTr: { attribute: true },
          customAttr: {},
          hasChanged: {},
        };
      }
      updateCount = 0;
      constructor() {
        super();
        this.noAttr = 'noAttr';
        this.atTr = 'attr';
        this.customAttr = 'customAttr';
        this.hasChanged = 10;
      }
      update(changed) {
        this.updateCount++;
        super.update(changed);
      }
    }
    customElements.define(tag(), E);

    class F extends E {
      static get properties() {
        return {
          customAttr: { attribute: 'custom', reflect: true },
          hasChanged: { hasChanged },
          fromAttribute: {},
          toAttribute: {},
        };
      }
      constructor() {
        super();
        this.fromAttribute = 1;
        this.toAttribute = 1;
        this.all = 10;
      }
    }

    class G extends F {
      static get properties() {
        return {
          fromAttribute: { converter: fromAttribute },
          toAttribute: { reflect: true, converter: { toAttribute } },
          all: {
            attribute: 'all-attr',
            hasChanged,
            converter: { fromAttribute, toAttribute },
            reflect: true,
          },
        };
      }
    }

    customElements.define(tag(), G);

    const el = new G();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.updateCount, 1);
    assert.equal(el.noAttr, 'noAttr');
    assert.equal(el.atTr, 'attr');
    assert.equal(el.customAttr, 'customAttr');
    assert.equal(el.hasChanged, 10);
    assert.equal(el.fromAttribute, 1);
    assert.equal(el.toAttribute, 1);
    assert.equal(el.getAttribute('toattribute'), '1-attr');
    assert.equal(el.all, 10);
    assert.equal(el.getAttribute('all-attr'), '10-attr');
    el.setAttribute('noattr', 'noAttr2');
    el.setAttribute('attr', 'attr2');
    el.setAttribute('custom', 'customAttr2');
    el.setAttribute('fromattribute', '2attr');
    el.toAttribute = 2;
    el.all = 5;
    await el.updateComplete;
    assert.equal(el.updateCount, 2);
    assert.equal(el.noAttr, 'noAttr');
    assert.equal(el.atTr, 'attr2');
    assert.equal(el.customAttr, 'customAttr2');
    assert.equal(el.fromAttribute, 2);
    assert.equal(el.toAttribute, 2);
    assert.equal(el.getAttribute('toattribute'), '2-attr');
    assert.equal(el.all, 5);
    el.all = 15;
    await el.updateComplete;
    assert.equal(el.updateCount, 3);
    assert.equal(el.all, 15);
    assert.equal(el.getAttribute('all-attr'), '15-attr');
    el.setAttribute('all-attr', '16-attr');
    await el.updateComplete;
    assert.equal(el.updateCount, 4);
    assert.equal(el.getAttribute('all-attr'), '16-attr');
    assert.equal(el.all, 16);
    el.hasChanged = 5;
    await el.updateComplete;
    assert.equal(el.hasChanged, 5);
    assert.equal(el.updateCount, 4);
    el.hasChanged = 15;
    await el.updateComplete;
    assert.equal(el.hasChanged, 15);
    assert.equal(el.updateCount, 5);
    el.setAttribute('all-attr', '5-attr');
    await el.updateComplete;
    assert.equal(el.all, 5);
    assert.equal(el.updateCount, 5);
    el.all = 15;
    await el.updateComplete;
    assert.equal(el.all, 15);
    assert.equal(el.updateCount, 6);
  });

  test('superclass properties not affected by subclass', async () => {
    class E extends WebComponent {
      static get properties() {
        return {
          foo: { attribute: 'zug', reflect: true },
          bar: { reflect: true },
        };
      }
      constructor() {
        super();
        this.foo = 5;
        this.bar = 'bar';
      }
    }
    customElements.define(tag(), E);

    class F extends E {
      static get properties() {
        return { foo: { attribute: false }, nug: {} };
      }
      constructor() {
        super();
        this.foo = 6;
        this.bar = 'subbar';
        this.nug = 5;
      }
    }
    customElements.define(tag(), F);

    const el = new E();
    const sub = new F();
    container.appendChild(el);
    await el.updateComplete;
    container.appendChild(sub);
    await sub.updateComplete;

    assert.equal(el.foo, 5);
    assert.equal(el.getAttribute('zug'), '5');
    assert.isFalse(el.hasAttribute('foo'));
    assert.equal(el.bar, 'bar');
    assert.equal(el.getAttribute('bar'), 'bar');
    assert.isUndefined(el.nug);

    assert.equal(sub.foo, 6);
    assert.isFalse(sub.hasAttribute('zug'));
    assert.isFalse(sub.hasAttribute('foo'));
    assert.equal(sub.bar, 'subbar');
    assert.equal(sub.getAttribute('bar'), 'subbar');
    assert.equal(sub.nug, 5);
  });

  test('Attributes reflect', async () => {
    const suffix = '-reflected';
    class E extends WebComponent {
      static get properties() {
        return {
          foo: { reflect: true, converter: { toAttribute: (value) => `${value}${suffix}` } },
        };
      }
      constructor() {
        super();
        this.foo = 0;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.getAttribute('foo'), `0${suffix}`);
    el.foo = 5;
    await el.updateComplete;
    assert.equal(el.getAttribute('foo'), `5${suffix}`);
  });

  test('Attributes reflect with type: Boolean', async () => {
    class E extends WebComponent {
      static get properties() {
        return { bar: { type: Boolean, reflect: true } };
      }
      constructor() {
        super();
        this.bar = true;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.getAttribute('bar'), '');
    el.bar = false;
    await el.updateComplete;
    assert.equal(el.hasAttribute('bar'), false);
    el.bar = true;
    await el.updateComplete;
    assert.equal(el.getAttribute('bar'), '');
  });
});
