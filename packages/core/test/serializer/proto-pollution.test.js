/**
 * Security: the wire deserializer must not let an untrusted payload pollute a
 * decoded object's prototype (#491). `JSON.parse` turns a literal `"__proto__"`
 * key into an OWN property, so a naive `out[key] = value` would invoke the
 * prototype setter. `parse`/`deserialize` must instead store such a key as an
 * ordinary own data property and leave the prototype chain untouched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parse, deserialize } from '../../src/serialize.js';

test('a __proto__ key in the wire does not pollute the decoded object', () => {
  const obj = parse('{"__proto__":{"isAdmin":true},"name":"ok"}');
  assert.equal(obj.name, 'ok');
  // The prototype chain is intact (not swapped to the injected object).
  assert.equal(Object.getPrototypeOf(obj), Object.prototype, 'prototype unchanged');
  // The injected field is not reachable as an inherited property.
  assert.equal(obj.isAdmin, undefined, 'injected field is not on the prototype chain');
  // `__proto__` survived as an own DATA property (round-trip fidelity).
  assert.ok(Object.prototype.hasOwnProperty.call(obj, '__proto__'), '__proto__ kept as own data');
  assert.deepEqual(Object.getOwnPropertyDescriptor(obj, '__proto__').value, { isAdmin: true });
});

test('global Object.prototype is never polluted by a decode', () => {
  parse('{"__proto__":{"polluted":true}}');
  assert.equal({}.polluted, undefined, 'Object.prototype stayed clean');
  assert.equal(Object.prototype.polluted, undefined);
});

test('a nested __proto__ key is neutralized too', () => {
  const obj = parse('{"a":{"__proto__":{"x":1}}}');
  assert.equal(Object.getPrototypeOf(obj.a), Object.prototype, 'nested prototype unchanged');
  assert.equal(obj.a.x, undefined, 'nested injection not inherited');
});

test('constructor / prototype keys are stored as own data, not assigned', () => {
  const obj = parse('{"constructor":"x","prototype":"y","ok":1}');
  assert.equal(obj.ok, 1);
  assert.equal(Object.getOwnPropertyDescriptor(obj, 'constructor').value, 'x');
  assert.equal(Object.getOwnPropertyDescriptor(obj, 'prototype').value, 'y');
  // The real constructor is still reachable via the prototype.
  assert.equal(Object.getPrototypeOf(obj).constructor, Object);
});

test('deserialize (the non-JSON path) is hardened too', () => {
  // A raw decoded shape (as if from a hand-built payload object) with an own
  // __proto__ key. Object.defineProperty makes the own key without the setter.
  const wire = Object.defineProperty({ name: 'ok' }, '__proto__', {
    value: { isAdmin: true }, enumerable: true, writable: true, configurable: true,
  });
  const obj = deserialize(wire);
  assert.equal(obj.name, 'ok');
  assert.equal(Object.getPrototypeOf(obj), Object.prototype);
  assert.equal(obj.isAdmin, undefined);
});

test('legitimate data round-trips unaffected', () => {
  const obj = parse('{"user":{"id":1,"roles":["a","b"]},"n":2}');
  assert.deepEqual(obj, { user: { id: 1, roles: ['a', 'b'] }, n: 2 });
  assert.equal(Object.getPrototypeOf(obj), Object.prototype);
});
