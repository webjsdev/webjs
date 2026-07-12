/**
 * The framework defaults a component host to `display:block` (a custom element
 * is `display:inline` by default, which collapses a component used as a block
 * container). SSR stamps every host (light AND shadow) with `data-wj-host`; the
 * document head (built in @webjsdev/server) carries the single low-specificity
 * rule `:where([data-wj-host]) { display: block }`. This test pins the SSR half
 * (the marker); the head-rule half is asserted in the server package.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WebComponent } from '../../src/component.js';
import { html } from '../../src/html.js';
import { renderToString } from '../../src/render-server.js';

test('a light-DOM host is marked with data-wj-host', async () => {
  class LightHost extends WebComponent {
    render() { return html`<p>hi</p>`; }
  }
  LightHost.register('hd-light');
  const out = await renderToString(html`<hd-light></hd-light>`);
  assert.match(out, /<hd-light data-wj-host><!--webjs-hydrate-->/, 'light host carries the marker');
});

test('a shadow-DOM host is marked with data-wj-host', async () => {
  class ShadowHost extends WebComponent {
    static shadow = true;
    render() { return html`<p>hi</p>`; }
  }
  ShadowHost.register('hd-shadow');
  const out = await renderToString(html`<hd-shadow></hd-shadow>`);
  assert.match(out, /<hd-shadow data-wj-host><template shadowrootmode="open">/, 'shadow host carries the marker');
});

test('the marker does not clobber authored attributes and is added once', async () => {
  class WithAttrs extends WebComponent {
    render() { return html`<p>x</p>`; }
  }
  WithAttrs.register('hd-attrs');
  const out = await renderToString(html`<hd-attrs id="a" class="b"></hd-attrs>`);
  // Authored attributes preserved, marker appended exactly once.
  assert.match(out, /<hd-attrs id="a" class="b" data-wj-host>/, 'authored attrs kept, marker appended');
  assert.equal((out.match(/data-wj-host/g) || []).length, 1, 'marker added exactly once');
});
