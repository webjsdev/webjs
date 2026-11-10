/**
 * `defaultConverter` and `notEqual`, as Lit exports them (#1686). The cases
 * mirror Lit's own `reactive-element` converter semantics, so a component that
 * delegates to the default converter behaves as it does under Lit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { defaultConverter, notEqual } from '../../index.js';
import * as browser from '../../index-browser.js';

test('both entries export them', () => {
  assert.equal(browser.defaultConverter, defaultConverter);
  assert.equal(browser.notEqual, notEqual);
});

test('defaultConverter.fromAttribute: Lit\'s per-type parse', () => {
  assert.equal(defaultConverter.fromAttribute('', Boolean), true, 'a present attribute is on');
  assert.equal(defaultConverter.fromAttribute(null, Boolean), false);
  assert.equal(defaultConverter.fromAttribute('42', Number), 42);
  assert.equal(defaultConverter.fromAttribute(null, Number), null);
  assert.deepEqual(defaultConverter.fromAttribute('{"a":1}', Object), { a: 1 });
  assert.deepEqual(defaultConverter.fromAttribute('[1,2]', Array), [1, 2]);
  assert.equal(defaultConverter.fromAttribute('{bad', Object), null, 'unparseable JSON reads null');
  assert.equal(defaultConverter.fromAttribute('hi', String), 'hi');
  assert.equal(defaultConverter.fromAttribute('hi'), 'hi', 'no type is a string');
});

test('defaultConverter.toAttribute: Lit\'s per-type serialize', () => {
  assert.equal(defaultConverter.toAttribute(true, Boolean), '');
  assert.equal(defaultConverter.toAttribute(false, Boolean), null, 'off removes the attribute');
  assert.equal(defaultConverter.toAttribute({ a: 1 }, Object), '{"a":1}');
  assert.equal(defaultConverter.toAttribute(null, Array), null);
  assert.equal(defaultConverter.toAttribute(7, Number), 7);
});

test('notEqual is Object.is negated', () => {
  assert.equal(notEqual(1, 1), false);
  assert.equal(notEqual(NaN, NaN), false);
  assert.equal(notEqual(0, -0), true);
  assert.equal(notEqual({}, {}), true);
});
