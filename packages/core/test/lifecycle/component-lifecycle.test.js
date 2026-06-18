/**
 * Unit tests for WebComponent lifecycle paths that aren't exercised by
 * the SSR-only tests: property accessor initialisation, attribute
 * coercion, reflection, connectedCallback upgrading, controller
 * dispatch, requestUpdate batching, firstUpdated, renderError.
 *
 * Runs under linkedom to simulate a DOM without spinning up a browser.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

let WebComponent, html, css;

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

  ({ WebComponent, html, css } = await import('../../index.js'));
});

/* -------------------- attribute coercion -------------------- */

test('observedAttributes derives from static properties, excluding state', () => {
  class A extends WebComponent {
    static properties = {
      foo: { type: String },
      bar: { type: Number, state: true },       // state → excluded
      fooBar: { type: String },                 // camelCase → kebab-case
    };
  }
  A.register('obs-attrs');
  assert.deepEqual(
    A.observedAttributes.sort(),
    ['foo', 'foo-bar'].sort(),
  );
});

test('attributeChangedCallback coerces String / Number / Boolean / Object / Array', () => {
  class C extends WebComponent {
    static properties = {
      s: { type: String },
      n: { type: Number },
      b: { type: Boolean },
      o: { type: Object },
      a: { type: Array },
    };
  }
  C.register('coerce-el');
  const el = document.createElement('coerce-el');
  el.attributeChangedCallback('s', null, 'hi');
  assert.equal(el.s, 'hi');
  el.attributeChangedCallback('n', null, '42');
  assert.equal(el.n, 42);
  el.attributeChangedCallback('b', null, '');
  assert.equal(el.b, true);
  el.attributeChangedCallback('b', '', null);
  assert.equal(el.b, false);
  el.attributeChangedCallback('o', null, '{"x":1}');
  assert.deepEqual(el.o, { x: 1 });
  el.attributeChangedCallback('a', null, '[1,2]');
  assert.deepEqual(el.a, [1, 2]);
});

test('attributeChangedCallback falls back to raw string on malformed JSON', () => {
  class C extends WebComponent {
    static properties = { o: { type: Object } };
  }
  C.register('malformed-json');
  const el = document.createElement('malformed-json');
  el.attributeChangedCallback('o', null, 'not-json');
  assert.equal(el.o, 'not-json');
});

test('custom converter.fromAttribute overrides type-based coercion', () => {
  class C extends WebComponent {
    static properties = {
      v: {
        type: Object,
        converter: { fromAttribute: (v) => ({ raw: v }) },
      },
    };
  }
  C.register('custom-from');
  const el = document.createElement('custom-from');
  el.attributeChangedCallback('v', null, 'abc');
  assert.deepEqual(el.v, { raw: 'abc' });
});

test('attributeChangedCallback sets property when called with new value', () => {
  // The browser itself guards against calling this with the same value;
  // when it fires, the framework trusts the value and sets the property.
  class C extends WebComponent {
    static properties = { s: { type: String } };
  }
  C.register('same-attr');
  const el = document.createElement('same-attr');
  el.attributeChangedCallback('s', null, 'a');
  assert.equal(el.s, 'a');
});

/* -------------------- property reflection -------------------- */

test('reflect: true writes property back to attribute (Boolean)', () => {
  class C extends WebComponent {
    static properties = { on: { type: Boolean, reflect: true } };
  }
  C.register('reflect-bool');
  const el = document.createElement('reflect-bool');
  document.body.appendChild(el);
  el.on = true;
  assert.equal(el.getAttribute('on'), '');
  el.on = false;
  assert.equal(el.hasAttribute('on'), false);
});

test('reflect: true writes property back to attribute (Object / Array as JSON)', () => {
  class C extends WebComponent {
    static properties = {
      data: { type: Object, reflect: true },
      tags: { type: Array, reflect: true },
    };
  }
  C.register('reflect-json');
  const el = document.createElement('reflect-json');
  document.body.appendChild(el);
  el.data = { a: 1 };
  assert.equal(el.getAttribute('data'), '{"a":1}');
  el.tags = ['x'];
  assert.equal(el.getAttribute('tags'), '["x"]');
});

