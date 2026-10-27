/**
 * Walker state that must not leak past the point that produced it (#1646
 * review). A component whose template walk throws is isolated (#469), and the
 * page keeps rendering, so the open text-only elements, the deferred-region
 * depth and the ancestor chain the throw abandoned must be restored. A start
 * tag cut off by the end of its input must not take the page built before it.
 * And the start-tag exits keep the raw-text decision the renderer before the
 * one-pass walk made.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, renderToString, renderToStream, WebComponent } from '../../index.js';
import { unsafeHTML } from '../../src/directives.js';

class IsoGood extends WebComponent {
  render() { return html`<b>good</b>`; }
}
IsoGood.register('iso-good');

class IsoInner extends WebComponent {
  render() { return html`<slot></slot>`; }
}
IsoInner.register('iso-inner');

class IsoThrowInTextarea extends WebComponent {
  render() { return html`<textarea>${Promise.reject(new Error('boom'))}</textarea>`; }
}
IsoThrowInTextarea.register('iso-throw-textarea');

class IsoThrowInChild extends WebComponent {
  render() { return html`<iso-inner>${Promise.reject(new Error('boom'))}</iso-inner>`; }
}
IsoThrowInChild.register('iso-throw-child');

class IsoThrowInBoundary extends WebComponent {
  render() { return html`<webjs-suspense>${Promise.reject(new Error('boom'))}</webjs-suspense>`; }
}
IsoThrowInBoundary.register('iso-throw-boundary');

class IsoProbe extends WebComponent {
  render() { return html`<i>${this.closest('iso-throw-child') ? 'inside' : 'outside'}</i>`; }
}
IsoProbe.register('iso-probe');

let fallbackRenders = 0;
class IsoFallbackProbe extends WebComponent {
  render() { fallbackRenders += 1; return html`<i>fb</i>`; }
}
IsoFallbackProbe.register('iso-fallback-probe');

const GOOD = '<iso-good data-wj-host><!--webjs-hydrate--><b>good</b></iso-good>';

async function quiet(fn) {
  const orig = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = orig; }
}

async function drain(stream) {
  const reader = stream.getReader();
  let out = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return out;
    out += value;
  }
}

test('a throw inside a text-only element of a component template leaves later siblings expanded', async () => {
  const out = await quiet(() => renderToString(html`<iso-throw-textarea></iso-throw-textarea><iso-good></iso-good>`));
  assert.ok(out.endsWith(GOOD), out);
});

test('a throw inside a nested component leaves no stale instance on the ancestor chain', async () => {
  const out = await quiet(() => renderToString(html`<iso-throw-child></iso-throw-child><iso-probe></iso-probe>`));
  assert.ok(out.endsWith('<iso-probe data-wj-host><!--webjs-hydrate--><i>outside</i></iso-probe>'), out);
});

test('a throw inside a streamed boundary of a component template leaves the deferred depth balanced', async () => {
  const ctx = { pending: [], nextId: 1, usedComponents: new Set() };
  const out = await quiet(() => drain(renderToStream(
    html`<iso-throw-boundary></iso-throw-boundary><iso-good></iso-good>`,
    { ssr: true, suspenseCtx: ctx },
  )));
  assert.ok(out.includes(GOOD), out);
});

test('a registered start tag cut off by the end of an unsafeHTML string keeps the page before it', async () => {
  const out = await renderToString(html`<header>SITE</header><p>${unsafeHTML('excerpt <iso-good class="x')}</p><footer>END</footer>`);
  assert.equal(out, '<header>SITE</header><p>excerpt <iso-good class="x</p><footer>END</footer>');
});

test('whitespace before the > of a valueless attribute still enters raw text for script', async () => {
  const out = await renderToString(html`<script async >var a = ${'1 < 2 && 3'};</script>`);
  assert.equal(out, '<script async >var a = 1 < 2 && 3;</script>');
});
