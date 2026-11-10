/**
 * @license
 * Copyright The Lit Project Contributors.
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 *
 * Ported from lit-html's `when_test.ts`, `choose_test.ts`, `map_test.ts`,
 * `join_test.ts` and `range_test.ts` under
 * `packages/lit-html/src/test/directives/` (#1686, Lit conformance): imports
 * swapped to WebJs, otherwise case for case. Lit's `makeAssertRender` renders
 * a value into a container and compares the markup with comment markers
 * stripped, which `assertRender` below does too. Not ported: choose's
 * type-only case (skipped in Lit itself).
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { when, choose, map, join, range } from '../../../src/directives.js';
import { assert } from '../../../../../test/browser-assert.js';

let container;
const assertRender = (value, expected) => {
  render(value, container);
  assert.equal(container.innerHTML.replace(/<!--[\s\S]*?-->/g, ''), expected);
};

suite('when (lit port)', () => {
  setup(() => { container = document.createElement('div'); });

  test('true condition with false case', () => {
    assertRender(when(true, () => html`X`, () => html`Y`), 'X');
  });
  test('true condition without false case', () => {
    assertRender(when(true, () => html`X`), 'X');
  });
  test('false condition with false case', () => {
    assertRender(when(false, () => html`X`, () => html`Y`), 'Y');
  });
  test('false condition without false case', () => {
    assertRender(when(false, () => html`X`), '');
  });
});

suite('choose (lit port)', () => {
  test('no cases', () => {
    assert.strictEqual(choose(1, []), undefined);
  });
  test('matching cases', () => {
    assert.strictEqual(choose(1, [[1, () => 'A']]), 'A');
    assert.strictEqual(choose(2, [[1, () => 'A'], [2, () => 'B']]), 'B');
    const a = {};
    const b = {};
    assert.strictEqual(choose(b, [[a, () => 'A'], [b, () => 'B']]), 'B');
  });
  test('default case', () => {
    assert.strictEqual(choose(3, [[1, () => 'A'], [2, () => 'B']], () => 'C'), 'C');
  });
});

function* iterate(items) {
  for (const i of items) yield i;
}

suite('map (lit port)', () => {
  setup(() => { container = document.createElement('div'); });

  test('with array', () => {
    assertRender(map(['a', 'b', 'c'], (v) => html`<p>${v}</p>`), '<p>a</p><p>b</p><p>c</p>');
  });
  test('with empty array', () => {
    assertRender(map([], (v) => html`<p>${v}</p>`), '');
  });
  test('with undefined', () => {
    assertRender(map(undefined, (v) => html`<p>${v}</p>`), '');
  });
  test('with iterable', () => {
    assertRender(map(iterate(['a', 'b', 'c']), (v) => html`<p>${v}</p>`), '<p>a</p><p>b</p><p>c</p>');
  });
  test('passes index', () => {
    assertRender(map(['a', 'b', 'c'], (v, i) => html`<p>${v}:${i}</p>`), '<p>a:0</p><p>b:1</p><p>c:2</p>');
  });
});

suite('join (lit port)', () => {
  setup(() => { container = document.createElement('div'); });

  test('with array', () => { assertRender(join(['a', 'b', 'c'], ','), 'a,b,c'); });
  test('with empty array', () => { assertRender(join([], ','), ''); });
  test('with undefined', () => { assertRender(join(undefined, ','), ''); });
  test('with iterable', () => { assertRender(join(iterate(['a', 'b', 'c']), ','), 'a,b,c'); });
  test('passes index', () => {
    assertRender(join(['a', 'b', 'c'], (i) => html`<p>${i}</p>`), 'a<p>0</p>b<p>1</p>c');
  });
});

suite('range (lit port)', () => {
  test('positive end', () => {
    assert.deepEqual([...range(0)], []);
    assert.deepEqual([...range(3)], [0, 1, 2]);
  });
  test('start and end', () => {
    assert.deepEqual([...range(0, 3)], [0, 1, 2]);
    assert.deepEqual([...range(-1, 1)], [-1, 0]);
    assert.deepEqual([...range(-2, -1)], [-2]);
  });
  test('end < start', () => {
    assert.deepEqual([...range(2, 1)], []);
  });
  test('custom step', () => {
    assert.deepEqual([...range(0, 10, 3)], [0, 3, 6, 9]);
  });
  test('negative step', () => {
    assert.deepEqual([...range(0, -3, -1)], [0, -1, -2]);
    assert.deepEqual([...range(0, 10, -1)], []);
  });
});
