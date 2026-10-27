/**
 * The walker's less-travelled branches (#1646), so the one-pass renderer's
 * line coverage is not carried by the golden corpus alone: the `until()`
 * race, `templateContent`, a value with no renderer case, a dropped hole
 * position at RENDER time, a `renderError()` that itself throws, a
 * whitespace-padded end tag, and the string-input `injectDSD` entry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { html, renderToString, WebComponent } from '../../index.js';
import { until, templateContent } from '../../src/directives.js';
import { injectDSD } from '../../src/render-server/dsd.js';
import { streamRender } from '../../src/render-server/template-renderer.js';

class EdgeProbe extends WebComponent {
  render() { return html`<b>EDGE</b>`; }
}
EdgeProbe.register('edge-probe');

class DoubleThrow extends WebComponent {
  render() { throw new Error('first'); }
  renderError() { throw new Error('second'); }
}
DoubleThrow.register('edge-double-throw');

async function quiet(fn) {
  const orig = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = orig; }
}

test('until() with only promises renders the first to settle, and an all-reject set renders nothing', async () => {
  const slow = new Promise((r) => setTimeout(() => r('slow'), 20));
  const fast = Promise.resolve('fast');
  assert.equal(await renderToString(html`<p>${until(slow, fast)}</p>`), '<p>fast</p>');
  const rejected = Promise.reject(new Error('no'));
  rejected.catch(() => {});
  assert.equal(await renderToString(html`<p>${until(rejected)}</p>`), '<p></p>');
  assert.equal(await renderToString(html`<p>${until()}</p>`), '<p></p>');
});

test('templateContent() emits the template innerHTML, expanded like any raw markup', async () => {
  const tpl = { innerHTML: '<i>raw</i><edge-probe></edge-probe>' };
  const out = await renderToString(html`<div>${templateContent(tpl)}</div>`);
  assert.equal(out, '<div><i>raw</i><edge-probe data-wj-host><!--webjs-hydrate--><b>EDGE</b></edge-probe></div>');
  const chunks = [];
  const stream = new WritableStream();
  void stream;
  const controller = { enqueue: (c) => chunks.push(c) };
  await streamRender(html`<div>${templateContent(tpl)}</div>`, undefined, controller);
  assert.deepEqual(chunks, ['<div>', '<i>raw</i><edge-probe></edge-probe>', '</div>'], 'the ssr:false stream emits it verbatim, unexpanded');
});

test('a value with no renderer case stringifies, and a dropped hole position renders nothing', async () => {
  assert.equal(await renderToString(html`<p>${{ toString: () => '<obj>' }}</p>`), '<p>&lt;obj&gt;</p>');
  assert.equal(await renderToString(html`<p>${123n}</p>`), '<p>123</p>');
  assert.equal(await renderToString(html`<div ${'dropped'} class${'dropped'}>x</div>`), '<div  class>x</div>');
});

test('a renderError() that throws too leaves an empty, marked element and reports both', async () => {
  const errors = [];
  const orig = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  let out;
  try {
    out = await renderToString(html`<edge-double-throw><p>gone</p></edge-double-throw>`, { ssr: true, dev: true });
  } finally {
    console.error = orig;
  }
  assert.equal(out, '<edge-double-throw data-wj-host><!--webjs-hydrate--></edge-double-throw>');
  assert.ok(errors.some((e) => e.includes('SSR failed for <edge-double-throw>')));
  assert.ok(errors.some((e) => e.includes('renderError() for <edge-double-throw> also threw')));
});

test('a whitespace-padded end tag still closes its element and its component frame', async () => {
  const out = await renderToString(html`<edge-probe ></edge-probe  ><div></div  >`);
  assert.equal(out, '<edge-probe  data-wj-host><!--webjs-hydrate--><b>EDGE</b></edge-probe><div></div  >');
});

test('injectDSD() expands a raw HTML string with the same tokenizer', async () => {
  const out = await injectDSD('<p><!-- <edge-probe></edge-probe> --><edge-probe></edge-probe></p>');
  assert.equal(out, '<p><!-- <edge-probe></edge-probe> --><edge-probe data-wj-host><!--webjs-hydrate--><b>EDGE</b></edge-probe></p>');
  assert.equal(await injectDSD(''), '');
});

test('an unclosed component at the end of a raw string closes synthetically with the rest as children', async () => {
  const out = await quiet(() => injectDSD('<edge-probe><p>rest'));
  assert.equal(out, '<edge-probe data-wj-host><!--webjs-hydrate--><b>EDGE</b></edge-probe>');
});
