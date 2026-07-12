/**
 * Cross-runtime proof that the framework host-display default marker renders
 * identically under WHICHEVER runtime executes this file. Run under both:
 *
 *   node test/bun/host-display-default.mjs
 *   bun  test/bun/host-display-default.mjs
 *
 * The SSR walker stamps every component host (light AND shadow) with
 * `data-wj-host` so the head rule `:where([data-wj-host]){display:block}`
 * defaults hosts to block (a custom element is display:inline by default, which
 * collapses a block container). Host emission is on the SSR hot path, so it is
 * runtime-sensitive. A plain assert script (not `*.test.mjs`), exits non-zero on
 * failure. Run from the repo root so the bare `@webjsdev/core` specifier
 * resolves to the workspace package.
 */
import assert from 'node:assert/strict';
import { html, WebComponent } from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

class BunLight extends WebComponent {
  render() { return html`<p>hi</p>`; }
}
BunLight.register('bun-hd-light');

class BunShadow extends WebComponent {
  static shadow = true;
  render() { return html`<p>hi</p>`; }
}
BunShadow.register('bun-hd-shadow');

const light = await renderToString(html`<bun-hd-light></bun-hd-light>`);
assert.match(light, /<bun-hd-light data-wj-host><!--webjs-hydrate-->/, `[${runtime}] light host marked`);

const shadow = await renderToString(html`<bun-hd-shadow></bun-hd-shadow>`);
assert.match(shadow, /<bun-hd-shadow data-wj-host><template shadowrootmode="open">/, `[${runtime}] shadow host marked`);

// Idempotent: the marker is added exactly once.
assert.equal((light.match(/data-wj-host/g) || []).length, 1, `[${runtime}] marker added once`);

console.log(`[${runtime}] host-display-default: light + shadow hosts carry data-wj-host ✓`);
