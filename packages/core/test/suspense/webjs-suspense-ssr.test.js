/**
 * `<webjs-suspense>` element-level streaming boundary, SSR side (#471).
 *
 * Blocking (renderToString): the wrapped children render inline with real
 * data, the fallback is dropped. Streaming (renderToStream + a suspenseCtx):
 * the fallback flushes first, then each boundary's children stream in as a
 * `<template data-webjs-resolve>` plus the swap script, and multiple
 * boundaries resolve concurrently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { renderToString, renderToStream, html } from '../../index.js';
import { WebComponent } from '../../src/component.js';

async function streamText(stream) {
  const reader = stream.getReader();
  let out = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return out;
    out += value;
  }
}

class SlowItem extends WebComponent({ label: String, delay: Number }) {
  constructor() { super(); this.label = ''; this.delay = 0; }
  async render() {
    if (this.delay) await new Promise((r) => setTimeout(r, this.delay));
    return html`<p class="item">${this.label}</p>`;
  }
}
SlowItem.register('slow-item');

test('blocking renderToString: wrapped children render inline, fallback dropped', async () => {
  const out = await renderToString(html`
    <webjs-suspense .fallback=${html`<div class="fb">loading</div>`}>
      <slow-item label="A"></slow-item>
    </webjs-suspense>
  `);
  assert.match(out, /class="item"[^>]*>A/, 'the real child rendered inline');
  assert.doesNotMatch(out, /class="fb"/, 'the fallback is NOT emitted in the blocking path');
  assert.doesNotMatch(out, /data-webjs-resolve/, 'no streaming markup in the blocking path');
});

test('streaming: the fallback flushes first, then the children stream in', async () => {
  const ctx = { pending: [], nextId: 1, usedComponents: new Set() };
  const stream = renderToStream(
    html`<webjs-suspense .fallback=${html`<div class="fb">loading…</div>`}><slow-item label="B"></slow-item></webjs-suspense>`,
    { ssr: true, suspenseCtx: ctx },
  );
  const out = await streamText(stream);
  // The boundary placeholder carries the fallback and an id.
  assert.match(out, /<webjs-suspense id="s\d+"><div class="fb">loading…<\/div><\/webjs-suspense>/, 'fallback placeholder with a boundary id');
  // The resolved children stream as a keyed template + swap script.
  assert.match(out, /<template data-webjs-resolve="s\d+">/, 'streamed resolve template');
  assert.match(out, /class="item"[^>]*>B/, 'the resolved child content streamed in');
  assert.match(out, /getElementById\("s\d+"\)/, 'the swap script targets the boundary id');
});

test('streaming: multiple boundaries fetch concurrently (not serial)', async () => {
  const ctx = { pending: [], nextId: 1, usedComponents: new Set() };
  const t0 = Date.now();
  const stream = renderToStream(
    html`
      <webjs-suspense .fallback=${html`<i>a</i>`}><slow-item label="X" delay="80"></slow-item></webjs-suspense>
      <webjs-suspense .fallback=${html`<i>b</i>`}><slow-item label="Y" delay="80"></slow-item></webjs-suspense>
    `,
    { ssr: true, suspenseCtx: ctx },
  );
  const out = await streamText(stream);
  const elapsed = Date.now() - t0;
  assert.match(out, />X</, 'first boundary resolved');
  assert.match(out, />Y</, 'second boundary resolved');
  // Two 80ms fetches run concurrently (~80ms), not serially (~160ms). Generous
  // bound to avoid flake on a loaded CI box.
  assert.ok(elapsed < 150, `boundaries streamed concurrently (took ${elapsed}ms, serial would be ~160ms)`);
});

test('streaming: a boundary with no .fallback shows an empty placeholder', async () => {
  const ctx = { pending: [], nextId: 1, usedComponents: new Set() };
  const stream = renderToStream(
    html`<webjs-suspense><slow-item label="C"></slow-item></webjs-suspense>`,
    { ssr: true, suspenseCtx: ctx },
  );
  const out = await streamText(stream);
  assert.match(out, /<webjs-suspense id="s\d+"><\/webjs-suspense>/, 'empty placeholder when no fallback is given');
  assert.match(out, /class="item"[^>]*>C/, 'the child still streams in');
});

test('streaming: a throwing component inside a boundary is isolated, siblings stream', async () => {
  class BoomItem extends WebComponent {
    async render() { throw new Error('stream boom'); }
    renderError(e) { return html`<p class="boom">${e.message}</p>`; }
  }
  BoomItem.register('boom-item');
  const origError = console.error;
  console.error = () => {};
  try {
    const ctx = { pending: [], nextId: 1, usedComponents: new Set() };
    const stream = renderToStream(
      html`<webjs-suspense .fallback=${html`<i>l</i>`}><slow-item label="OK"></slow-item><boom-item></boom-item></webjs-suspense>`,
      { ssr: true, suspenseCtx: ctx },
    );
    const out = await streamText(stream);
    assert.match(out, /class="item"[^>]*>OK/, 'the good sibling streamed');
    assert.match(out, /class="boom">stream boom/, 'the throwing component rendered its error state, boundary not stuck');
  } finally {
    console.error = origError;
  }
});

test('streaming: a rejected page-level Suspense boundary renders an error, not a stuck fallback', async () => {
  const { Suspense } = await import('../../index.js');
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const origError = console.error;
  console.error = () => {};
  try {
    const ctx = { pending: [], nextId: 1, usedComponents: new Set() };
    const stream = renderToStream(
      html`${Suspense({ fallback: html`<i>loading</i>`, children: Promise.reject(new Error('boundary failed')) })}`,
      { ssr: true, suspenseCtx: ctx },
    );
    const out = await streamText(stream);
    assert.match(out, /data-webjs-resolve/, 'the boundary resolved (swapped) instead of hanging on the fallback');
    assert.match(out, /boundary failed/, 'the dev error message is surfaced');
  } finally {
    process.env.NODE_ENV = prev;
    console.error = origError;
  }
});

test('a TemplateResult fallback never leaks through the data-webjs-prop path', async () => {
  const out = await renderToString(
    html`<webjs-suspense .fallback=${html`<span>x</span>`}><slow-item label="Z"></slow-item></webjs-suspense>`,
  );
  assert.doesNotMatch(out, /data-webjs-prop-fallback/, 'fallback is not serialized as a prop attribute');
});
