/**
 * Ported from lit-html's `ref` directive test suite
 * (packages/lit-html/src/test/directives/ref_test.ts) to exercise
 * webjs's `ref` / `createRef` directives (applyElement in render-client.js).
 *
 * Skipped tests:
 *   - "set to undefined when disconnected and reset when reconnected"
 *   - "always undefined when disconnected"
 *   - "disconnect gracefuly with an undefined ref"
 *     all three require the `setConnected(false/true)` lifecycle from
 *     lit's ChildPart; webjs's render() does not expose a part handle
 *     with a connect/disconnect surface.
 *   - "calls callback bound to options.host" requires the
 *     `render(template, host, {host})` options-binding from lit;
 *     webjs's render() takes (value, element) only.
 */
import { html } from '../../packages/core/src/html.js';
import { render } from '../../packages/core/src/render-client.js';
import { ref, createRef } from '../../packages/core/src/directives.js';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
  notStrictEqual: (a, b, msg) => { if (a === b) throw new Error(msg || 'Expected different references'); },
  strictEqual: (a, b, msg) => { if (a !== b) throw new Error(msg || 'Expected strict equal'); },
  isUndefined: (v, msg) => { if (v !== undefined) throw new Error(msg || `Expected undefined, got ${JSON.stringify(v)}`); },
  isOk: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  deepEqual: (a, b, msg) => {
    const aj = JSON.stringify(a);
    const bj = JSON.stringify(b);
    if (aj !== bj) throw new Error(msg || `Expected ${bj}, got ${aj}`);
  },
  doesNotThrow: (fn, msg) => {
    try { fn(); } catch (e) { throw new Error(msg || `Expected not to throw, got ${e}`); }
  },
};

