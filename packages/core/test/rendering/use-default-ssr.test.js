// Lit's `useDefault` on the server (#1686): the first value is the default
// and is not reflected, so SSR serves no attribute for it, the same as the
// browser; an authored attribute still wins and stays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html } from '../../src/html.js';
import { renderToString } from '../../src/render-server.js';
import { WebComponent } from '../../src/component.js';

class UseDefaultEl extends WebComponent {
  static properties = { mode: { type: String, reflect: true, useDefault: true } };
  constructor() { super(); this.mode = 'auto'; }
  render() { return html`<span>${this.mode}</span>`; }
}
UseDefaultEl.register('use-default-ssr');

class PlainReflectEl extends WebComponent {
  static properties = { mode: { type: String, reflect: true } };
  constructor() { super(); this.mode = 'auto'; }
  render() { return html`<span>${this.mode}</span>`; }
}
PlainReflectEl.register('plain-reflect-ssr');

test('a useDefault default is not reflected on the server', async () => {
  const out = await renderToString(html`<use-default-ssr></use-default-ssr>`);
  assert.doesNotMatch(out, /<use-default-ssr[^>]*\smode=/);
  assert.match(out, /<span>auto<\/span>/);
});

test('an authored attribute on a useDefault prop renders and stays', async () => {
  const out = await renderToString(html`<use-default-ssr mode="dark"></use-default-ssr>`);
  assert.match(out, /<use-default-ssr[^>]*\smode="dark"/);
  assert.match(out, /<span>dark<\/span>/);
});

test('without useDefault the constructor value reflects, as in Lit', async () => {
  const out = await renderToString(html`<plain-reflect-ssr></plain-reflect-ssr>`);
  assert.match(out, /<plain-reflect-ssr[^>]*\smode="auto"/);
});
