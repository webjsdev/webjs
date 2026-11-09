/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Ported from lit-html's `packages/lit-html/src/test/directives/style-map_test.ts`
 * (#1686, Lit conformance): imports swapped to WebJs, otherwise case for case.
 * Not ported: "render() only properties", which subclasses Lit's private
 * `_$litDirective$` class, an internal rather than an API an app uses.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { styleMap } from '../../../src/directives.js';
import { assert } from '../../../../../test/browser-assert.js';

suite('styleMap (lit port)', () => {
  let container;
  const renderStyleMap = (info) => render(html`<div style="${styleMap(info)}"></div>`, container);
  const renderStyleMapStatic = (info) =>
    render(html`<div style="height: 1px; ${styleMap(info)} color: red"></div>`, container);

  setup(() => {
    container = document.createElement('div');
  });

  test('first render skips undefined properties', () => {
    renderStyleMap({ marginTop: undefined, marginBottom: null });
    const el = container.firstElementChild;
    assert.equal(el.style.cssText, '');
    assert.equal(el.style.marginTop, '');
    assert.equal(el.style.marginBottom, '');
  });

  test('adds and updates properties', () => {
    renderStyleMap({ marginTop: '2px', 'padding-bottom': '4px', opacity: '0.5', 'z-index': 10 });
    const el = container.firstElementChild;
    assert.equal(el.style.marginTop, '2px');
    assert.equal(el.style.paddingBottom, '4px');
    assert.equal(el.style.opacity, '0.5');
    assert.equal(el.style.zIndex, '10');
    renderStyleMap({ marginTop: '4px', paddingBottom: '8px', opacity: '0.55', 'z-index': 1 });
    assert.equal(el.style.marginTop, '4px');
    assert.equal(el.style.paddingBottom, '8px');
    assert.equal(el.style.opacity, '0.55');
    assert.equal(el.style.zIndex, '1');
  });

  test('removes properties', () => {
    renderStyleMap({ marginTop: '2px', 'padding-bottom': '4px', borderRadius: '5px', borderColor: 'blue' });
    const el = container.firstElementChild;
    assert.equal(el.style.borderRadius, '5px');
    renderStyleMap({ borderRadius: undefined, borderColor: null });
    assert.equal(el.style.marginTop, '');
    assert.equal(el.style.paddingBottom, '');
    assert.equal(el.style.borderRadius, '');
    assert.equal(el.style.borderColor, '');
  });

  test('works with static properties', () => {
    renderStyleMapStatic({ marginTop: '2px', 'padding-bottom': '4px' });
    const el = container.firstElementChild;
    assert.equal(el.style.height, '1px');
    assert.equal(el.style.color, 'red');
    assert.equal(el.style.marginTop, '2px');
    assert.equal(el.style.paddingBottom, '4px');
    renderStyleMapStatic({});
    assert.equal(el.style.height, '1px');
    assert.equal(el.style.color, 'red');
    assert.equal(el.style.marginTop, '');
    assert.equal(el.style.paddingBottom, '');
  });

  test('adds and removes CSS variables', () => {
    renderStyleMap({ '--size': '2px' });
    const el = container.firstElementChild;
    assert.equal(el.style.getPropertyValue('--size'), '2px');
    renderStyleMap({ '--size': '4px' });
    assert.equal(el.style.getPropertyValue('--size'), '4px');
    renderStyleMap({});
    assert.equal(el.style.getPropertyValue('--size'), '');
  });

  test('adds priority in updated properties', () => {
    renderStyleMap({ color: 'blue !important' });
    const el = container.firstElementChild;
    assert.equal(el.style.getPropertyValue('color'), 'blue');
    assert.equal(el.style.getPropertyPriority('color'), 'important');
    renderStyleMap({ color: 'green !important' });
    assert.equal(el.style.getPropertyValue('color'), 'green');
    assert.equal(el.style.getPropertyPriority('color'), 'important');
    renderStyleMap({ color: 'red' });
    assert.equal(el.style.getPropertyValue('color'), 'red');
    assert.equal(el.style.getPropertyPriority('color'), '');
    renderStyleMap({});
    assert.equal(el.style.getPropertyValue('color'), '');
  });

  test('works when used with the same object', () => {
    const info = { marginTop: '2px', 'padding-bottom': '4px' };
    renderStyleMap(info);
    const el = container.firstElementChild;
    info.marginTop = '6px';
    info['padding-bottom'] = '8px';
    renderStyleMap(info);
    assert.equal(el.style.marginTop, '6px');
    assert.equal(el.style.paddingBottom, '8px');
  });

  test('works when same object adds and removes properties', () => {
    const info = { marginTop: '2px', 'padding-bottom': '4px' };
    renderStyleMap(info);
    const el = container.firstElementChild;
    assert.equal(el.style.color, '');
    delete info.marginTop;
    info.color = 'green';
    renderStyleMap(info);
    assert.equal(el.style.marginTop, '');
    assert.equal(el.style.color, 'green');
  });

  test('throws when used on non-style attribute', async () => {
    await assert.throws(() => render(html`<div id="${styleMap({})}"></div>`, container));
  });

  test('throws when used in attribute with more than 1 part', async () => {
    await assert.throws(() => render(html`<div style="${'height: 2px;'} ${styleMap({})}"></div>`, container));
  });

  test('throws when used in ChildPart', async () => {
    await assert.throws(() => render(html`<div>${styleMap({})}</div>`, container));
  });
});