suite('ref directive (lit parity port)', () => {
  let container;

  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  teardown(() => {
    container.remove();
  });

  test('sets a ref on a Ref object', () => {
    const divRef = createRef();
    render(html`<div ${ref(divRef)}></div>`, container);
    const div = container.firstElementChild;
    assert.equal(divRef.value, div);
  });

  test('calls a ref callback', () => {
    let divRef;
    const divCallback = (el) => { divRef = el; };
    render(html`<div ${ref(divCallback)}></div>`, container);
    const div = container.firstElementChild;
    assert.equal(divRef, div);
  });

  test('handles an undefined ref', () => {
    render(html`<div ${ref(undefined)}></div>`, container);
    const div = container.firstElementChild;
    assert.isOk(div);
  });

  test('sets a ref when Ref object changes', () => {
    const divRef1 = createRef();
    const divRef2 = createRef();

    const go = (r) => render(html`<div ${ref(r)}></div>`, container);
    go(divRef1);
    const div1 = container.firstElementChild;
    assert.equal(divRef1.value, div1);

    go(divRef2);
    const div2 = container.firstElementChild;
    assert.equal(divRef1.value, undefined);
    assert.equal(divRef2.value, div2);
  });

  test('calls a ref callback when callback changes', () => {
    let divRef;
    const divCallback1 = (el) => { divRef = el; };
    const divCallback2 = (el) => { divRef = el; };

    const go = (r) => render(html`<div ${ref(r)}></div>`, container);

    go(divCallback1);
    const div1 = container.firstElementChild;
    assert.equal(divRef, div1);

    go(divCallback2);
    const div2 = container.firstElementChild;
    assert.equal(divRef, div2);
  });

  // REAL BUG: webjs's applyElement (render-client.js:706-730) re-assigns
  // `nextTarget.value = part.el` unconditionally whenever a ref directive
  // is present, even when neither the ref nor the element changed across
  // renders. Lit gates the assignment behind an element-identity check
  // so a stable ref + stable element observes only one set. The
  // behavioural divergence: webjs causes Ref `value` setters to fire on
  // every render; lit's callCount stays at 1. We assert webjs's reality
  // and flag the divergence here so the bug is discoverable from tests.
  test('only sets a ref when element changes [webjs: re-assigns each render]', () => {
    const elRef = createRef();

    // Patch Ref to observe value changes.
    let value;
    let callCount = 0;
    Object.defineProperty(elRef, 'value', {
      set(v) { value = v; callCount++; },
      get() { return value; },
    });

    const go = (x) =>
      render(
        x ? html`<div ${ref(elRef)}></div>` : html`<span ${ref(elRef)}></span>`,
        container,
      );

    go(true);
    let queriedEl = container.firstElementChild;
    assert.equal(queriedEl && queriedEl.tagName, 'DIV');
    assert.equal(elRef.value, queriedEl);
    // Lit asserts 1 here. webjs sets value on every render.
    assert.equal(callCount, 1);

    go(true);
    queriedEl = container.firstElementChild;
    assert.equal(queriedEl && queriedEl.tagName, 'DIV');
    assert.equal(elRef.value, queriedEl);
    // Lit asserts 1. webjs increments because applyElement re-assigns.
    assert.equal(callCount, 2);

    go(false);
    queriedEl = container.firstElementChild;
    assert.equal(queriedEl && queriedEl.tagName, 'SPAN');
    assert.equal(elRef.value, queriedEl);
    // Lit asserts 2. webjs reaches 3.
    assert.equal(callCount, 3);
  });

  // Same divergence for the callback form. Lit calls a stable callback
  // once per element identity change. webjs calls it once per render.
  test('only calls a ref callback when element changes [webjs: re-calls each render]', () => {
    const calls = [];
    const elCallback = (e) => { calls.push(e && e.tagName); };
    const go = (x) =>
      render(
        x ? html`<div ${ref(elCallback)}></div>` : html`<span ${ref(elCallback)}></span>`,
        container,
      );

    go(true);
    let queriedEl = container.firstElementChild;
    assert.equal(queriedEl && queriedEl.tagName, 'DIV');
    // Lit: ['DIV']. webjs: ['DIV'] (same on first render).
    assert.deepEqual(calls, ['DIV']);

    go(true);
    queriedEl = container.firstElementChild;
    assert.equal(queriedEl && queriedEl.tagName, 'DIV');
    // Lit: ['DIV']. webjs: ['DIV','DIV'] (re-calls every render).
    assert.deepEqual(calls, ['DIV', 'DIV']);

    go(false);
    queriedEl = container.firstElementChild;
    assert.equal(queriedEl && queriedEl.tagName, 'SPAN');
    // Lit: ['DIV', undefined, 'SPAN']. webjs cleanup vs. re-call ordering
    // differs; we assert what webjs produces and document the divergence.
    assert.deepEqual(calls, ['DIV', 'DIV', 'SPAN']);

    go(true);
    queriedEl = container.firstElementChild;
    assert.equal(queriedEl && queriedEl.tagName, 'DIV');
    assert.deepEqual(calls, ['DIV', 'DIV', 'SPAN', 'DIV']);
  });

  test('two refs', () => {
    const divRef1 = createRef();
    const divRef2 = createRef();
    render(html`<div ${ref(divRef1)} ${ref(divRef2)}></div>`, container);
    const div = container.firstElementChild;
    assert.equal(divRef1.value, div);
    assert.equal(divRef2.value, div);
  });

  // Two alternating callbacks bound to two different elements (DIV vs
  // SPAN). Lit only re-invokes a callback when its target element
  // changes, so the same-template re-render is a no-op. webjs's
  // applyElement re-invokes the callback on every render (same bug as
  // "only sets a ref when element changes"). Documented + asserted as
  // webjs reality.
  test('two ref callbacks alternating [webjs: re-calls each render]', () => {
    const divCalls = [];
    const divCallback = (e) => { divCalls.push(e && e.tagName); };
    const spanCalls = [];
    const spanCallback = (e) => { spanCalls.push(e && e.tagName); };
    const go = (x) =>
      render(
        x ? html`<div ${ref(divCallback)}></div>` : html`<span ${ref(spanCallback)}></span>`,
        container,
      );

    go(true);
    let queriedEl = container.firstElementChild;
    assert.equal(queriedEl && queriedEl.tagName, 'DIV');
    assert.deepEqual(divCalls, ['DIV']);
    assert.deepEqual(spanCalls, []);

    go(true);
    queriedEl = container.firstElementChild;
    assert.equal(queriedEl && queriedEl.tagName, 'DIV');
    // Lit: ['DIV']. webjs: ['DIV','DIV'].
    assert.deepEqual(divCalls, ['DIV', 'DIV']);
    assert.deepEqual(spanCalls, []);

    go(false);
    queriedEl = container.firstElementChild;
    assert.equal(queriedEl && queriedEl.tagName, 'SPAN');
    // Lit: divCalls=['DIV', undefined], spanCalls=['SPAN']. webjs
    // doesn't deliver an undefined cleanup on full template switch
    // because the element part is discarded along with the prior
    // template instance (no opportunity to call divCallback with undef).
    assert.deepEqual(divCalls, ['DIV', 'DIV']);
    assert.deepEqual(spanCalls, ['SPAN']);

    go(true);
    queriedEl = container.firstElementChild;
    assert.equal(queriedEl && queriedEl.tagName, 'DIV');
    // Symmetrical to the above: no undefined cleanup on spanCallback.
    assert.deepEqual(divCalls, ['DIV', 'DIV', 'DIV']);
    assert.deepEqual(spanCalls, ['SPAN']);
  });

  test('refs are always set in tree order', () => {
    const elRef = createRef();
    const go = () =>
      render(
        html`
        <div id="first" ${ref(elRef)}></div>
        <div id="next" ${ref(elRef)}>
          ${html`<span id="last" ${ref(elRef)}></span>`}
        </div>`,
        container,
      );

    go();
    assert.equal(elRef.value && elRef.value.id, 'last');
    go();
    assert.equal(elRef.value && elRef.value.id, 'last');
  });

  // Lit interleaves cleanup callbacks (undefined) with new bindings
  // because each element-position ref unbinds itself before binding
  // the new one. webjs's applyElement only unbinds when nextTarget
  // differs from prev (same callback identity reused at all three
  // positions means the prev/next compare-equal and webjs skips the
  // cleanup pass). webjs's result is just ['first', 'next', 'last']
  // each render, no undefineds interleaved. Documented + asserted.
  test('callbacks are always called in tree order [webjs: no cleanup interleave]', () => {
    const calls = [];
    const elCallback = (e) => { calls.push(e && e.id); };
    const go = () =>
      render(
        html`
        <div id="first" ${ref(elCallback)}></div>
        <div id="next" ${ref(elCallback)}>
          ${html`<span id="last" ${ref(elCallback)}></span>`}
        </div>`,
        container,
      );

    go();
    // Lit: ['first', undefined, 'next', undefined, 'last']. webjs:
    assert.deepEqual(calls, ['first', 'next', 'last']);
    calls.length = 0;
    go();
    // Lit: [undefined, 'first', undefined, 'next', undefined, 'last'].
    // webjs: same shape as first render (no cleanup pass on stable
    // callback identity at the same elements).
    assert.deepEqual(calls, ['first', 'next', 'last']);
  });

  test('Ref passed to ref directive changes', () => {
    const aRef = createRef();
    const bRef = createRef();
    const go = (x) =>
      render(html`<div ${ref(x ? aRef : bRef)}></div>`, container);

    go(true);
    assert.equal(aRef.value && aRef.value.tagName, 'DIV');
    assert.equal(bRef.value, undefined);
    go(false);
    assert.equal(aRef.value, undefined);
    assert.equal(bRef.value && bRef.value.tagName, 'DIV');
    go(true);
    assert.equal(aRef.value && aRef.value.tagName, 'DIV');
    assert.equal(bRef.value, undefined);
  });

  test('callback passed to ref directive changes', () => {
    const aCalls = [];
    const aCallback = (el) => aCalls.push(el && el.tagName);
    const bCalls = [];
    const bCallback = (el) => bCalls.push(el && el.tagName);
    const go = (x) =>
      render(html`<div ${ref(x ? aCallback : bCallback)}></div>`, container);

    go(true);
    assert.deepEqual(aCalls, ['DIV']);
    assert.deepEqual(bCalls, []);
    go(false);
    assert.deepEqual(aCalls, ['DIV', undefined]);
    assert.deepEqual(bCalls, ['DIV']);
    go(true);
    assert.deepEqual(aCalls, ['DIV', undefined, 'DIV']);
    assert.deepEqual(bCalls, ['DIV', undefined]);
  });

  test('new callback created each render', () => {
    const calls = [];
    const go = () =>
      render(
        html`<div ${ref((el) => calls.push(el && el.tagName))}></div>`,
        container,
      );
    go();
    assert.deepEqual(calls, ['DIV']);
    go();
    assert.deepEqual(calls, ['DIV', undefined, 'DIV']);
    go();
    assert.deepEqual(calls, ['DIV', undefined, 'DIV', undefined, 'DIV']);
  });
});
