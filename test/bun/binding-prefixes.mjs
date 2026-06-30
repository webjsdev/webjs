/**
 * Cross-runtime proof that the template binding-prefix dispatch (#784) renders
 * identically under WHICHEVER runtime executes this file. Run it under both:
 *
 *   node test/bun/binding-prefixes.mjs
 *   bun  test/bun/binding-prefixes.mjs
 *
 * The renderers (`render-server.js`, buffered + streaming) now read the prefix
 * set from core's single-sourced `BINDING_PREFIXES` and dispatch on the kind
 * instead of hardcoded `prefix === '@'|'.'|'?'` chains. That dispatch is on the
 * SSR hot path, so it is runtime-sensitive: this asserts every branch is
 * byte-correct on Node AND Bun. A plain assert script (not `*.test.mjs`, so the
 * node:test runner does not double-run it); it exits non-zero on failure. Run
 * from the repo root so the bare `@webjsdev/core` specifier resolves to the
 * workspace package.
 */
import assert from 'node:assert/strict';
import { html } from '@webjsdev/core';
import { renderToString, renderToStream } from '@webjsdev/core/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

/** One template exercising all three prefixes on a custom element. */
const tpl = () => html`<my-el @click=${() => {}} .label=${'x'} ?open=${true}></my-el>`;

/** Assert the three dispatch outcomes on a rendered string. */
function assertBindings(out, via) {
  // `@event` is client-only behaviour: dropped at SSR (no listener attribute).
  assert.ok(!/@click|\bclick=/.test(out), `${via}: @event must drop at SSR, got ${out}`);
  // `.prop` on a custom element round-trips as data-webjs-prop-* (rehydrated).
  assert.match(out, /data-webjs-prop-label="/, `${via}: .prop must round-trip as data-webjs-prop-*, got ${out}`);
  // `?bool` round-trips as a bare boolean attribute when truthy.
  assert.match(out, /\bopen=""/, `${via}: ?bool must round-trip as a boolean attribute, got ${out}`);
}

async function drain(stream) {
  let out = '';
  const reader = stream.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += typeof value === 'string' ? value : dec.decode(value);
  }
  return out;
}

const buffered = await renderToString(tpl());
assertBindings(buffered, 'renderToString');

const streamed = await drain(renderToStream(tpl()));
assertBindings(streamed, 'renderToStream');

// The two paths must agree (the streaming site groups event+prop as drop; for a
// synchronous prop value both resolve to the same served HTML).
assert.equal(streamed, buffered, 'buffered and streamed binding dispatch must match');

console.log(`[binding-prefixes] OK on ${runtime}: @event dropped, .prop + ?bool round-trip (buffered == streamed)`);
