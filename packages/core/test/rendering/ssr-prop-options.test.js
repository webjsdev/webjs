// SSR coverage for the reactive-prop `default` and custom `attribute` options.
// SSR runs the constructor + render() (not connectedCallback), so a `default`
// must appear in the first paint, and a custom `attribute` on a parent-rendered
// tag must coerce to the right property server-side (the JS-off contract).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebComponent, prop } from '../../index.js';
import { html } from '../../src/html.js';
import { renderToString } from '../../src/render-server.js';

class SsrDefault extends WebComponent({ label: prop(String, { default: 'hi' }) }) {
  render() { return html`<span>${this.label}</span>`; }
}
SsrDefault.register('ssr-default');

class SsrAttr extends WebComponent({ open: prop(Boolean, { attribute: 'is-open' }) }) {
  render() { return html`<span>${this.open ? 'OPEN' : 'CLOSED'}</span>`; }
}
SsrAttr.register('ssr-attr');

test('default option lands in the SSR first paint', async () => {
  const out = await renderToString(html`<ssr-default></ssr-default>`);
  assert.match(out, />hi</, 'the default "hi" is rendered server-side without any attribute');
});

test('custom attribute coerces to its property at SSR', async () => {
  const out = await renderToString(html`<ssr-attr is-open></ssr-attr>`);
  assert.match(out, />OPEN</, 'the is-open attribute maps to the `open` prop during SSR');
});

test('custom attribute SSR counterfactual: absent attribute leaves the prop falsy', async () => {
  const out = await renderToString(html`<ssr-attr></ssr-attr>`);
  assert.match(out, />CLOSED</, 'without is-open, `open` is falsy in the SSR output');
});
