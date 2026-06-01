// Unit tests for maskComments (#179): blank comment bodies, keep string AND
// template content verbatim, position-preserving (same length, newlines kept),
// and never mistake a `//` inside a string/template/regex for a comment.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskComments } from '../../src/js-scan.js';

test('blanks line and block comment bodies, keeps the delimiters', () => {
  const out = maskComments(`const a = 1; // secret note\n/* block secret */const b = 2;`);
  assert.ok(!out.includes('secret'), 'comment bodies are blanked');
  assert.ok(out.includes('//') && out.includes('/*') && out.includes('*/'), 'delimiters kept');
  assert.ok(out.includes('const a = 1;') && out.includes('const b = 2;'), 'code kept');
});

test('is position-preserving (same length, newlines kept)', () => {
  const src = `// line comment\nconst x = 'hello';\n/* block\nmultiline */\n`;
  const out = maskComments(src);
  assert.equal(out.length, src.length, 'same length');
  assert.equal(out.split('\n').length, src.split('\n').length, 'same line count');
});

test('keeps string content verbatim (a whenDefined tag rides a string)', () => {
  const out = maskComments(`whenDefined('x-badge'); const s = "<a-tag>";`);
  assert.ok(out.includes("whenDefined('x-badge')"), 'string arg kept');
  assert.ok(out.includes('"<a-tag>"'), 'double-quoted string kept');
});

test('keeps template content verbatim (rendered tags live in templates)', () => {
  const out = maskComments('html`<real-tag>${ x }</real-tag>`');
  assert.ok(out.includes('<real-tag>'), 'template tag kept');
});

test('a // inside a string is not treated as a comment', () => {
  const out = maskComments(`const url = 'https://example.com/path'; const y = 2;`);
  assert.ok(out.includes('https://example.com/path'), 'the // inside the string is kept');
  assert.ok(out.includes('const y = 2;'), 'code after the string is intact');
});

test('a // inside a template is not treated as a comment', () => {
  const out = maskComments('const t = `https://cdn/${x}/a`; const z = 3;');
  assert.ok(out.includes('https://cdn'), 'the // inside the template is kept');
  assert.ok(out.includes('const z = 3;'), 'code after the template is intact');
});

test('a /-slash inside a regex literal is not treated as a comment', () => {
  const out = maskComments(`const re = /a\\/\\/b/; const w = 4; // gone`);
  assert.ok(out.includes('const w = 4;'), 'code after the regex is intact');
  assert.ok(!out.includes('gone'), 'the trailing real comment is still blanked');
});

test('a comment inside a template hole is blanked, surrounding template kept', () => {
  const out = maskComments('html`<a>${ /* secret */ value }</a>`');
  assert.ok(out.includes('<a>') && out.includes('value'), 'template text and hole code kept');
  assert.ok(!out.includes('secret'), 'the comment body inside the hole is blanked');
});