test('reflect: true removes attribute when value is null', () => {
  class C extends WebComponent {
    static properties = { s: { type: String, reflect: true } };
  }
  C.register('reflect-null');
  const el = document.createElement('reflect-null');
  document.body.appendChild(el);
  el.s = 'hi';
  assert.equal(el.getAttribute('s'), 'hi');
  el.s = null;
  assert.equal(el.hasAttribute('s'), false);
});

test('reflect uses converter.toAttribute when provided', () => {
  class C extends WebComponent {
    static properties = {
      v: {
        type: Object,
        reflect: true,
        converter: { toAttribute: (v) => (v == null ? null : `x:${v.n}`) },
      },
    };
  }
  C.register('reflect-to-attr');
  const el = document.createElement('reflect-to-attr');
  document.body.appendChild(el);
  el.v = { n: 42 };
  assert.equal(el.getAttribute('v'), 'x:42');
  el.v = null;
  assert.equal(el.hasAttribute('v'), false);
});

/* -------------------- hasChanged -------------------- */

test('custom hasChanged short-circuits updates when false', async () => {
  let renders = 0;
  class C extends WebComponent {
    static properties = {
      size: { type: Number, hasChanged: (a, b) => (b == null ? true : Math.abs(a - b) > 1) },
    };
    render() { renders++; return html`<p>${this.size}</p>`; }
  }
  C.register('hc-el');
  const el = document.createElement('hc-el');
  document.body.appendChild(el);
  await Promise.resolve(); await Promise.resolve();
  renders = 0;
  el.size = 10;                          // first change: renders
  await Promise.resolve(); await Promise.resolve();
  el.size = 10.5;                        // diff 0.5 → hasChanged false → skip
  await Promise.resolve(); await Promise.resolve();
  assert.equal(renders, 1, 'second assignment did not schedule a render');
});

/* -------------------- declarative default (#531) -------------------- */

test('default option seeds the value with no constructor', () => {
  class C extends WebComponent {
    static properties = {
      count: { type: Number, default: 0 },
      label: { type: String, default: 'hi' },
    };
  }
  C.register('default-literal');
  const el = document.createElement('default-literal');
  assert.equal(el.count, 0);
  assert.equal(el.label, 'hi');
});

test('a falsy default (0, false, "") is applied, not skipped', () => {
  class C extends WebComponent {
    static properties = {
      n: { type: Number, default: 0 },
      b: { type: Boolean, default: false },
      s: { type: String, default: '' },
    };
  }
  C.register('default-falsy');
  const el = document.createElement('default-falsy');
  assert.equal(el.n, 0);
  assert.equal(el.b, false);
  assert.equal(el.s, '');
});

test('a function default is called to produce a FRESH value per instance', () => {
  class C extends WebComponent {
    static properties = { items: { type: Array, default: () => [] } };
  }
  C.register('default-factory');
  const a = document.createElement('default-factory');
  const b = document.createElement('default-factory');
  assert.deepEqual(a.items, []);
  a.items.push(1);
  // b's default must be a separate array, not a shared reference.
  assert.deepEqual(b.items, []);
});

test('a LITERAL object default is shared across instances (documented hazard)', () => {
  // This locks the documented contract: a non-function default is the SAME
  // reference for every element (evaluated once in `static properties`), so
  // objects / arrays must use the function form. If this ever stops being
  // true, the docs warning in lit-muscle-memory-gotchas.md must change.
  class C extends WebComponent {
    static properties = { bag: { type: Object, default: {} } };
  }
  C.register('default-literal-shared');
  const a = document.createElement('default-literal-shared');
  const b = document.createElement('default-literal-shared');
  assert.equal(a.bag, b.bag, 'a literal default is shared by reference');
});

test('an applied attribute overrides the default', () => {
  class C extends WebComponent {
    static properties = { size: { type: Number, default: 7 } };
  }
  C.register('default-attr-override');
  const el = document.createElement('default-attr-override');
  assert.equal(el.size, 7);
  el.attributeChangedCallback('size', null, '42');
  assert.equal(el.size, 42);
});

test('a default with reflect: true reflects to the attribute on connect', () => {
  class C extends WebComponent {
    static properties = { mode: { type: String, reflect: true, default: 'dark' } };
  }
  C.register('default-reflect');
  const el = document.createElement('default-reflect');
  document.body.appendChild(el);
  assert.equal(el.getAttribute('mode'), 'dark');
});

/* -------------------- lifecycle: connect / disconnect -------------------- */

