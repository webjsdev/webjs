/**
 * `createProperty` on a parent and its subclasses (reviews of PR #1687). The
 * per-class memos (`declaredProperties`, its attribute list, and
 * `elementProperties`) hold the superclass's declarations merged in, so a
 * parent's `createProperty` has to reach a subclass read earlier. A subclass
 * that already has an instance has its accessors installed and can never gain
 * the new property, so the call is refused there, as it is on a class with an
 * instance of its own.
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
  // Read first, so every memo of the subclass is filled.
  assert.deepEqual(Object.keys(declaredProperties(Child)), ['a']);
  assert.equal(resolveAttributeProperty(Child, 'late'), undefined);
  assert.equal(Child.elementProperties.has('late'), false);
  Parent.createProperty('late', { type: Number });
  assert.ok('late' in declaredProperties(Parent), 'the parent has it');
  assert.ok('late' in declaredProperties(Child), 'and so does the subclass read before it existed');
  assert.equal(resolveAttributeProperty(Child, 'late')?.propName, 'late', 'its attribute maps to it');
  assert.equal(Child.elementProperties.get('late')?.type, Number, 'and its elementProperties has it');
  // Constructed after, the subclass is reactive on it.
  const el = new Child();
  const own = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'late')
    || Object.getOwnPropertyDescriptor(Parent.prototype, 'late');
  assert.ok(own && own.set, 'an instance gets a reactive accessor for it');
});

test('createProperty on a class whose subclass has an instance is refused, as on the class itself', () => {
  class Parent extends WebComponent {}
  class Child extends Parent {}
  new Child();
  assert.throws(() => Parent.createProperty('late', { type: String }), /createProperty\('late'\) ran after an instance of the class, or of a subclass, was constructed/);
  assert.ok(!('late' in declaredProperties(Child)), 'nothing was half-added');
  class Own extends WebComponent {}
  new Own();
  assert.throws(() => Own.createProperty('x'), /ran after an instance of the class was constructed/, 'the existing rule still holds');
});

test("createProperty rebuilds only its own class chain's memos; other classes keep theirs", () => {
  // A single global counter used to invalidate every class's memos on each
  // createProperty, including the ones finalize() makes per own property when
  // a class overrides createProperty.
  class Other extends WebComponent {
    static properties = { o: { type: String } };
  }
  class Parent extends WebComponent {
    static properties = { a: { type: String } };
  }
  class Child extends Parent {}
  const otherMap = declaredProperties(Other);
  const otherElementProperties = Other.elementProperties;
  const childMap = declaredProperties(Child);
  Parent.createProperty('late', { type: Number });
  assert.equal(declaredProperties(Other), otherMap, 'an unrelated class keeps the very same map');
  assert.equal(Other.elementProperties, otherElementProperties, 'and the same elementProperties');
  assert.notEqual(declaredProperties(Child), childMap, 'the changed chain gets a new map');
  assert.ok('late' in declaredProperties(Child));
});

test('a class that overrides createProperty finalizes before a subclass instance marks it', () => {
  // Lit's finalize() creates each own `static properties` entry through
  // createProperty; WebJs does too when a class overrides it. The parent is
  // finalized first, so constructing a subclass instance never trips the
  // "subclass already has an instance" refusal.
  const created = [];
  class Parent extends WebComponent {
    static properties = { a: { type: String } };
    static createProperty(name, options) { created.push(name); super.createProperty(name, options); }
  }
  class Child extends Parent {
    static properties = { b: { type: Number } };
  }
  assert.doesNotThrow(() => new Child());
  assert.ok(created.includes('a'), "the parent's own property went through its createProperty");
  assert.deepEqual(Object.keys(declaredProperties(Child)).sort(), ['a', 'b']);
});
