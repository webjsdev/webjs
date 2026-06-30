/**
 * Cross-runtime proof that the template binding-prefix dispatch (#784) renders
 * identically under WHICHEVER runtime executes this file. Run it under both:
 *
 *   node test/bun/binding-prefixes.mjs
 *   bun  test/bun/binding-prefixes.mjs
 *
 * The renderers now read the prefix set from core's single-sourced
 * BINDING_PREFIXES and dispatch on the kind instead of hardcoded
 * `prefix === '@'|'.'|'?'` chains. That dispatch is on the SSR hot path, so it
 * is runtime-sensitive. There are TWO server dispatch sites with DIFFERENT
 * rules, and this exercises both:
 *   - the buffered renderer (`renderToString`): `@event` drops, `.prop` on a
 *     custom element round-trips as `data-webjs-prop-*`, `?bool` round-trips as
 *     a boolean attribute.
 *   - the streaming renderer (`renderToStream({ ssr: false })`, i.e.
 *     `streamTemplate`): `@event` AND `.prop` BOTH drop (grouped), `?bool`
 *     round-trips. The `ssr: true` default goes through the buffered renderer,
 *     so `ssr: false` is required to reach the streaming dispatch.
 *
 * A plain assert script (not `*.test.mjs`, so the node:test runner does not
 * double-run it); it exits non-zero on failure. Run from the repo root so the
 * bare `@webjsdev/core` specifier resolves to the workspace package.
 */
import assert from 'node:assert/strict';
import { html } from '@webjsdev/core';
import { renderToString, renderToStream } from '@webjsdev/core/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

/** One template exercising all three prefixes on a custom element. */
const tpl = () => html`<my-el @click=${() => {}} .label=${'x'} ?open=${true}></my-el>`;

const PROP = /data-webjs-prop-label="/;
const EVENT = /@click|\bclick=/;
const BOOL = /\bopen=""/;

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

// Buffered renderer: @event drops, .prop round-trips, ?bool round-trips.
const buffered = await renderToString(tpl());
assert.match(buffered, /<my-el/, `buffered: the element must render, got ${buffered}`);
assert.ok(!EVENT.test(buffered), `buffered: @event must drop at SSR, got ${buffered}`);
assert.match(buffered, PROP, `buffered: .prop must round-trip as data-webjs-prop-*, got ${buffered}`);
assert.match(buffered, BOOL, `buffered: ?bool must round-trip as a boolean attribute, got ${buffered}`);

// Streaming renderer (streamTemplate, the third dispatch site): @event AND
// .prop BOTH drop (grouped), ?bool round-trips. `ssr: false` is what reaches it.
const streamed = await drain(renderToStream(tpl(), { ssr: false }));
assert.match(streamed, /<my-el/, `streamed: the element must render, got ${streamed}`);
assert.ok(!EVENT.test(streamed), `streamed: @event must drop, got ${streamed}`);
assert.ok(!PROP.test(streamed), `streamed: .prop is grouped with @event as a drop here, got ${streamed}`);
assert.match(streamed, BOOL, `streamed: ?bool must round-trip, got ${streamed}`);

console.log(`[binding-prefixes] OK on ${runtime}: buffered (@event drop, .prop + ?bool round-trip) and streamed (@event + .prop drop, ?bool round-trip) dispatch correctly`);
