/**
 * Lit's static class API on WebComponent: `elementProperties`,
 * `getPropertyOptions`, `createProperty`, `finalize`, `addInitializer` and
 * `getPropertyDescriptor`. Runs on the server element shim (no DOM needed).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebComponent, prop, html, renderToString } from '../../index.js';

let n = 0;
const tag = () => `lit-static-${++n}`;

test('elementProperties merges the factory, static properties and the parent chain', () => {
  class Base extends WebComponent({ a: Number }) {}
  class Child extends Base {
    static properties = { b: { type: Boolean, reflect: true } };
  }
  const map = Child.elementProperties;
  assert.ok(map instanceof Map);
  assert.deepEqual([...map.keys()], ['a', 'b']);
  assert.equal(map.get('a').type, Number, 'the shorthand is normalised');
  assert.equal(map.get('b').reflect, true);
  assert.equal(Child.elementProperties, map, 'memoized per class');
  assert.deepEqual([...Base.elementProperties.keys()], ['a'], 'a child does not leak into its parent');
});

test('getPropertyOptions returns the declaration or the default', () => {
  class E extends WebComponent({ count: prop(Number, { reflect: true }) }) {}
  assert.equal(E.getPropertyOptions('count').reflect, true);
  assert.equal(E.getPropertyOptions('missing').type, String);
});

test('createProperty declares a reactive, attribute-backed property', async () => {
  const t = tag();
  class E extends WebComponent {
    render() { return html`<p>${/** @type {any} */ (this).label}</p>`; }
  }
  E.createProperty('label', { type: String });
  E.register(t);
  assert.ok(E.elementProperties.has('label'));
  assert.ok(E.observedAttributes.includes('label'));
  const out = await renderToString(html([`<${t} label="hi"></${t}>`]));
  assert.match(out, /<p>hi<\/p>/);
  const el = /** @type {any} */ (new E());
  el.label = 'x';
  assert.equal(el.label, 'x');
  assert.ok(el._changedProperties.has('label'), 'the setter records the change');
});

test('createProperty after the first instance throws naming the fix', () => {
  class E extends WebComponent {}
  new E();
  assert.throws(() => E.createProperty('late'), /static properties/);
});

test('finalize is idempotent and runs on register', () => {
  let finalized = 0;
  class E extends WebComponent {
    static finalize() { finalized++; super.finalize(); }
  }
  E.register(tag());
  assert.equal(finalized, 1);
  E.finalize();
  E.finalize();
  assert.equal(finalized, 3, 'the override runs, the base work happens once');
});

test('addInitializer runs per instance and is inherited by subclasses only', () => {
  /** @type {string[]} */
  const seen = [];
  class Base extends WebComponent({ count: Number }) {}
  Base.addInitializer((el) => seen.push(`base:${el.constructor.name}`));
  class Child extends Base {}
  Child.addInitializer(() => seen.push('child'));
  new Base();
  new Child();
  assert.deepEqual(seen, ['base:Base', 'base:Child', 'child']);
});

test('an initializer sees the declared properties', () => {
  /** @type {unknown} */
  let seen;
  class E extends WebComponent({ count: prop(Number, { default: 4 }) }) {}
  E.addInitializer((el) => { seen = /** @type {any} */ (el).count; });
  new E();
  assert.equal(seen, 4);
});

test('getPropertyDescriptor can wrap the default accessor', () => {
  /** @type {unknown[]} */
  const sets = [];
  class E extends WebComponent({ count: Number }) {
    static getPropertyDescriptor(name, key, options) {
      const base = /** @type {PropertyDescriptor} */ (super.getPropertyDescriptor(name, key, options));
      return {
        ...base,
        set(v) { sets.push(v); base.set?.call(this, v); },
      };
    }
  }
  const el = /** @type {any} */ (new E());
  el.count = 2;
  assert.deepEqual(sets, [2]);
  assert.equal(el.count, 2);
  assert.ok(el._changedProperties.has('count'));
});

test('getPropertyDescriptor returning undefined installs no accessor', () => {
  class E extends WebComponent({ raw: Number }) {
    static getPropertyDescriptor() { return undefined; }
  }
  const el = /** @type {any} */ (new E());
  el.raw = 1;
  assert.equal(Object.getOwnPropertyDescriptor(E.prototype, 'raw'), undefined);
  assert.equal(el._changedProperties.has('raw'), false);
});