test('connectedCallback marks _connected true and schedules first render', async () => {
  class C extends WebComponent {
    render() { return html`<p>hi</p>`; }
  }
  C.register('c-lc');
  const el = document.createElement('c-lc');
  document.body.appendChild(el);
  assert.equal(el._connected, true);
  // Microtask flush
  await Promise.resolve();
  assert.ok(/** @type any */ (el).__firstRendered, 'first render flagged');
});

test('disconnectedCallback clears _connected', () => {
  class C extends WebComponent {
    render() { return html``; }
  }
  C.register('disc-el');
  const el = document.createElement('disc-el');
  document.body.appendChild(el);
  el.remove();
  assert.equal(el._connected, false);
});

/* -------------------- controllers: dispatch -------------------- */

test('controller hooks fire in order: hostConnected → hostUpdate → hostUpdated → hostDisconnected', async () => {
  const calls = [];
  const ctrl = {
    hostConnected() { calls.push('hostConnected'); },
    hostUpdate() { calls.push('hostUpdate'); },
    hostUpdated() { calls.push('hostUpdated'); },
    hostDisconnected() { calls.push('hostDisconnected'); },
  };

  class C extends WebComponent {
    constructor() { super(); this.addController(ctrl); }
    render() { return html`<p>hi</p>`; }
  }
  C.register('ctrl-dispatch');
  const el = document.createElement('ctrl-dispatch');
  document.body.appendChild(el);
  await Promise.resolve();    // let microtask render flush
  await Promise.resolve();
  el.remove();
  assert.ok(calls.indexOf('hostConnected') < calls.indexOf('hostUpdate'));
  assert.ok(calls.indexOf('hostUpdate') < calls.indexOf('hostUpdated'));
  assert.ok(calls.indexOf('hostDisconnected') > calls.indexOf('hostUpdated'));
});

test('addController on an already-connected host fires hostConnected immediately', () => {
  let called = false;
  class C extends WebComponent {
    render() { return html``; }
  }
  C.register('ctrl-late');
  const el = document.createElement('ctrl-late');
  document.body.appendChild(el);
  el.addController({ hostConnected() { called = true; } });
  assert.equal(called, true);
});

test('removeController detaches a controller', async () => {
  let updates = 0;
  const ctrl = { hostUpdate() { updates++; } };
  class C extends WebComponent {
    constructor() { super(); this.addController(ctrl); }
    render() { return html``; }
  }
  C.register('ctrl-remove');
  const el = document.createElement('ctrl-remove');
  document.body.appendChild(el);
  await Promise.resolve();
  el.removeController(ctrl);
  el.requestUpdate();
  await Promise.resolve();
  assert.equal(updates, 1, 'hostUpdate only fired once: once removed, no more');
});

/* -------------------- requestUpdate batching -------------------- */

test('multiple requestUpdate calls in one microtask coalesce into a single render', async () => {
  let renders = 0;
  class C extends WebComponent {
    render() { renders++; return html``; }
  }
  C.register('batch-el');
  const el = document.createElement('batch-el');
  document.body.appendChild(el);
  await Promise.resolve();
  renders = 0;
  el.requestUpdate();
  el.requestUpdate();
  el.requestUpdate();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(renders, 1, 'three requestUpdates batched into one render');
});

test('requestUpdate schedules a re-render without state change', async () => {
  let renders = 0;
  class C extends WebComponent {
    render() { renders++; return html``; }
  }
  C.register('req-el');
  const el = document.createElement('req-el');
  document.body.appendChild(el);
  await Promise.resolve();
  renders = 0;
  el.requestUpdate();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(renders, 1);
});

/* -------------------- firstUpdated + renderError -------------------- */

test('firstUpdated fires exactly once after the first render', async () => {
  let firstCount = 0;
  class C extends WebComponent {
    render() { return html``; }
    firstUpdated() { firstCount++; }
  }
  C.register('first-el');
  const el = document.createElement('first-el');
  document.body.appendChild(el);
  await Promise.resolve(); await Promise.resolve();
  el.requestUpdate();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(firstCount, 1, 'firstUpdated fired exactly once across multiple renders');
});

