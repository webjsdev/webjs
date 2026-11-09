/**
 * Lit's property options with Lit's meaning, on the server element shim and
 * through the SSR renderer: `attribute: true`, a function `converter`,
 * `noAccessor`, a wrapped author accessor, and `requestUpdate(name,
 * oldValue, options)` running `hasChanged`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebComponent, html, renderToString } from '../../index.js';

let n = 0;
const tag = () => `prop-opt-${++n}`;

test('attribute: true uses the default attribute name', async () => {
  const t = tag();
  class E extends WebComponent {
    static properties = { label: { type: String, attribute: true, reflect: true } };
    render() { return html`<p>${/** @type {any} */ (this).label}</p>`; }
  }
  E.register(t);
  assert.ok(E.observedAttributes.includes('label'));
  assert.ok(!E.observedAttributes.includes('true'));
  const out = await renderToString(html([`<${t} label="hi"></${t}>`]));
  assert.match(out, /<p>hi<\/p>/);
});

test('a function converter is the fromAttribute half, on the server too', async () => {
  const t = tag();
  class E extends WebComponent {
    static properties = { when: { converter: (v) => new Date(Number(v)) } };
    render() { return html`<p>${/** @type {any} */ (this).when.getTime()}</p>`; }
  }
  E.register(t);
  const out = await renderToString(html([`<${t} when="1000"></${t}>`]));
  assert.match(out, /<p>1000<\/p>/);
});

test('noAccessor keeps the author accessor, which calls requestUpdate itself', () => {
  /** @type {unknown[]} */
  const writes = [];
  class E extends WebComponent {
    static properties = { size: { type: Number, noAccessor: true } };
    get size() { return this._size; }
    set size(v) {
      const old = this._size;
      this._size = v;
      writes.push(v);
      this.requestUpdate('size', old);
    }
  }
  const el = /** @type {any} */ (new E());
  el.size = 3;
  assert.deepEqual(writes, [3]);
  assert.equal(el.size, 3);
  assert.ok(el._changedProperties.has('size'));
  assert.ok(E.observedAttributes.includes('size'), 'still attribute-backed');
});

test('a declared property with an author get/set is wrapped, as in Lit', () => {
  class E extends WebComponent {
    static properties = { name: { type: String } };
    get name() { return (this._name ?? '').toUpperCase(); }
    set name(v) { this._name = v; }
  }
  const el = /** @type {any} */ (new E());
  el.name = 'ada';
  assert.equal(el.name, 'ADA', 'reads go through the author getter');
  assert.equal(el._name, 'ada', 'writes go through the author setter');
  assert.ok(el._changedProperties.has('name'), 'and the wrapper records the change');
});

test('a subclass of a wrapped class still wraps the author accessor', () => {
  class Base extends WebComponent {
    static properties = { name: { type: String } };
    get name() { return this._name; }
    set name(v) { this._name = `<${v}>`; }
  }
  new Base();
  class Child extends Base {
    static properties = { name: { type: String, reflect: true } };
  }
  const el = /** @type {any} */ (new Child());
  el.name = 'x';
  assert.equal(el._name, '<x>');
  assert.equal(el.name, '<x>');
});

test('requestUpdate(name, oldValue) runs hasChanged and skips an unchanged value', () => {
  class E extends WebComponent {
    static properties = { n: { type: Number, hasChanged: (a, b) => Math.abs((a ?? 0) - (b ?? 0)) >= 1 } };
  }
  const el = /** @type {any} */ (new E());
  el._changedProperties.clear();
  el.n = 0.5;
  assert.equal(el._changedProperties.has('n'), false, 'below the threshold, no change');
  el.n = 2;
  assert.ok(el._changedProperties.has('n'));
  el._changedProperties.clear();
  el.requestUpdate('n', 2);
  assert.equal(el._changedProperties.has('n'), false, 'a manual call is checked too');
  el.requestUpdate('n', 9, { hasChanged: () => true });
  assert.ok(el._changedProperties.has('n'), 'explicit options win');
});
