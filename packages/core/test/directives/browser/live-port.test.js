/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Ported from lit-html's `packages/lit-html/src/test/directives/live_test.ts`
 * (#1686, Lit conformance): imports swapped to WebJs, otherwise case for case,
 * including the stray `}` text Lit's templates carry.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { live } from '../../../src/directives.js';
import { nothing, noChange } from '../../../src/sentinels.js';
import { assert } from '../../../../../test/browser-assert.js';

class LiveTester extends HTMLElement {
  _x = undefined;
  _setCount = 0;
  get x() { return this._x; }
  set x(v) { this._x = v; this._setCount++; }
}
if (!customElements.get('live-tester-port')) customElements.define('live-tester-port', LiveTester);

const tick = () => new Promise((r) => setTimeout(r, 0));

suite('live directive (lit port)', () => {
  let container;
  setup(() => { container = document.createElement('div'); });

  suite('properties', () => {
    test('live() is useful: property bindings ignore external changes', () => {
      const go = (x) => render(html`<input .value="${x}" />}`, container);
      go('a');
      const el = container.firstElementChild;
      el.value = 'b';
      go('a');
      assert.equal(el.value, 'b');
    });

    test('updates an externally set property', () => {
      const go = (x) => render(html`<input .value="${live(x)}" />}`, container);
      go('a');
      const el = container.firstElementChild;
      el.value = 'b';
      go('a');
      assert.equal(el.value, 'a');
    });

    test('does not set a non-changed property', () => {
      const go = (x) => render(html`<live-tester-port .x="${live(x)}"></live-tester-port>}`, container);
      go('a');
      const el = container.firstElementChild;
      assert.equal(el.x, 'a');
      assert.equal(el._setCount, 1);
      go('a');
      assert.equal(el.x, 'a');
      assert.equal(el._setCount, 1);
    });

    test('noChange works', () => {
      const go = (x) => render(html`<input .value="${live(x)}" />}`, container);
      go('a');
      const el = container.firstElementChild;
      el.value = 'b';
      go(noChange);
      assert.equal(el.value, 'b');
    });
  });

  suite('attributes', () => {
    test('updates an externally set attribute', () => {
      const go = (x) => render(html`<div class="${live(x)}">}</div>`, container);
      go('a');
      const el = container.firstElementChild;
      el.className = 'b';
      go('a');
      assert.equal(el.getAttribute('class'), 'a');
    });

    test('does not set a non-changed attribute', async () => {
      let mutationCount = 0;
      const observer = new MutationObserver((records) => { mutationCount += records.length; });
      const go = (x) => render(html`<div x="${live(x)}"></div>
            }`, container);
      go('a');
      const el = container.firstElementChild;
      assert.equal(el.getAttribute('x'), 'a');
      observer.observe(el, { attributes: true });
      go('b');
      await tick();
      assert.equal(el.getAttribute('x'), 'b');
      assert.equal(mutationCount, 1);
      go('b');
      await tick();
      assert.equal(el.getAttribute('x'), 'b');
      assert.equal(mutationCount, 1);
    });
  });

  test('removes an attribute with nothing', () => {
    const go = (x) => render(html`<div class="${live(x)}">}</div>`, container);
    go('a');
    const el = container.firstElementChild;
    el.className = 'b';
    go(nothing);
    assert.isFalse(el.hasAttribute('class'));
  });

  test('noChange works', () => {
    const go = (x) => render(html`<div class="${live(x)}">}</div>`, container);
    go('a');
    const el = container.firstElementChild;
    el.className = 'b';
    go(noChange);
    assert.equal(el.getAttribute('class'), 'b');
  });

  test('does not set a non-changed attribute with a non-string value', async () => {
    let mutationCount = 0;
    const observer = new MutationObserver((records) => { mutationCount += records.length; });
    const go = (x) => render(html`<div x="${live(x)}"></div>
          }`, container);
    go(1);
    const el = container.firstElementChild;
    assert.equal(el.getAttribute('x'), '1');
    observer.observe(el, { attributes: true });
    go(2);
    await tick();
    assert.equal(el.getAttribute('x'), '2');
    assert.equal(mutationCount, 1);
    go(2);
    await tick();
    assert.equal(el.getAttribute('x'), '2');
    assert.equal(mutationCount, 1);
  });

  suite('boolean attributes', () => {
    test('updates an externally set boolean attribute', () => {
      const go = (x) => render(html`<div ?hidden="${live(x)}"></div>
            }`, container);
      go(true);
      const el = container.firstElementChild;
      assert.equal(el.getAttribute('hidden'), '');
      go(true);
      assert.equal(el.getAttribute('hidden'), '');
      el.removeAttribute('hidden');
      assert.equal(el.getAttribute('hidden'), null);
      go(true);
      assert.equal(el.getAttribute('hidden'), '');
    });

    test('does not set a non-changed boolean attribute', async () => {
      let mutationCount = 0;
      const observer = new MutationObserver((records) => { mutationCount += records.length; });
      const go = (x) => render(html`<div ?hidden="${live(x)}"></div>
            }`, container);
      go(true);
      const el = container.firstElementChild;
      assert.equal(el.getAttribute('hidden'), '');
      observer.observe(el, { attributes: true });
      go(false);
      await tick();
      assert.equal(el.getAttribute('hidden'), null);
      assert.equal(mutationCount, 1);
      go(false);
      await tick();
      assert.equal(el.getAttribute('hidden'), null);
      assert.equal(mutationCount, 1);
    });
  });
});