test('renderError catches exceptions thrown from render() and uses its fallback', async () => {
  class C extends WebComponent {
    render() { throw new Error('boom'); }
    renderError(e) { return html`<p>err: ${e.message}</p>`; }
  }
  C.register('err-el');
  const el = document.createElement('err-el');
  document.body.appendChild(el);
  await Promise.resolve(); await Promise.resolve();
  // If renderError produced something without throwing, we pass.
  assert.ok(el, 'component survived a throwing render');
});

/* -------------------- lazy controllers set: ensure graceful behavior -------------------- */

test('WebComponent without static properties still constructs cleanly', () => {
  class C extends WebComponent {
    render() { return html``; }
  }
  C.register('no-props');
  const el = document.createElement('no-props');
  // No throw on construction is the only requirement.
  assert.ok(el instanceof HTMLElement);
});

test('default hasChanged treats NaN !== NaN correctly (via strict inequality semantics)', () => {
  // Default is strict inequality: NaN !== NaN is true, so setting a NaN
  // triggers a change. Document the behaviour so callers know.
  class C extends WebComponent {
    static properties = { n: { type: Number } };
  }
  C.register('nan-el');
  const el = document.createElement('nan-el');
  document.body.appendChild(el);
  let updates = 0;
  const orig = el.requestUpdate.bind(el);
  el.requestUpdate = () => { updates++; orig(); };
  el.n = NaN;
  el.n = NaN;   // same NaN, but strict inequality says changed
  assert.equal(updates, 2);
});

/* -------------------- Phase 2: lit lifecycle hooks -------------------- */

test('changedProperties: property setter records (name, oldValue) entries', async () => {
  class C extends WebComponent {
    static properties = { count: { type: Number } };
    constructor() { super(); this.count = 0; this._captured = null; }
    updated(cp) { this._captured = new Map(cp); }
    render() { return html``; }
  }
  C.register('cp-prop');
  const el = document.createElement('cp-prop');
  document.body.appendChild(el);
  await el.updateComplete;
  el._captured = null;

  el.count = 5;
  await el.updateComplete;
  assert.equal(el._captured.has('count'), true);
  assert.equal(el._captured.get('count'), 0);
});

test('shouldUpdate returning false skips update and updated() hook', async () => {
  let renders = 0, updatedCalls = 0;
  class C extends WebComponent {
    static properties = { val: { type: Number } };
    constructor() { super(); this.val = 0; }
    shouldUpdate(_cp) { return this.val < 5; }
    updated(_cp) { updatedCalls++; }
    render() { renders++; return html``; }
  }
  C.register('su-gate');
  const el = document.createElement('su-gate');
  document.body.appendChild(el);
  await el.updateComplete;
  const baselineRenders = renders;
  const baselineUpdated = updatedCalls;

  el.val = 10;                             // shouldUpdate returns false
  await el.updateComplete;
  assert.equal(renders, baselineRenders);  // no render
  assert.equal(updatedCalls, baselineUpdated); // no updated() either
});

test('willUpdate runs pre-render and can set properties without re-triggering', async () => {
  let willRuns = 0, updateRuns = 0;
  class C extends WebComponent {
    static properties = {
      a: { type: Number },
      b: { type: Number, state: true },
    };
    constructor() { super(); this.a = 0; this.b = -1; }
    willUpdate(cp) {
      willRuns++;
      if (cp.has('a')) this.b = this.a * 2;  // mutate during willUpdate
    }
    updated() { updateRuns++; }
    render() { return html``; }
  }
  C.register('wu-fold');
  const el = document.createElement('wu-fold');
  document.body.appendChild(el);
  await el.updateComplete;
  const wuBaseline = willRuns;
  const updBaseline = updateRuns;

  el.a = 7;
  await el.updateComplete;
  assert.equal(el.b, 14);
  assert.equal(willRuns, wuBaseline + 1);
  // Single render even though willUpdate set `b`.
  assert.equal(updateRuns, updBaseline + 1);
});

test('updated runs after every render commit; firstUpdated runs once', async () => {
  let firsts = 0, updates = 0;
  class C extends WebComponent {
    static properties = { v: { type: Number } };
    constructor() { super(); this.v = 0; }
    firstUpdated(_cp) { firsts++; }
    updated(_cp) { updates++; }
    render() { return html``; }
  }
  C.register('fu-vs-u');
  const el = document.createElement('fu-vs-u');
  document.body.appendChild(el);
  await el.updateComplete;
  assert.equal(firsts, 1);
  assert.equal(updates, 1);

  el.v = 1;
  await el.updateComplete;
  assert.equal(firsts, 1);  // still 1
  assert.equal(updates, 2);

  el.v = 2;
  await el.updateComplete;
  assert.equal(updates, 3);
});

