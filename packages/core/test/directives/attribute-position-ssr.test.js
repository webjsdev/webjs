/**
 * Built-in directives in an ATTRIBUTE position, server render (#1686, Lit
 * conformance). Lit unwraps `until`, `guard`, `keyed` and `cache` at every
 * binding position; the SSR walk used to stringify them to "[object Object]"
 * outside a child position. The client half is
 * `browser/attribute-position-directives.test.js` and the ported lit suite in
 * `browser/directives-until.test.js`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from '../../src/html.js';
import { renderToString } from '../../src/render-server.js';
import { until, guard, keyed, cache } from '../../src/directives.js';

const pending = () => new Promise(() => {});

test('until in an attribute renders its first non-promise argument', async () => {
  const out = await renderToString(html`<img alt="" src=${until(pending(), '/placeholder.png')}>`);
  assert.match(out, /src="\/placeholder\.png"/);
  assert.doesNotMatch(out, /object Object/);
});

test('until in an attribute with only promises renders the first to settle', async () => {
  const out = await renderToString(html`<a href=${until(Promise.resolve('/real'))}>x</a>`);
  assert.match(out, /href="\/real"/);
});

test('until in an interpolated attribute renders the piece', async () => {
  const out = await renderToString(html`<div title="value:${until(pending(), 'bar')}"></div>`);
  assert.match(out, /title="value:bar"/);
});

test('until in a quoted single-hole attribute renders the piece', async () => {
  const out = await renderToString(html`<div title="${until(pending(), 'q')}"></div>`);
  assert.match(out, /title="q"/);
});

test('until in a boolean attribute', async () => {
  const on = await renderToString(html`<input ?disabled=${until(pending(), true)}>`);
  const off = await renderToString(html`<input ?disabled=${until(pending(), false)}>`);
  assert.match(on, /disabled/);
  assert.doesNotMatch(off, /disabled/);
});

test('guard in an attribute renders its callback result', async () => {
  const out = await renderToString(html`<a href=${guard([1], () => '/guarded')}>x</a>`);
  assert.match(out, /href="\/guarded"/);
});

test('keyed and cache in an attribute render their value', async () => {
  const out = await renderToString(html`<a href=${keyed(1, '/k')} title=${cache('c')}>x</a>`);
  assert.match(out, /href="\/k"/);
  assert.match(out, /title="c"/);
});
