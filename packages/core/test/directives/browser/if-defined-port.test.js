/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Ported from lit-html's `packages/lit-html/src/test/directives/if-defined_test.ts`
 * (#1686, Lit conformance): imports swapped to WebJs, otherwise case for case.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { ifDefined } from '../../../src/directives.js';
import { assert } from '../../../../../test/browser-assert.js';

const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+data-[\w-]+="[^"]*"/g, '');
const tick = () => new Promise((r) => setTimeout(r, 0));

suite('ifDefined directive (lit port)', () => {
  let container;
  setup(() => { container = document.createElement('div'); });

  test('sets an attribute with a defined value', () => {
    render(html`<div foo="${ifDefined('a')}"></div>`, container);
    assert.equal(strip(container.innerHTML), '<div foo="a"></div>');
  });

  test('removes an attribute with an undefined value', () => {
    render(html`<div foo="${ifDefined(undefined)}"></div>`, container);
    assert.equal(strip(container.innerHTML), '<div></div>');
  });

  test('sets an attribute with a previously undefined value', () => {
    render(html`<div foo="${ifDefined(undefined)}"></div>`, container);
    render(html`<div foo="${ifDefined('a')}"></div>`, container);
    assert.equal(strip(container.innerHTML), '<div foo="a"></div>');
  });

  test('removes an attribute with previously defined value', () => {
    render(html`<div foo="${ifDefined('a')}"></div>`, container);
    render(html`<div foo="${ifDefined(undefined)}"></div>`, container);
    assert.equal(strip(container.innerHTML), '<div></div>');
  });

  test('removes an attribute with previous value set outside ifDefined', () => {
    const go = (v) => render(html`<div foo="${v}"></div>`, container);
    go('a');
    go(ifDefined(undefined));
    assert.equal(strip(container.innerHTML), '<div></div>');
  });

  test('passes a defined value to a ChildPart', () => {
    render(html`<div>${ifDefined('a')}</div>`, container);
    assert.equal(strip(container.innerHTML), '<div>a</div>');
  });

  test('passes an undefined value to a ChildPart', () => {
    render(html`<div>${ifDefined(undefined)}</div>`, container);
    assert.equal(strip(container.innerHTML), '<div></div>');
  });

  test('removes an attribute with an interpolated undefined value', () => {
    render(html`<div foo="it's: ${ifDefined(undefined)}"></div>`, container);
    assert.equal(strip(container.innerHTML), '<div></div>');
  });

  test('removes an attribute with multiple undefined values', () => {
    render(html`<div
        foo="they're both: ${ifDefined(undefined)}${ifDefined(undefined)}"
      ></div>`, container);
    assert.equal(strip(container.innerHTML), '<div></div>');
  });

  test('removes an attribute with one defined then one undefined value', () => {
    render(html`<div
        foo="only one is: ${ifDefined('a')}${ifDefined(undefined)}"
      ></div>`, container);
    assert.equal(strip(container.innerHTML), '<div></div>');
  });

  test('removes an attribute with one undefined then one defined value', () => {
    render(html`<div
        foo="only one is: ${ifDefined(undefined)}${ifDefined('a')}"
      ></div>`, container);
    assert.equal(strip(container.innerHTML), '<div></div>');
  });

  test('only sets the attribute when the value changed', async () => {
    let setCount = 0;
    const observer = new MutationObserver((records) => { setCount += records.length; });
    const go = (value) => render(html`<div foo="1${ifDefined(value)}"></div>`, container);
    go('a');
    const el = container.firstElementChild;
    observer.observe(el, { attributes: true });
    assert.equal(strip(container.innerHTML), '<div foo="1a"></div>');
    go('a');
    await tick();
    assert.equal(strip(container.innerHTML), '<div foo="1a"></div>');
    assert.equal(setCount, 0);
  });

  test('only removes the attribute when the value changed', () => {
    let removeCount = 0;
    const go = (value) => render(html`<div foo="1${ifDefined(value)}"></div>`, container);
    go('a');
    const el = container.firstElementChild;
    const orig = el.removeAttribute.bind(el);
    el.removeAttribute = (name) => { removeCount++; orig(name); };
    go(undefined);
    assert.equal(strip(container.innerHTML), '<div></div>');
    assert.equal(removeCount, 1, 'A');
    go(undefined);
    assert.equal(strip(container.innerHTML), '<div></div>');
    assert.equal(removeCount, 1, 'B');
  });

  test('only sets node text value changed', async () => {
    let setCount = 0;
    const observer = new MutationObserver((records) => { setCount += records.length; });
    const go = (value) => render(html`<div>${ifDefined(value)}</div>`, container);
    go('a');
    const el = container.firstElementChild;
    observer.observe(el, { characterData: true, subtree: true });
    go('a');
    await tick();
    assert.equal(strip(container.innerHTML), '<div>a</div>');
    assert.equal(setCount, 0);
  });
});