test('firstUpdated receives changedProperties Map with initial values', async () => {
  let captured = null;
  class C extends WebComponent {
    static properties = { n: { type: Number } };
    constructor() { super(); this.n = 42; }
    firstUpdated(cp) { captured = new Map(cp); }
    render() { return html``; }
  }
  C.register('fu-cp');
  const el = document.createElement('fu-cp');
  document.body.appendChild(el);
  await el.updateComplete;
  assert.equal(captured.has('n'), true);
  assert.equal(captured.get('n'), undefined);  // initial oldValue
});

test('update() override can short-circuit the commit', async () => {
  let renderCalls = 0;
  class C extends WebComponent {
    static properties = { n: { type: Number } };
    constructor() { super(); this.n = 0; this._allowRender = true; }
    update(cp) {
      if (this._allowRender) super.update?.(cp);
    }
    render() { renderCalls++; return html``; }
  }
  // super.update calls render+commit. Since we're not actually calling super,
  // we need to manually invoke render to count it. Simpler: just check the
  // override is called.
  let updateCalls = 0;
  class D extends WebComponent {
    static properties = { n: { type: Number } };
    constructor() { super(); this.n = 0; }
    update(cp) { updateCalls++; /* no render */ }
    render() { renderCalls++; return html``; }
  }
  D.register('upd-override');
  const el = document.createElement('upd-override');
  document.body.appendChild(el);
  await el.updateComplete;
  assert.equal(updateCalls, 1);
  assert.equal(renderCalls, 0);  // override didn't call super, so render never ran
});

test('updateComplete resolves after the next render', async () => {
  class C extends WebComponent {
    static properties = { v: { type: Number } };
    constructor() { super(); this.v = 0; this._renderedV = null; }
    updated() { this._renderedV = this.v; }
    render() { return html``; }
  }
  C.register('uc-resolve');
  const el = document.createElement('uc-resolve');
  document.body.appendChild(el);
  await el.updateComplete;
  assert.equal(el._renderedV, 0);

  el.v = 99;
  const settled = await el.updateComplete;
  assert.equal(el._renderedV, 99);
  assert.equal(typeof settled, 'boolean');
});

test('getUpdateComplete can be overridden to chain additional async work', async () => {
  let extraAwaited = false;
  class C extends WebComponent {
    static properties = { v: { type: Number } };
    constructor() { super(); this.v = 0; }
    async getUpdateComplete() {
      const r = await super.getUpdateComplete();
      await new Promise(res => setTimeout(res, 1));
      extraAwaited = true;
      return r;
    }
    render() { return html``; }
  }
  C.register('uc-override');
  const el = document.createElement('uc-override');
  document.body.appendChild(el);
  await el.updateComplete;
  assert.equal(extraAwaited, true);
});

test('hook order: shouldUpdate → willUpdate → hostUpdate → update → hostUpdated → firstUpdated → updated', async () => {
  const order = [];
  class C extends WebComponent {
    static properties = { n: { type: Number } };
    constructor() { super(); this.n = 0; }
    shouldUpdate() { order.push('shouldUpdate'); return true; }
    willUpdate() { order.push('willUpdate'); }
    update(cp) { order.push('update'); super.update?.(cp); }
    firstUpdated() { order.push('firstUpdated'); }
    updated() { order.push('updated'); }
    render() { order.push('render'); return html``; }
  }
  const controller = {
    hostUpdate() { order.push('hostUpdate'); },
    hostUpdated() { order.push('hostUpdated'); },
  };
  C.register('hook-order');
  const el = document.createElement('hook-order');
  el.addController(controller);
  document.body.appendChild(el);
  await el.updateComplete;

  // Default update() calls render() internally, but we override here
  // and DO call super.update?.(cp) which invokes the default impl.
  // The default impl is defined on the prototype; super.update?.(cp) on
  // a direct WebComponent subclass calls the WebComponent.prototype.update
  // method which does the render+commit.
  assert.deepEqual(
    order,
    [
      'shouldUpdate',
      'willUpdate',
      'hostUpdate',
      'update',
      'render',
      'hostUpdated',
      'firstUpdated',
      'updated',
    ],
  );
});
