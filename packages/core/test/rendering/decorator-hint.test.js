/**
 * `decoratorHint` turns the two runtime shapes of a Lit decorator reaching
 * WebJs (Node's bare SyntaxError, Bun's ReferenceError for the decorator
 * function) into the WebJs fix, and stays silent for anything else.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decoratorHint } from '../../src/render-server/errors.js';

test('a SyntaxError for an unexpected token names the decorator fix', () => {
  const hint = decoratorHint(new SyntaxError('Invalid or unexpected token'));
  assert.match(hint, /decorator/);
  assert.match(hint, /static properties/);
  assert.match(hint, /register/);
});

test("Bun's ReferenceError for a decorator function names the decorator", () => {
  const hint = decoratorHint(new ReferenceError('property is not defined'));
  assert.match(hint, /`property` is a Lit decorator/);
});

test('unrelated errors get no decorator hint', () => {
  assert.equal(decoratorHint(new ReferenceError('document is not defined')), null);
  assert.equal(decoratorHint(new SyntaxError('Unexpected end of JSON input')), null);
  assert.equal(decoratorHint(new Error('Invalid or unexpected token')), null);
  assert.equal(decoratorHint({}), null);
  assert.equal(decoratorHint(null), null);
});
