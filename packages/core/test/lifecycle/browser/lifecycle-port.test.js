/**
 * Port of lit's reactive-element_test.ts → webjs.
 *
 * Source (lit upstream):
 *   packages/reactive-element/src/test/reactive-element_test.ts (3979 lines)
 *
 * This file ports the BEHAVIORAL Phase-2 lifecycle and property tests that
 * webjs's `WebComponent` claims lit-aligned parity for. The goal is to
 * surface bugs in webjs's port BEFORE the parity work merges. Failing tests
 * here imply either a real bug, an intentional divergence, or a port
 * mismatch (documented in the final report).
 *
 * Scope mirrors the cheat sheet in the task description. Decorator-only
 * tests, `@property({ attribute: ... })` options webjs doesn't yet support,
 * dev-mode warnings, lit internals (`finalize`, `addInitializer`,
 * `elementProperties`), and `noChange` / `nothing` sentinels are skipped.
 *
 * webjs-specific notes baked into the port:
 *   - Lifecycle hook throws are caught + logged by webjs (component does
 *     not deadlock). Two tests assert recovery semantics.
 *   - All hooks are client-only. SSR doesn't invoke them. Not tested here
 *     (this is the browser suite).
 */
import { html } from '../../../src/html.js';
import { WebComponent, prop } from '../../../src/component.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  notOk: (v, msg) => { if (v) throw new Error(msg || `Expected falsy, got ${v}`); },
  isTrue: (v, msg) => { if (v !== true) throw new Error(msg || `Expected true, got ${v}`); },
  isFalse: (v, msg) => { if (v !== false) throw new Error(msg || `Expected false, got ${v}`); },
  isNaN: (v, msg) => { if (!Number.isNaN(v)) throw new Error(msg || `Expected NaN, got ${v}`); },
  equal: (a, b, msg) => {
    if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  },
  notEqual: (a, b, msg) => {
    if (a === b) throw new Error(msg || `Expected not equal to ${JSON.stringify(b)}`);
  },
  deepEqual: (a, b, msg) => {
    const norm = (v) => {
      if (v instanceof Map) return ['__map__', [...v.entries()].map(([k, vv]) => [k, norm(vv)])];
      if (Array.isArray(v)) return v.map(norm);
      if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v).sort()) out[k] = norm(v[k]);
        return out;
      }
      if (Number.isNaN(v)) return '__NaN__';
      return v;
    };
    const aS = JSON.stringify(norm(a));
    const bS = JSON.stringify(norm(b));
    if (aS !== bS) throw new Error(msg || `deepEqual failed:\n  got    : ${aS}\n  expect : ${bS}`);
  },
  throws: async (fn, msg) => {
    let threw = false;
    try { await fn(); } catch { threw = true; }
    if (!threw) throw new Error(msg || 'Expected function to throw');
  },
};

let __ctr = 0;
const tag = (prefix) => `${prefix}-${++__ctr}`;

/** Suppress noisy console.error from intentional throw-recovery tests. */
function withSilencedErrors(fn) {
  const origError = console.error;
  console.error = () => {};
  return Promise.resolve(fn()).finally(() => { console.error = origError; });
}

