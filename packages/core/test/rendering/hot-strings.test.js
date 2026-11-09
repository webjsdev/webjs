/**
 * The dev hot-swap seam in `html()` / `svg()` (#1689). The dev server's reload
 * client installs a hot client on `globalThis[Symbol.for('webjs.hot')]`, and
 * the template tags pass their strings through its `strings(s, kind)` so
 * textually identical templates share one strings object across module
 * evaluations. With no hot client (production, and every test that installs
 * none) the strings object is returned untouched.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { html, svg } from '../../src/html.js';
import { hotReplacer } from '../../src/hot.js';

const HOT = Symbol.for('webjs.hot');
afterEach(() => { delete globalThis[HOT]; });

test('html() and svg() return the strings untouched with no hot client', () => {
  const tag = (s) => s;
  const strings = tag`<p>${0}</p>`;
  assert.equal(html(strings, 1).strings, strings);
  assert.equal(svg(strings, 1).strings, strings);
  assert.equal(hotReplacer(), null);
});

test('html() passes its strings through the hot client with kind 0, svg() with kind 1', () => {
  /** @type {Array<[unknown, number]>} */
  const calls = [];
  const canonical = ['canonical'];
  globalThis[HOT] = { strings(s, kind) { calls.push([s, kind]); return canonical; }, replace() {} };
  const tag = (s) => s;
  const strings = tag`<p>${0}</p>`;
  const h = html(strings, 1);
  const s = svg(strings, 2);
  assert.equal(h.strings, canonical, 'html keeps what the hot client returns');
  assert.equal(s.strings, canonical, 'svg keeps what the hot client returns');
  assert.deepEqual(calls, [[strings, 0], [strings, 1]]);
  assert.deepEqual(h.values, [1]);
  assert.equal(s.svg, true);
});

test('hotReplacer() returns the hot client replace function when installed', () => {
  const replace = () => {};
  globalThis[HOT] = { strings: (s) => s, replace };
  assert.equal(hotReplacer(), replace);
});
