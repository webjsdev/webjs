import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactToPlaceholders } from '../../src/js-scan.js';

test('redactToPlaceholders: empty strings and templates', () => {
  const { redacted, literals } = redactToPlaceholders('const a = ""; const b = ``;');
  assert.equal(redacted, 'const a = "__STR_0__"; const b = ``;');
  assert.deepEqual(literals, ['']);
});

test('redactToPlaceholders: single and double quoted strings', () => {
  const { redacted, literals } = redactToPlaceholders('const a = "hello \\"world\\""; const b = \'foo \\\'bar\\\'\';');
  assert.equal(redacted, 'const a = "__STR_0__"; const b = \'__STR_1__\';');
  assert.deepEqual(literals, ['hello \\"world\\"', 'foo \\\'bar\\\'']);
});

test('redactToPlaceholders: template literals without holes', () => {
  const { redacted, literals } = redactToPlaceholders('const a = `hello \\`world\\``;');
  assert.equal(redacted, 'const a = `__STR_0__`;');
  assert.deepEqual(literals, ['hello \\`world\\`']);
});

test('redactToPlaceholders: template literals with dynamic holes', () => {
  const { redacted, literals } = redactToPlaceholders('const a = `hello ${name} world ${1 + 2}`;');
  assert.equal(redacted, 'const a = `__STR_0__${name}__STR_1__${1 + 2}`;');
  assert.deepEqual(literals, ['hello ', ' world ']);
});

test('redactToPlaceholders: nested template holes', () => {
  const { redacted, literals } = redactToPlaceholders('const a = `outer ${`inner ${nested} inner` + "string"} outer`;');
  assert.equal(
    redacted,
    'const a = `__STR_0__${`__STR_1__${nested}__STR_2__` + "__STR_3__"}__STR_4__`;'
  );
  assert.deepEqual(literals, ['outer ', 'inner ', ' inner', 'string', ' outer']);
});

test('redactToPlaceholders: escaped template holes (ignored)', () => {
  const { redacted, literals } = redactToPlaceholders('const a = `hello \\${escaped} world`;');
  assert.equal(redacted, 'const a = `__STR_0__`;');
  assert.deepEqual(literals, ['hello \\${escaped} world']);
});

test('redactToPlaceholders: comment delimiters preserved', () => {
  const { redacted, literals } = redactToPlaceholders('const a = 1; // secret line\n/* secret block */ const b = 2;');
  assert.equal(redacted, 'const a = 1; //            \n/*              */ const b = 2;');
  assert.deepEqual(literals, []);
});

test('redactToPlaceholders: escaping backtick at end of template', () => {
  const { redacted, literals } = redactToPlaceholders('const a = `escape \\\\`;');
  assert.equal(redacted, 'const a = `__STR_0__`;');
  assert.deepEqual(literals, ['escape \\\\']);
});