suite('Lifecycle/property port from lit reactive-element_test.ts', () => {

  // ───────────────────────────────────────────────────────────────────────
  // updateComplete + requestUpdate
  // ───────────────────────────────────────────────────────────────────────

  test('updateComplete waits for requestUpdate but a no-name call still triggers an update', async () => {
    let updates = 0;
    class E extends WebComponent {
      update(cp) { updates++; super.update(cp); }
      render() { return html`<p>ok</p>`; }
    }
    const t = tag('lp-uc-noname');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(updates, 1);
    el.requestUpdate();
    await el.updateComplete;
    // webjs's requestUpdate() without a name still schedules an update
    // (it triggers _scheduleUpdate unconditionally), matching the lit
    // semantics where requestUpdate() with no args forces a render.
    assert.equal(updates, 2, 'requestUpdate() with no args still re-renders');
    el.remove();
  });

  test('requestUpdate(name, oldValue) populates changedProperties with the prior value', async () => {
    let captured;
    class E extends WebComponent({ foo: String }) {
      constructor() { super(); this.foo = 'a'; }
      updated(cp) { captured = new Map(cp); }
      render() { return html`<p>${this.foo}</p>`; }
    }
    const t = tag('lp-uc-reqold');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;

    // Manually call requestUpdate with an explicit oldValue. The map entry
    // should preserve the passed oldValue, not the current property value.
    el.requestUpdate('foo', 'sentinel-old');
    await el.updateComplete;
    assert.ok(captured.has('foo'));
    assert.equal(captured.get('foo'), 'sentinel-old');
    el.remove();
  });

  test('updateComplete resolves to true when nothing more is pending', async () => {
    class E extends WebComponent({ v: Number }) {
      constructor() { super(); this.v = 0; }
      render() { return html`<p>${this.v}</p>`; }
    }
    const t = tag('lp-uc-true');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    const settled = await el.updateComplete;
    assert.equal(settled, true);
    el.remove();
  });

  // ───────────────────────────────────────────────────────────────────────
  // shouldUpdate gate
  // ───────────────────────────────────────────────────────────────────────

  test('shouldUpdate controls whether update runs', async () => {
    let allow = true;
    let updates = 0;
    class E extends WebComponent({ foo: Number }) {
      constructor() { super(); this.foo = 0; }
      shouldUpdate() { return allow; }
      update(cp) { updates++; super.update(cp); }
      render() { return html`<p>${this.foo}</p>`; }
    }
    const t = tag('lp-su-control');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(updates, 1, 'initial update ran');

    allow = false;
    el.foo = 1;
    await el.updateComplete;
    assert.equal(updates, 1, 'gated update did not run update()');

    allow = true;
    el.foo = 2;
    await el.updateComplete;
    assert.equal(updates, 2, 'ungated update ran');
    el.remove();
  });

  test('firstUpdated still fires the first time update commits, even if shouldUpdate=false initially', async () => {
    // Ported intent: lit fires firstUpdated when the FIRST actual update
    // commits, not when the FIRST scheduled render is requested.
    let firsts = 0;
    let allow = false;
    class E extends WebComponent({ foo: Number }) {
      constructor() { super(); this.foo = 0; }
      shouldUpdate() { return allow; }
      firstUpdated() { firsts++; }
      render() { return html`<p>${this.foo}</p>`; }
    }
    const t = tag('lp-fu-first');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(firsts, 0, 'firstUpdated did not fire while gated');

    allow = true;
    el.foo = 1;
    await el.updateComplete;
    assert.equal(firsts, 1, 'firstUpdated fires on the first committed render');

    el.foo = 2;
    await el.updateComplete;
    assert.equal(firsts, 1, 'firstUpdated stays at 1 across later renders');
    el.remove();
  });

  // ───────────────────────────────────────────────────────────────────────
  // willUpdate folds into current cycle
  // ───────────────────────────────────────────────────────────────────────

  test('willUpdate may mutate properties without triggering a second cycle', async () => {
    let renders = 0;
    class E extends WebComponent({
      foo: Number,
      bar: prop(Number, { state: true }),
    }) {
      constructor() { super(); this.foo = 0; this.bar = -1; }
      willUpdate(cp) {
        if (cp.has('foo')) this.bar = this.foo + 100;
      }
      render() { renders++; return html`<p>${this.foo}/${this.bar}</p>`; }
    }
    const t = tag('lp-wu-fold');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    const baseline = renders;
    el.foo = 7;
    await el.updateComplete;
    assert.equal(renders - baseline, 1, 'exactly one new render');
    assert.equal(el.bar, 107);
    el.remove();
  });

  test('willUpdate-mutated property appears in changedProperties for the same cycle', async () => {
    let captured;
    class E extends WebComponent({
      foo: Number,
      derived: prop(Number, { state: true }),
    }) {
      constructor() { super(); this.foo = 0; this.derived = 0; }
      willUpdate(cp) {
        if (cp.has('foo')) this.derived = this.foo * 10;
      }
      updated(cp) { captured = new Map(cp); }
      render() { return html`<p>${this.derived}</p>`; }
    }
    const t = tag('lp-wu-cp');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;

    el.foo = 5;
    await el.updateComplete;
    assert.ok(captured.has('foo'), 'foo in changedProperties');
    assert.ok(captured.has('derived'), 'willUpdate-mutated derived in changedProperties');
    el.remove();
  });

  // ───────────────────────────────────────────────────────────────────────
  // update() default + override semantics
  // ───────────────────────────────────────────────────────────────────────

  test('overriding update without calling super.update skips the commit', async () => {
    // Webjs default update() calls render() + commits. An override that
    // doesn't call super should still let updated()/firstUpdated() fire
    // (because didCommit is set by entry to the cycle), but no DOM should
    // be committed.
    class E extends WebComponent({ foo: Number }) {
      constructor() { super(); this.foo = 0; }
      update(_cp) { /* intentionally no super.update */ }
      render() { return html`<p>should-not-appear-${this.foo}</p>`; }
    }
    const t = tag('lp-up-nosuper');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    // No <p> committed.
    assert.equal(el.querySelector('p'), null, 'no DOM was committed');
    el.remove();
  });

  test('overriding update + calling super commits DOM and updated() observes it', async () => {
    let updatedCp;
    class E extends WebComponent({ foo: Number }) {
      constructor() { super(); this.foo = 0; }
      update(cp) {
        // mutate AFTER super: per lit semantics this triggers another cycle
        super.update(cp);
      }
      updated(cp) { updatedCp = new Map(cp); }
      render() { return html`<p>${this.foo}</p>`; }
    }
    const t = tag('lp-up-super');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.querySelector('p').textContent, '0');
    assert.ok(updatedCp);
    el.remove();
  });

  // ───────────────────────────────────────────────────────────────────────
  // updated runs every cycle, firstUpdated runs once
  // ───────────────────────────────────────────────────────────────────────

  test('updated runs every render commit; firstUpdated runs exactly once', async () => {
    let firsts = 0;
    let updates = 0;
    class E extends WebComponent({ v: Number }) {
      constructor() { super(); this.v = 0; }
      firstUpdated() { firsts++; }
      updated() { updates++; }
      render() { return html`<p>${this.v}</p>`; }
    }
    const t = tag('lp-fu-many');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(firsts, 1);
    assert.equal(updates, 1);
    el.v = 1; await el.updateComplete;
    el.v = 2; await el.updateComplete;
    el.v = 3; await el.updateComplete;
    assert.equal(firsts, 1);
    assert.equal(updates, 4);
    el.remove();
  });

  // ───────────────────────────────────────────────────────────────────────
  // Hook ordering: shouldUpdate → willUpdate → hostUpdate → update →
  //                hostUpdated → firstUpdated → updated
  // ───────────────────────────────────────────────────────────────────────

  test('update lifecycle order (incl. controllers + post-commit hooks)', async () => {
    const order = [];
    const controller = {
      hostConnected() { order.push('hostConnected'); },
      hostUpdate() { order.push('hostUpdate'); },
      hostUpdated() { order.push('hostUpdated'); },
      hostDisconnected() { order.push('hostDisconnected'); },
    };
    class E extends WebComponent({ foo: Number }) {
      constructor() { super(); this.foo = 0; this.addController(controller); }
      shouldUpdate() { order.push('shouldUpdate'); return true; }
      willUpdate() { order.push('willUpdate'); }
      update(cp) { order.push('before-update'); super.update(cp); order.push('after-update'); }
      firstUpdated() { order.push('firstUpdated'); }
      updated() { order.push('updated'); }
      render() { return html`<p>${this.foo}</p>`; }
    }
    const t = tag('lp-order');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    order.push('updateComplete');

    assert.deepEqual(order, [
      'hostConnected',
      'shouldUpdate',
      'willUpdate',
      'hostUpdate',
      'before-update',
      'after-update',
      'hostUpdated',
      'firstUpdated',
      'updated',
      'updateComplete',
    ]);
    el.remove();
  });

  // ───────────────────────────────────────────────────────────────────────
  // changedProperties Map: keys, old values, accumulation
  // ───────────────────────────────────────────────────────────────────────

  test('changedProperties has only initial keys on the first render with undefined olds', async () => {
    let cpSnapshot;
    class E extends WebComponent({ foo: Number, bar: String }) {
      constructor() { super(); this.foo = 1; this.bar = 'x'; }
      updated(cp) { cpSnapshot = new Map(cp); }
      render() { return html`<p>${this.foo}-${this.bar}</p>`; }
    }
    const t = tag('lp-cp-initial');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    // Both initial values should be in the map.
    assert.ok(cpSnapshot.has('foo'));
    assert.ok(cpSnapshot.has('bar'));
    assert.equal(cpSnapshot.get('foo'), undefined);
    assert.equal(cpSnapshot.get('bar'), undefined);
    el.remove();
  });

  test('subsequent renders record only the changed key with the prior value', async () => {
    let cp;
    class E extends WebComponent({ a: Number, b: Number }) {
      constructor() { super(); this.a = 1; this.b = 2; }
      updated(c) { cp = new Map(c); }
      render() { return html`<p>${this.a}/${this.b}</p>`; }
    }
    const t = tag('lp-cp-subseq');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;

    el.a = 5;
    await el.updateComplete;
    assert.ok(cp.has('a'));
    assert.equal(cp.get('a'), 1, 'oldValue is the prior value');
    assert.equal(cp.has('b'), false, 'unchanged prop NOT in map');
    el.remove();
  });

  test('changedProperties is fresh per cycle (not cumulative across renders)', async () => {
    const snapshots = [];
    class E extends WebComponent({ a: Number, b: Number }) {
      constructor() { super(); this.a = 0; this.b = 0; }
      updated(cp) { snapshots.push([...cp.keys()].sort()); }
      render() { return html`<p>${this.a}/${this.b}</p>`; }
    }
    const t = tag('lp-cp-fresh');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    el.a = 1; await el.updateComplete;
    el.b = 2; await el.updateComplete;
    // Cycle 1: both initial keys. Cycle 2: ['a']. Cycle 3: ['b'].
    assert.deepEqual(snapshots[0], ['a', 'b']);
    assert.deepEqual(snapshots[1], ['a']);
    assert.deepEqual(snapshots[2], ['b']);
    el.remove();
  });

  test('batching: two synchronous property writes coalesce into one cycle', async () => {
    let renders = 0;
    let cp;
    class E extends WebComponent({ a: Number, b: Number }) {
      constructor() { super(); this.a = 0; this.b = 0; }
      updated(c) { cp = new Map(c); }
      render() { renders++; return html`<p>${this.a}/${this.b}</p>`; }
    }
    const t = tag('lp-batch');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    const baseline = renders;

    el.a = 7;
    el.b = 8;
    await el.updateComplete;
    assert.equal(renders - baseline, 1, 'two writes batch into one render');
    assert.ok(cp.has('a') && cp.has('b'));
    el.remove();
  });

  test('shouldUpdate=false preserves changedProperties for the next cycle (lit parity)', async () => {
    // Lit: when shouldUpdate returns false, changedProperties is NOT cleared,
    // so the next requestUpdate sees the accumulated entries.
    let allow = false;  // gate from the very first cycle
    const seen = [];
    class E extends WebComponent({ a: Number, b: Number }) {
      constructor() { super(); this.a = 0; this.b = 0; }
      shouldUpdate() { return allow; }
      updated(cp) { seen.push([...cp.keys()].sort()); }
      render() { return html`<p>${this.a}/${this.b}</p>`; }
    }
    const t = tag('lp-su-preserve');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;  // gated: updated() not called
    assert.deepEqual(seen, []);

    el.a = 1;
    await el.updateComplete;
    el.b = 2;
    await el.updateComplete;
    assert.deepEqual(seen, [], 'still gated');

    allow = true;
    el.a = 3;
    await el.updateComplete;
    assert.equal(seen.length, 1, 'one cycle ran since the gate opened');
    const keys = seen[0];
    assert.ok(keys.includes('a'), 'a was carried through');
    assert.ok(keys.includes('b'), 'b was carried through');
    el.remove();
  });

  // ───────────────────────────────────────────────────────────────────────
  // Property reactivity: type, reflect, state, hasChanged, converter
  // ───────────────────────────────────────────────────────────────────────

  test('type: Number coerces attribute', async () => {
    class E extends WebComponent({ count: Number }) {
      render() { return html`<p>${this.count}</p>`; }
    }
    const t = tag('lp-type-num');
    customElements.define(t, E);
    const el = document.createElement(t);
    el.setAttribute('count', '42');
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.count, 42);
    assert.equal(typeof el.count, 'number');
    el.remove();
  });

  test('type: Boolean coerces attribute presence', async () => {
    class E extends WebComponent({ open: Boolean }) {
      render() { return html`<p>${String(this.open)}</p>`; }
    }
    const t = tag('lp-type-bool');
    customElements.define(t, E);
    const el = document.createElement(t);
    el.setAttribute('open', '');
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.open, true);
    el.removeAttribute('open');
    await el.updateComplete;
    assert.equal(el.open, false);
    el.remove();
  });

  test('type: Object parses JSON attribute', async () => {
    class E extends WebComponent({ data: Object }) {
      render() { return html`<p>${this.data && this.data.name}</p>`; }
    }
    const t = tag('lp-type-obj');
    customElements.define(t, E);
    const el = document.createElement(t);
    el.setAttribute('data', '{"name":"alice","age":30}');
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.data.name, 'alice');
    assert.equal(el.data.age, 30);
    el.remove();
  });

  test('reflect: true writes property changes back to the attribute', async () => {
    class E extends WebComponent({ count: prop(Number, { reflect: true }) }) {
      constructor() { super(); this.count = 0; }
      render() { return html`<p>${this.count}</p>`; }
    }
    const t = tag('lp-reflect');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    el.count = 5;
    await el.updateComplete;
    assert.equal(el.getAttribute('count'), '5');
    el.remove();
  });

  test('reflect: true with Boolean toggles attribute presence', async () => {
    class E extends WebComponent({ open: prop(Boolean, { reflect: true }) }) {
      constructor() { super(); this.open = false; }
      render() { return html`<p>${String(this.open)}</p>`; }
    }
    const t = tag('lp-reflect-bool');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.equal(el.hasAttribute('open'), false);
    el.open = true;
    await el.updateComplete;
    assert.equal(el.hasAttribute('open'), true);
    el.open = false;
    await el.updateComplete;
    assert.equal(el.hasAttribute('open'), false);
    el.remove();
  });

  test('state: true excludes the property from observedAttributes', () => {
    class E extends WebComponent({
      pub: String,
      priv: prop(String, { state: true }),
    }) {
      render() { return html``; }
    }
    const observed = E.observedAttributes;
    assert.ok(observed.includes('pub'));
    assert.equal(observed.includes('priv'), false);
  });

  test('hasChanged: false skips the update', async () => {
    let renders = 0;
    class E extends WebComponent({
      // Treat undefined as "always different" so the initial assignment
      // actually lands (otherwise hasChanged(n, undefined) -> NaN > 1 -> false
      // and the constructor's `this.size = 10` is rejected).
      size: prop(Number, {
        hasChanged: (n, o) => o === undefined || Math.abs(n - o) > 1,
      }),
    }) {
      constructor() { super(); this.size = 10; }
      render() { renders++; return html`<p>${this.size}</p>`; }
    }
    const t = tag('lp-haschanged');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    const baseline = renders;
    assert.equal(el.size, 10);

    el.size = 10.5;  // delta < 1: no update
    await el.updateComplete;
    assert.equal(renders, baseline, 'small change skipped');
    assert.equal(el.size, 10, 'value not stored on a skipped change');

    el.size = 20;  // delta > 1: updates
    await el.updateComplete;
    assert.equal(renders, baseline + 1);
    el.remove();
  });

  test('converter.fromAttribute customizes attribute → property coercion', async () => {
    class E extends WebComponent({
      list: prop({
        converter: { fromAttribute: (v) => v ? v.split(',').map(Number) : [] },
      }),
    }) {
      render() { return html`<p>${this.list && this.list.join('|')}</p>`; }
    }
    const t = tag('lp-conv-from');
    customElements.define(t, E);
    const el = document.createElement(t);
    el.setAttribute('list', '1,2,3');
    document.body.appendChild(el);
    await el.updateComplete;
    assert.deepEqual(el.list, [1, 2, 3]);
    el.remove();
  });

  test('converter.toAttribute customizes property → attribute reflection', async () => {
    class E extends WebComponent({
      coords: prop({
        reflect: true,
        converter: {
          fromAttribute: (v) => v ? v.split(',').map(Number) : null,
          toAttribute: (v) => v ? v.join(',') : null,
        },
      }),
    }) {
      constructor() { super(); this.coords = null; }
      render() { return html``; }
    }
    const t = tag('lp-conv-to');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    el.coords = [3, 4];
    await el.updateComplete;
    assert.equal(el.getAttribute('coords'), '3,4');
    el.coords = null;
    await el.updateComplete;
    assert.equal(el.hasAttribute('coords'), false);
    el.remove();
  });

  // ───────────────────────────────────────────────────────────────────────
  // attributeChangedCallback → changedProperties
  // ───────────────────────────────────────────────────────────────────────

  test('attribute change flows through to property + changedProperties', async () => {
    let lastCp;
    class E extends WebComponent({ foo: String }) {
      constructor() { super(); this.foo = 'a'; }
      updated(cp) { lastCp = new Map(cp); }
      render() { return html`<p>${this.foo}</p>`; }
    }
    const t = tag('lp-acc');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;

    el.setAttribute('foo', 'b');
    await el.updateComplete;
    assert.equal(el.foo, 'b');
    assert.ok(lastCp.has('foo'));
    el.remove();
  });

  // ───────────────────────────────────────────────────────────────────────
  // updateComplete advanced semantics
  // ───────────────────────────────────────────────────────────────────────

  test('setting properties in updated() schedules another cycle; updateComplete eventually returns true', async () => {
    // Webjs intentional divergence from lit: webjs schedules the follow-up
    // cycle via raw queueMicrotask, which runs BEFORE the await-continuation
    // of the resolving updateComplete promise. So a single `await updateComplete`
    // may observe more than one extra cycle having already run. Lit chains the
    // next cycle through `await __updatePromise`, gating it on the awaiter.
    // We assert the eventual fixed-point only.
    let updates = 0;
    class E extends WebComponent({ foo: Number }) {
      constructor() { super(); this.foo = 0; }
      update(cp) { updates++; super.update(cp); }
      updated() { if (this.foo < 2) this.foo++; }
      render() { return html`<p>${this.foo}</p>`; }
    }
    const t = tag('lp-uc-updated-sched');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    let safety = 50;
    while (!(await el.updateComplete) && safety-- > 0) { /* spin until settled */ }
    assert.equal(el.foo, 2, 'fixed point reached');
    assert.ok(updates >= 3, 'at least 3 update() calls ran');
    el.remove();
  });

  test('updateComplete can be awaited in a loop until it returns true', async () => {
    class E extends WebComponent({ foo: Number }) {
      constructor() { super(); this.foo = 0; }
      updated() { if (this.foo < 5) this.foo++; }
      render() { return html`<p>${this.foo}</p>`; }
    }
    const t = tag('lp-uc-loop');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    let safety = 50;
    while (!(await el.updateComplete) && safety-- > 0) { /* spin */ }
    assert.equal(el.foo, 5);
    el.remove();
  });

  test('getUpdateComplete override can chain additional async work', async () => {
    let extraDone = false;
    class E extends WebComponent({ v: Number }) {
      constructor() { super(); this.v = 0; }
      async getUpdateComplete() {
        const r = await super.getUpdateComplete();
        await new Promise(res => setTimeout(res, 5));
        extraDone = true;
        return r;
      }
      render() { return html`<p>${this.v}</p>`; }
    }
    const t = tag('lp-uc-extra');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.ok(extraDone);
    el.remove();
  });

  test('updateComplete promise lifecycle: same promise across pending updates, new after settle', async () => {
    class E extends WebComponent({ v: Number }) {
      constructor() { super(); this.v = 0; }
      render() { return html`<p>${this.v}</p>`; }
    }
    const t = tag('lp-uc-promise');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    const p1 = el.updateComplete;
    const p2 = el.updateComplete;
    assert.equal(p1, p2, 'same pending promise');
    await p1;
    el.v = 1;
    const p3 = el.updateComplete;
    assert.notEqual(p1, p3, 'new cycle produces a new promise');
    await p3;
    el.remove();
  });

  // ───────────────────────────────────────────────────────────────────────
  // Error recovery: a throwing hook does NOT deadlock
  // ───────────────────────────────────────────────────────────────────────

  test('throwing willUpdate does not deadlock: next requestUpdate still renders', async () => {
    await withSilencedErrors(async () => {
      let throws = true;
      class E extends WebComponent({ v: Number }) {
        constructor() { super(); this.v = 0; }
        willUpdate() {
          if (throws) { throws = false; throw new Error('willUpdate boom'); }
        }
        render() { return html`<p>v=${this.v}</p>`; }
      }
      const t = tag('lp-err-will');
      customElements.define(t, E);
      const el = document.createElement(t);
      document.body.appendChild(el);

      // Promise resolves despite throw (no deadlock).
      let resolved = false;
      const timed = Promise.race([
        el.updateComplete.then(() => { resolved = true; }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('deadlock')), 200)),
      ]);
      await timed;
      assert.ok(resolved);

      el.v = 7;
      await el.updateComplete;
      assert.equal(el.querySelector('p').textContent, 'v=7');
      el.remove();
    });
  });

  test('throwing updated does not deadlock', async () => {
    await withSilencedErrors(async () => {
      let throws = true;
      class E extends WebComponent({ v: Number }) {
        constructor() { super(); this.v = 0; }
        updated() {
          if (throws) { throws = false; throw new Error('updated boom'); }
        }
        render() { return html`<p>v=${this.v}</p>`; }
      }
      const t = tag('lp-err-updated');
      customElements.define(t, E);
      const el = document.createElement(t);
      document.body.appendChild(el);

      let resolved = false;
      await Promise.race([
        el.updateComplete.then(() => { resolved = true; }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('deadlock')), 200)),
      ]);
      assert.ok(resolved);
      el.v = 9;
      await el.updateComplete;
      assert.equal(el.querySelector('p').textContent, 'v=9');
      el.remove();
    });
  });

  test('throwing firstUpdated does not deadlock', async () => {
    await withSilencedErrors(async () => {
      let throws = true;
      class E extends WebComponent({ v: Number }) {
        constructor() { super(); this.v = 0; }
        firstUpdated() {
          if (throws) { throws = false; throw new Error('firstUpdated boom'); }
        }
        render() { return html`<p>v=${this.v}</p>`; }
      }
      const t = tag('lp-err-first');
      customElements.define(t, E);
      const el = document.createElement(t);
      document.body.appendChild(el);

      let resolved = false;
      await Promise.race([
        el.updateComplete.then(() => { resolved = true; }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('deadlock')), 200)),
      ]);
      assert.ok(resolved);
      // Subsequent updates work; firstUpdated should NOT re-fire.
      let firstReran = false;
      Object.defineProperty(E.prototype, 'firstUpdated', {
        configurable: true,
        value: () => { firstReran = true; },
      });
      el.v = 3;
      await el.updateComplete;
      assert.equal(firstReran, false, 'firstUpdated does not re-fire after the throw');
      el.remove();
    });
  });

  test('throwing render() routes to renderError() fallback and does not deadlock', async () => {
    await withSilencedErrors(async () => {
      let throws = true;
      class E extends WebComponent({ v: Number }) {
        constructor() { super(); this.v = 0; }
        render() {
          if (throws) { throws = false; throw new Error('render boom'); }
          return html`<p>ok-${this.v}</p>`;
        }
        renderError(e) { return html`<p class="err">err:${e.message}</p>`; }
      }
      const t = tag('lp-err-render');
      customElements.define(t, E);
      const el = document.createElement(t);
      document.body.appendChild(el);
      await el.updateComplete;
      assert.ok(el.querySelector('.err'), 'fallback was rendered');
      // Recovery: next update should re-render successfully.
      el.v = 2;
      await el.updateComplete;
      assert.equal(el.querySelector('p').textContent, 'ok-2');
      el.remove();
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // _isUpdating: re-entrant requestUpdate during the update phase folds
  // ───────────────────────────────────────────────────────────────────────

  test('requestUpdate during willUpdate folds into current cycle (no extra microtask)', async () => {
    let renders = 0;
    class E extends WebComponent({ a: Number, b: prop(Number, { state: true }) }) {
      constructor() { super(); this.a = 0; this.b = 0; }
      willUpdate(cp) {
        if (cp.has('a')) this.requestUpdate('b', this.b);
      }
      render() { renders++; return html`<p>${this.a}/${this.b}</p>`; }
    }
    const t = tag('lp-isupdating-will');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    await el.updateComplete;
    const baseline = renders;
    el.a = 5;
    await el.updateComplete;
    assert.equal(renders - baseline, 1, 'exactly one new render');
    el.remove();
  });

  test('requestUpdate inside updated() (after _isUpdating clears) schedules a NEW cycle', async () => {
    // After updated() runs, _isUpdating has been cleared, so a fresh
    // requestUpdate() must enqueue a new microtask render (not fold into
    // the cycle that's just settled).
    let renders = 0;
    let scheduled = false;
    class E extends WebComponent({ v: Number }) {
      constructor() { super(); this.v = 0; }
      updated() {
        if (!scheduled) {
          scheduled = true;
          this.requestUpdate();
        }
      }
      render() { renders++; return html`<p>${this.v}</p>`; }
    }
    const t = tag('lp-isupdating-updated');
    customElements.define(t, E);
    const el = document.createElement(t);
    document.body.appendChild(el);
    // Spin until settled; webjs's scheduler may race the next microtask
    // ahead of the awaiter so we don't pin the first-await return value.
    let safety = 20;
    while (!(await el.updateComplete) && safety-- > 0) { /* spin */ }
    assert.ok(renders >= 2, 'updated() did schedule a follow-up render');
    el.remove();
  });

  // ───────────────────────────────────────────────────────────────────────
  // Disconnected behavior
  // ───────────────────────────────────────────────────────────────────────

  test('update does not occur before connect; scheduled updates run on connection', async () => {
    let renders = 0;
    class E extends WebComponent({ v: Number }) {
      constructor() { super(); this.v = 0; }
      render() { renders++; return html`<p>${this.v}</p>`; }
    }
    const t = tag('lp-disconn');
    customElements.define(t, E);
    const el = document.createElement(t);
    // Set before connecting; the scheduler should not fire render() yet.
    el.v = 42;
    // Yield a microtask to confirm no render happens off-DOM.
    await Promise.resolve();
    assert.equal(renders, 0);
    document.body.appendChild(el);
    await el.updateComplete;
    assert.ok(renders >= 1);
    el.remove();
  });

  // ───────────────────────────────────────────────────────────────────────
  // Sub-element updateComplete (composition)
  // ───────────────────────────────────────────────────────────────────────

  test('can await a sub-element updateComplete from getUpdateComplete', async () => {
    class Child extends WebComponent({ x: Number }) {
      constructor() { super(); this.x = 0; }
      render() { return html`<span>${this.x}</span>`; }
    }
    customElements.define('lp-sub-child', Child);

    class Parent extends WebComponent({ v: Number }) {
      constructor() { super(); this.v = 0; }
      async getUpdateComplete() {
        const r = await super.getUpdateComplete();
        const child = this.querySelector('lp-sub-child');
        if (child) await child.updateComplete;
        return r;
      }
      render() { return html`<lp-sub-child .x=${this.v}></lp-sub-child>`; }
    }
    customElements.define('lp-sub-parent', Parent);

    const el = document.createElement('lp-sub-parent');
    document.body.appendChild(el);
    await el.updateComplete;
    el.v = 7;
    await el.updateComplete;
    // After parent.updateComplete, child should be settled.
    const child = el.querySelector('lp-sub-child');
    assert.equal(child.x, 7);
    el.remove();
  });

});
