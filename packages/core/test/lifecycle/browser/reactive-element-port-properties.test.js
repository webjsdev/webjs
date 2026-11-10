/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Port of Lit's reactive-element suite to WebJs, part 1 of 4: render root,
 * updateComplete, changedProperties and the property options.
 *
 * Upstream: lit/packages/reactive-element/src/test/reactive-element_test.ts
 * (lit commit b17fb144), lines 43 to 720.
 *
 * Translation rules, shared by every reactive-element-port-*.test.js file:
 *   - `static get properties()` stays as written (WebJs reads Lit's spelling).
 *   - A class field that initialises a REACTIVE property (`foo = 5`) becomes a
 *     constructor assignment, which is what Lit's TypeScript build emits
 *     (`useDefineForClassFields: false`). A native class field would shadow
 *     the prototype accessor in both libraries.
 *   - A standard-decorators auto-accessor (`accessor acc = 'acc'`) becomes the
 *     get / set pair it desugars to, over a private field.
 *   - `generateElementName()` becomes `tag()`.
 *
 * Not ported from this range:
 *   - "PropertyDeclaration field `hasChanged` can be passed concrete types"
 *     (type-only, no runtime assertion).
 *
 * Covered by lifecycle-port.test.js and not repeated here: none from this
 * range. "`shouldUpdate` controls update" is ported again because Lit's
 * version also counts willUpdate / updated, which the earlier port did not.
 */
import { WebComponent } from '../../../src/component.js';

import { assert } from '../../../../../test/browser-assert.js';

let __ctr = 0;
const tag = () => `re-port-props-${++__ctr}`;

suite('ReactiveElement port: properties (reactive-element_test.ts)', () => {
  let container;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  teardown(() => {
    if (container && container.parentNode) container.parentNode.removeChild(container);
  });

  test('renderRoot exists after connectedCallback', async () => {
    class E extends WebComponent {
      hasRenderRoot = false;
      connectedCallback() {
        super.connectedCallback();
        this.hasRenderRoot = !!this.renderRoot;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    assert.isTrue(el.hasRenderRoot);
  });

  test('renderRoot exists before first update (without connecting)', async () => {
    class E extends WebComponent {
      hasRenderRoot = false;
      willUpdate() {
        this.hasRenderRoot = !!this.renderRoot;
      }
      flushUpdate() {
        this.performUpdate();
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    el.flushUpdate();
    assert.isTrue(el.hasRenderRoot);
    assert.isFalse(el.isConnected);
  });

  test('createRenderRoot is called only once', async () => {
    class E extends WebComponent {
      renderRootCalls = 0;
      createRenderRoot() {
        this.renderRootCalls++;
        return this;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    container.removeChild(el);
    container.appendChild(el);
    container.removeChild(el);
    container.appendChild(el);
    assert.equal(el.renderRootCalls, 1);
  });

  test('`updateComplete` waits for `requestUpdate` but does not trigger update, async', async () => {
    class E extends WebComponent {
      updateCount = 0;
      updated() {
        this.updateCount++;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.updateCount, 1);
    await el.updateComplete;
    assert.equal(el.updateCount, 1);
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(el.updateCount, 2);
    await el.updateComplete;
    assert.equal(el.updateCount, 2);
  });

  test('`shouldUpdate` controls update', async () => {
    class E extends WebComponent {
      needsUpdate = true;
      willUpdateCount = 0;
      updateCount = 0;
      updatedCount = 0;
      shouldUpdate() {
        return this.needsUpdate;
      }
      willUpdate() {
        this.willUpdateCount++;
      }
      update(props) {
        super.update(props);
        this.updateCount++;
      }
      updated() {
        this.updatedCount++;
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(el.willUpdateCount, 1);
    assert.equal(el.updateCount, 1);
    assert.equal(el.updatedCount, 1);
    el.needsUpdate = false;
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(el.willUpdateCount, 1);
    assert.equal(el.updateCount, 1);
    assert.equal(el.updatedCount, 1);
    el.needsUpdate = true;
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(el.willUpdateCount, 2);
    assert.equal(el.updateCount, 2);
    assert.equal(el.updatedCount, 2);
    el.requestUpdate();
    await el.updateComplete;
    assert.equal(el.willUpdateCount, 3);
    assert.equal(el.updateCount, 3);
    assert.equal(el.updatedCount, 3);
  });

  /**
   * The `prop` / `acc` / `gs` element the changedProperties and useDefault
   * tests share. `shadow` is set where Lit asserts `hasAttributes()` is
   * false: a light-DOM WebJs host carries the framework's `data-wj-host`
   * marker, which a shadow host does not.
   */
  function changedPropsElement(options = {}, shadow = false) {
    return class E extends WebComponent {
      static shadow = shadow;
      static get properties() {
        return { prop: { ...options }, acc: { ...options }, gs: { ...options } };
      }
      #acc = 'acc';
      get acc() { return this.#acc; }
      set acc(v) { this.#acc = v; }
      #gs = 'gs';
      get gs() { return this.#gs; }
      set gs(v) { this.#gs = v; }
      changes = new Map();
      constructor() {
        super();
        this.prop = 'prop';
        this.changes = new Map();
      }
      updated(changed) {
        this.changes = new Map(changed);
      }
    };
  }

  test('changedProperties', async () => {
    const E = changedPropsElement();
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.deepEqual(Array.from(el.changes), [
      ['prop', undefined],
      ['acc', undefined],
      ['gs', undefined],
    ]);
    el.prop = '1';
    el.acc = '2';
    el.gs = '3';
    await el.updateComplete;
    assert.deepEqual(Array.from(el.changes), [
      ['prop', 'prop'],
      ['acc', 'acc'],
      ['gs', 'gs'],
    ]);
  });

  test('changedProperties initial values when user set', async () => {
    const E = changedPropsElement();
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    el.prop = '1';
    el.acc = '2';
    el.gs = '3';
    await el.updateComplete;
    assert.deepEqual(Array.from(el.changes), [
      ['prop', undefined],
      ['acc', undefined],
      ['gs', undefined],
    ]);
  });

  test('property options', async () => {
    const hasChanged = (value, old) => old === undefined || value > old;
    const fromAttribute = (value) => parseInt(value);
    const toAttribute = (value) => `${value}-attr`;
    class E extends WebComponent {
      static get properties() {
        return {
          noAttr: { attribute: false },
          atTr: { attribute: true },
          customAttr: { attribute: 'custom', reflect: true },
          hasChanged: { hasChanged },
          fromAttribute: { converter: fromAttribute },
          toAttribute: { reflect: true, converter: { toAttribute } },
          _state: { state: true },
          all: {
            attribute: 'all-attr',
            hasChanged,
            converter: { fromAttribute, toAttribute },
            reflect: true,
          },
        };
      }
      updateCount = 0;
      constructor() {
        super();
        this.noAttr = 'noAttr';
        this.atTr = 'attr';
        this.customAttr = 'customAttr';
        this.hasChanged = 10;
        this.fromAttribute = 1;
        this.toAttribute = 1;
        this.all = 10;
        this._state = 'internal';
      }
      update(changed) {
        this.updateCount++;
        super.update(changed);
      }
    }
    customElements.define(tag(), E);
    const el = new E();
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
    assert.equal(el._state, 'internal');
    el.setAttribute('noattr', 'noAttr2');
    el.setAttribute('attr', 'attr2');
    el.setAttribute('custom', 'customAttr2');
    el.setAttribute('fromattribute', '2attr');
    el.setAttribute('_state', 'external');
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
    assert.equal(el._state, 'internal');
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

  test('property options useDefault', async () => {
    const E = changedPropsElement({ useDefault: true });
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    assert.equal(el.prop, 'prop');
    assert.equal(el.acc, 'acc');
    assert.equal(el.gs, 'gs');
    await el.updateComplete;
    assert.equal(el.prop, 'prop');
    assert.equal(el.acc, 'acc');
    assert.equal(el.gs, 'gs');
    assert.deepEqual(Array.from(el.changes), []);
    el.prop = '1';
    el.acc = '2';
    el.gs = '3';
    await el.updateComplete;
    assert.equal(el.prop, '1');
    assert.equal(el.acc, '2');
    assert.equal(el.gs, '3');
    assert.deepEqual(Array.from(el.changes), [
      ['prop', 'prop'],
      ['acc', 'acc'],
      ['gs', 'gs'],
    ]);
    const el2 = new E();
    container.appendChild(el2);
    el2.prop = '1';
    el2.acc = '2';
    el2.gs = '3';
    await el2.updateComplete;
    assert.equal(el2.prop, '1');
    assert.equal(el2.acc, '2');
    assert.equal(el2.gs, '3');
    assert.deepEqual(Array.from(el2.changes), [
      ['prop', 'prop'],
      ['acc', 'acc'],
      ['gs', 'gs'],
    ]);
    const late = tag();
    const el3 = document.createElement(late);
    container.append(el3);
    el3.prop = '1';
    el3.acc = '2';
    el3.gs = '3';
    customElements.define(late, class extends E {});
    await el3.updateComplete;
    assert.equal(el3.prop, '1');
    assert.equal(el3.acc, '2');
    assert.equal(el3.gs, '3');
    assert.deepEqual(Array.from(el3.changes), [
      ['prop', 'prop'],
      ['acc', 'acc'],
      ['gs', 'gs'],
    ]);
  });

  test('property options useDefault does not reflect', async () => {
    const E = changedPropsElement({ reflect: true, useDefault: true }, true);
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    assert.isFalse(el.hasAttributes(), [...el.attributes].map((a) => a.name).join());
    el.prop = 'prop';
    el.acc = 'acc';
    el.gs = 'gs';
    await el.updateComplete;
    assert.equal(el.getAttribute('prop'), 'prop');
    assert.equal(el.getAttribute('acc'), 'acc');
    assert.equal(el.getAttribute('gs'), 'gs');
    el.prop = '1';
    el.acc = '2';
    el.gs = '3';
    await el.updateComplete;
    assert.equal(el.getAttribute('prop'), '1');
    assert.equal(el.getAttribute('acc'), '2');
    assert.equal(el.getAttribute('gs'), '3');

    const el2 = new E();
    container.appendChild(el2);
    el2.prop = '1';
    el2.acc = '2';
    el2.gs = '3';
    await el2.updateComplete;
    assert.equal(el2.getAttribute('prop'), '1');
    assert.equal(el2.getAttribute('acc'), '2');
    assert.equal(el2.getAttribute('gs'), '3');
    const late = tag();
    const el3 = document.createElement(late);
    container.append(el3);
    el3.prop = '1';
    el3.acc = '2';
    el3.gs = '3';
    customElements.define(late, class extends E {});
    await el3.updateComplete;
    assert.equal(el3.getAttribute('prop'), '1');
    assert.equal(el3.getAttribute('acc'), '2');
    assert.equal(el3.getAttribute('gs'), '3');
  });

  test('changedProperties initial values with useDefault when user set', async () => {
    const E = changedPropsElement({ reflect: true, useDefault: true });
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    el.prop = '1';
    el.acc = '2';
    el.gs = '3';
    await el.updateComplete;
    assert.deepEqual(Array.from(el.changes), [
      ['prop', 'prop'],
      ['acc', 'acc'],
      ['gs', 'gs'],
    ]);
  });

  test('property option `converter` can use `type` info', async () => {
    const FooType = { name: 'FooType' };
    const converter = {
      fromAttribute: (_value, type) => `fromAttribute: ${String(type.name)}`,
      toAttribute: (_value, type) => `toAttribute: ${String(type.name)}`,
    };
    class E extends WebComponent {
      static get properties() {
        return {
          num: { type: Number, converter, reflect: true },
          str: { type: String, converter, reflect: true },
          foo: { type: FooType, converter, reflect: true },
        };
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;
    el.num = 5;
    el.str = 'hi';
    el.foo = 'zoink';
    await el.updateComplete;
    assert.equal(el.getAttribute('num'), 'toAttribute: Number');
    assert.equal(el.getAttribute('str'), 'toAttribute: String');
    assert.equal(el.getAttribute('foo'), 'toAttribute: FooType');
    el.removeAttribute('num');
    el.removeAttribute('str');
    el.removeAttribute('foo');
    await el.updateComplete;
    assert.equal(el.num, 'fromAttribute: Number');
    assert.equal(el.str, 'fromAttribute: String');
    assert.equal(el.foo, 'fromAttribute: FooType');
    assert.equal(el.getAttribute('num'), null);
    assert.equal(el.getAttribute('str'), null);
    assert.equal(el.getAttribute('foo'), null);
    el.num = 0;
    el.str = '';
    el.foo = {};
    await el.updateComplete;
    assert.equal(el.getAttribute('num'), 'toAttribute: Number');
    assert.equal(el.getAttribute('str'), 'toAttribute: String');
    assert.equal(el.getAttribute('foo'), 'toAttribute: FooType');
  });

  test('property option `converter` can use a class instance', async () => {
    class IntegerAttributeConverter {
      constructor(defaultValue) {
        this._defaultValue = defaultValue;
      }
      toAttribute(value) {
        if (!value) return this._defaultValue;
        return `${value}`;
      }
      fromAttribute(value) {
        if (!value) return this._defaultValue;
        const parsedValue = Number.parseInt(value, 10);
        if (isNaN(parsedValue)) return this._defaultValue;
        return parsedValue;
      }
    }
    const defaultIntAttrConverterVal = 1;
    class E extends WebComponent {
      static get properties() {
        return {
          num: {
            type: Number,
            converter: new IntegerAttributeConverter(defaultIntAttrConverterVal),
            reflect: true,
          },
        };
      }
    }
    customElements.define(tag(), E);
    const el = new E();
    container.appendChild(el);
    await el.updateComplete;

    assert.equal(el.getAttribute('num'), null);
    assert.equal(el.num, undefined);

    el.setAttribute('num', 'notANumber');
    await el.updateComplete;
    assert.equal(el.num, defaultIntAttrConverterVal);

    el.num = 10;
    await el.updateComplete;
    assert.equal(el.getAttribute('num'), '10');

    el.setAttribute('num', '5');
    await el.updateComplete;
    assert.equal(el.num, 5);

    el.num = undefined;
    await el.updateComplete;
    assert.equal(el.getAttribute('num'), `${defaultIntAttrConverterVal}`);
  });
});
