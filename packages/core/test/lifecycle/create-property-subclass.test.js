/**
 * `createProperty` on a parent reaches a subclass whose declarations were
 * already read (review of PR #1687). The per-class memo of
 * `declaredProperties` holds the superclass's declarations merged in, so
 * clearing only the parent's entry left the subclass with a map missing the
 * new property, and its attribute handling and reflection disagreed with the
 * parent's.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebComponent } from '../../index.js';
import { declaredProperties, resolveAttributeProperty } from '../../src/attribute-reader.js';

test("a parent's createProperty reaches a subclass already read", () => {
  class Parent extends WebComponent {
    static properties = { a: { type: String } };
  }
  class Child extends Parent {}
  // Read first, so the subclass's merged map and attribute list are memoized.
  assert.deepEqual(Object.keys(declaredProperties(Child)), ['a']);
  assert.equal(resolveAttributeProperty(Child, 'late'), undefined);
  Parent.createProperty('late', { type: Number });
  assert.ok('late' in declaredProperties(Parent), 'the parent has it');
  assert.ok('late' in declaredProperties(Child), 'and so does the subclass read before it existed');
  assert.equal(resolveAttributeProperty(Child, 'late')?.propName, 'late', 'and its attribute maps to it');
});
