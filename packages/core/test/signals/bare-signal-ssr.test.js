/**
 * A bare `${signal}` in a template hole renders the signal's current value at
 * SSR in child, attribute, boolean and interpolated-attribute positions (the
 * client binds the hole so it updates in place; see
 * `browser/bare-signal.test.js`). A `.prop` hole still receives the signal
 * object. Also pins the Lit signals surface on `@webjsdev/core/signals`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { html, renderToString, signal, computed } from '../../index.js';
import * as signals from '../../src/signal.js';
import { watch } from '../../src/directives.js';

const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');

test('a bare signal renders its value in child, attribute, boolean and mixed holes', async () => {
  const name = signal('Ada');
  const off = signal(false);
  const on = signal(true);
  const n = computed(() => name.get().length);
  const out = await renderToString(html`<p title=${name} class="x ${n} y" ?hidden=${off} ?open=${on}>${name}:${n}</p>`);
  assert.equal(strip(out).replace(/ +/g, ' '), '<p title="Ada" class="x 3 y" open="">Ada:3</p>');
});

test('a bare signal in an array item or nested template renders its value', async () => {
  const s = signal('v');
  const out = await renderToString(html`<p>${[html`<b>${s}</b>`]}</p>`);
  assert.equal(strip(out), '<p><b>v</b></p>');
});

test('@webjsdev/core/signals carries the Lit signals surface', () => {
  assert.equal(typeof signals.SignalWatcher, 'function');
  assert.equal(signals.watch, watch);
  class Base {}
  assert.equal(signals.SignalWatcher(Base), Base, 'SignalWatcher is an identity mixin');
});

test('the /signals subpath resolves to the browser bundle in dist mode (one signal graph)', () => {
  // A source-only `./signals` made the dist importmap load a SECOND copy of the
  // signal module beside the bundle, so a signal from `@webjsdev/core/signals`
  // could never be tracked by a component from `@webjsdev/core`.
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const entry = pkg.exports['./signals'];
  assert.equal(entry.default, './dist/webjs-core-browser.js');
  assert.equal(entry.source, './src/signal.js');
});
