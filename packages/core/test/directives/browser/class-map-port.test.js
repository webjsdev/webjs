/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Ported from lit-html's `packages/lit-html/src/test/directives/class-map_test.ts`
 * (#1686, Lit conformance): imports swapped to WebJs, otherwise case for case.
 */
import { html, svg } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { classMap } from '../../../src/directives.js';
import { assert } from '../../../../../test/browser-assert.js';

suite('classMap directive (lit port)', () => {
  let container;
  const renderClassMap = (info) => render(html`<div class="${classMap(info)}"></div>`, container);
  const renderClassMapStatic = (info) => render(html`<div class="aa ${classMap(info)} bb"></div>`, container);

  setup(() => {
    container = document.createElement('div');
  });

  test('adds classes', () => {
    renderClassMap({ foo: 0, bar: true, zonk: true });
    const el = container.firstElementChild;
    assert.isFalse(el.classList.contains('foo'));
    assert.isTrue(el.classList.contains('bar'));
    assert.isTrue(el.classList.contains('zonk'));
  });

  test('removes classes', () => {
    renderClassMap({ foo: true, bar: true, baz: true });
    const el = container.firstElementChild;
    renderClassMap({ foo: false, bar: true, baz: false });
    assert.isFalse(el.classList.contains('foo'));
    assert.isTrue(el.classList.contains('bar'));
    assert.isFalse(el.classList.contains('baz'));
  });

  test('removes omitted classes', () => {
    renderClassMap({ foo: true, bar: true, baz: true });
    const el = container.firstElementChild;
    renderClassMap({});
    assert.isFalse(el.classList.contains('foo'));
    assert.isFalse(el.classList.contains('bar'));
    assert.isFalse(el.classList.contains('baz'));
    assert.equal(el.classList.length, 0);
  });

  test('works with static classes', () => {
    renderClassMapStatic({ foo: true });
    const el = container.firstElementChild;
    assert.isTrue(el.classList.contains('aa'), 'aa 1');
    assert.isTrue(el.classList.contains('bb'), 'bb 1');
    assert.isTrue(el.classList.contains('foo'), 'foo 1');
    renderClassMapStatic({});
    assert.isTrue(el.classList.contains('aa'), 'aa');
    assert.isTrue(el.classList.contains('bb'), 'bb');
    assert.isFalse(el.classList.contains('foo'), 'foo');
  });

  test('works with imperatively added classes', () => {
    renderClassMap({ foo: true });
    const el = container.firstElementChild;
    el.classList.add('bar');
    renderClassMap({ foo: false });
    assert.isFalse(el.classList.contains('foo'));
    assert.isTrue(el.classList.contains('bar'));
  });

  test('can not override static classes', () => {
    renderClassMapStatic({ aa: false, bb: true });
    const el = container.firstElementChild;
    assert.isTrue(el.classList.contains('aa'));
    assert.isTrue(el.classList.contains('bb'));
    renderClassMapStatic({ aa: true, bb: false });
    assert.isTrue(el.classList.contains('aa'));
    assert.isTrue(el.classList.contains('bb'));
    renderClassMapStatic({});
    assert.isTrue(el.classList.contains('aa'));
    assert.isTrue(el.classList.contains('bb'));
  });

  test('changes classes when used with the same object', () => {
    const info = { foo: true };
    renderClassMapStatic(info);
    const el = container.firstElementChild;
    assert.isTrue(el.classList.contains('foo'));
    info.foo = false;
    renderClassMapStatic(info);
    assert.isTrue(el.classList.contains('aa'));
    assert.isTrue(el.classList.contains('bb'));
    assert.isFalse(el.classList.contains('foo'));
  });

  test('adds classes on SVG elements', () => {
    render(svg`<circle class="${classMap({ foo: 0, bar: true, zonk: true })}"></circle>`, container);
    const classes = container.firstElementChild.getAttribute('class').split(' ');
    assert.isTrue(classes.indexOf('foo') === -1);
    assert.isTrue(classes.indexOf('bar') > -1);
    assert.isTrue(classes.indexOf('zonk') > -1);
  });

  test('works if there are no spaces next to directive', () => {
    render(html`<div class="aa${classMap({ bb: true })}cc"></div>`, container);
    const el = container.firstElementChild;
    assert.isTrue(el.classList.contains('aa'));
    assert.isTrue(el.classList.contains('bb'));
    assert.isTrue(el.classList.contains('cc'));
  });

  test('throws when used on non-class attribute', async () => {
    await assert.throws(() => render(html`<div id="${classMap({})}"></div>`, container));
  });

  test('throws when used in attribute with more than 1 part', async () => {
    await assert.throws(() => render(html`<div class="${'hi'} ${classMap({})}"></div>`, container));
  });

  test('throws when used in ChildPart', async () => {
    await assert.throws(() => render(html`<div>${classMap({})}</div>`, container));
  });
});
