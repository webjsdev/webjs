/**
 * Regression for #222: the browser `/directives` subpath collapsed onto the
 * dist browser bundle, which only re-exported unsafeHTML / live, so a built
 * app importing `ref` / `createRef` / `keyed` / `guard` / `cache` / `until` /
 * etc. from `@webjsdev/core/directives` got "does not provide an export". The
 * fix re-exports the full directive surface from both index entries so the
 * bundle (and the bare specifier) carry every directive.
 *
 * This guards the surface: every export of src/directives.js MUST be
 * re-exported by index.js (Node bare) and index-browser.js (the dist-bundle
 * source). If a new directive is added to directives.js without being added to
 * both index files, this fails before the bundle can ship a missing export.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as directives from '../../src/directives.js';
import * as indexNode from '../../index.js';
import * as indexBrowser from '../../index-browser.js';

const directiveExports = Object.keys(directives).filter((k) => typeof directives[k] === 'function');

test('every src/directives.js export is re-exported by index.js (the bare Node specifier)', () => {
  const missing = directiveExports.filter((k) => !(k in indexNode));
  assert.deepEqual(missing, [], `index.js is missing directive exports: ${missing.join(', ')}`);
});

test('every src/directives.js export is re-exported by index-browser.js (the dist bundle source)', () => {
  const missing = directiveExports.filter((k) => !(k in indexBrowser));
  assert.deepEqual(missing, [], `index-browser.js is missing directive exports: ${missing.join(', ')}`);
});

test('the documented lit-parity directives are all present', () => {
  // The AGENTS.md directive table promises these by name.
  for (const name of ['repeat', 'unsafeHTML', 'live', 'keyed', 'guard', 'templateContent', 'ref', 'createRef', 'cache', 'until', 'asyncAppend', 'asyncReplace', 'watch']) {
    assert.equal(typeof indexBrowser[name], 'function', `${name} must be on the browser surface`);
  }
});

test('src/directives.js exposes the full documented /directives table, including repeat', () => {
  // The AGENTS.md table lists these as importable from `@webjsdev/core/directives`.
  // In src/dev mode that subpath resolves to src/directives.js, so the whole table
  // (repeat included, even though it's implemented in repeat.js) must be re-exported
  // here, or a dev-mode import of a documented directive silently reads undefined.
  for (const name of ['repeat', 'isRepeat', 'unsafeHTML', 'live', 'keyed', 'guard', 'templateContent', 'ref', 'createRef', 'cache', 'until', 'asyncAppend', 'asyncReplace', 'watch']) {
    assert.equal(typeof directives[name], 'function', `${name} must be exported from src/directives.js (the /directives src-mode surface)`);
  }
});
