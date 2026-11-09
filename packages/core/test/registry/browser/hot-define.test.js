/**
 * The browser `customElements.define` wrapper's dev hot-swap hook (#1689).
 *
 * The native registry is once per tag, so a second define of a known tag never
 * reaches it. With the dev hot client installed (`globalThis[Symbol.for(
 * 'webjs.hot')]`), the wrapper hands the registered class and the new one to
 * its `replace`, and the registry keeps the class `replace` returns, which is
 * the class the browser actually constructs. Without a hot client the second
 * define behaves as it always has.
 */
import { lookup } from '../../../src/registry.js';

import { assert } from '../../../../../test/browser-assert.js';

const HOT = Symbol.for('webjs.hot');

suite('customElements.define hot replace (#1689)', () => {
  teardown(() => { delete globalThis[HOT]; });

  test('a re-define of a known tag calls the hot replacer and the registry keeps its result', () => {
    class First extends HTMLElement {}
    class Second extends HTMLElement {}
    customElements.define('hot-define-a', First);
    /** @type {unknown[][]} */
    const calls = [];
    globalThis[HOT] = { strings: (s) => s, replace: (tag, prev, next) => { calls.push([tag, prev, next]); return prev; } };
    customElements.define('hot-define-a', Second);
    assert.equal(calls.length, 1, 'replace ran once');
    assert.equal(calls[0][0], 'hot-define-a');
    assert.equal(calls[0][1], First, 'with the registered class');
    assert.equal(calls[0][2], Second, 'and the new one');
    assert.equal(lookup('hot-define-a'), First, 'the registry keeps the class replace returned');
    assert.equal(customElements.get('hot-define-a'), First, 'the native registry is untouched');
  });

  test('a first define never calls the replacer', () => {
    let called = false;
    globalThis[HOT] = { strings: (s) => s, replace: () => { called = true; } };
    class Only extends HTMLElement {}
    customElements.define('hot-define-b', Only);
    assert.equal(called, false);
    assert.equal(lookup('hot-define-b'), Only);
  });

  test('re-defining the SAME class never calls the replacer', () => {
    class Same extends HTMLElement {}
    customElements.define('hot-define-c', Same);
    let called = false;
    globalThis[HOT] = { strings: (s) => s, replace: () => { called = true; } };
    customElements.define('hot-define-c', Same);
    assert.equal(called, false);
  });

  test('with no hot client a re-define behaves as before (counterfactual)', () => {
    class Old extends HTMLElement {}
    class New extends HTMLElement {}
    customElements.define('hot-define-d', Old);
    customElements.define('hot-define-d', New);
    assert.equal(customElements.get('hot-define-d'), Old, 'the browser keeps the first class');
    assert.equal(lookup('hot-define-d'), New, 'and the registry records the last one, as it always has');
  });
});
