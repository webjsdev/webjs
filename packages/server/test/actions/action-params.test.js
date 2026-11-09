// declaredParamCount (#1686): the parameter count a form submission uses to
// tell a (prevState, formData) action apart, robust to defaults where
// fn.length is not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { declaredParamCount } from '../../src/action-params.js';

test('counts plain parameters like fn.length', () => {
  assert.equal(declaredParamCount(async function a(formData) {}), 1);
  assert.equal(declaredParamCount(async function a(prev, formData) {}), 2);
  assert.equal(declaredParamCount(async () => {}), 0);
});

test('a default does not stop the count (fn.length would say 0)', () => {
  const save = async function (prevState = { n: 0 }, formData) {};
  assert.equal(save.length, 0);
  assert.equal(declaredParamCount(save), 2);
  assert.equal(declaredParamCount(async (prev = {}, fd = new FormData()) => {}), 2);
});

test('nested brackets, strings and templates in defaults are one parameter', () => {
  const f = async function (prev = { a: [1, 2], b: 'x,y', c: `t${'a,b'}` }, fd) {};
  assert.equal(declaredParamCount(f), 2);
});

test('destructured parameters count once each', () => {
  assert.equal(declaredParamCount(async ({ a, b }, [c, d]) => {}), 2);
});

test('a rest parameter is not counted', () => {
  assert.equal(declaredParamCount(async (prev, ...rest) => {}), 1);
  assert.equal(declaredParamCount(async (...args) => {}), 0);
});

test('a bare arrow parameter is one', () => {
  assert.equal(declaredParamCount(async (fd) => fd), 1);
  // eslint-disable-next-line
  assert.equal(declaredParamCount(eval('async fd => fd')), 1);
});

test('comments inside the list are ignored, a trailing comma adds nothing', () => {
  assert.equal(declaredParamCount(async function (/* state, */ prev, fd,) {}), 2);
});

test('a bound or native function falls back to fn.length', () => {
  const bound = (async function (a, b) {}).bind(null);
  assert.equal(declaredParamCount(bound), 2);
  assert.equal(declaredParamCount(Math.max), Math.max.length);
});
