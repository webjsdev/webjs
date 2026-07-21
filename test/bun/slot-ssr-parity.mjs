/**
 * Cross-runtime proof that light-DOM slot SSR projection renders identically
 * under WHICHEVER runtime executes this file. Run under both:
 *
 *   node test/bun/slot-ssr-parity.mjs
 *   bun  test/bun/slot-ssr-parity.mjs
 *
 * Slot projection is on the SSR hot path (injectDSD / substituteSlotsInRender in
 * render-server.js), so it is runtime-sensitive. #1021 removed the SSR record
 * seeding; this asserts the projection itself is unchanged and byte-consistent
 * across runtimes: authored children land in their named + default slots, an
 * unmatched slot shows its fallback, and the `data-webjs-light` marker plus
 * `data-projection` are emitted. A plain assert script (not `*.test.mjs`), exits
 * non-zero on failure. Run from the repo root so the bare `@webjsdev/core`
 * specifier resolves to the workspace package.
 */
import assert from 'node:assert/strict';
import { html, WebComponent } from '@webjsdev/core';
import { renderToString } from '@webjsdev/core/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

class BunPanel extends WebComponent {
  render() {
    return html`<header><slot name="header"></slot></header>
      <main><slot></slot></main>
      <footer><slot name="footer">no actions</slot></footer>`;
  }
}
BunPanel.register('bun-slot-panel');

const out = await renderToString(
  html`<bun-slot-panel><h2 slot="header">Title</h2><p>Body</p></bun-slot-panel>`,
);

// Named slot got its authored child, projected as "actual".
assert.match(out, /data-projection="actual"[^>]* name="header">[\s\S]*?Title/, `[${runtime}] header slot projected`);
// Default slot (no name) caught the unnamed child.
assert.match(out, /data-projection="actual"[^>]*><p>Body<\/p><\/slot>/, `[${runtime}] default slot projected`);
// The unmatched footer slot shows its fallback.
assert.match(out, /data-projection="fallback"[^>]* name="footer">no actions/, `[${runtime}] footer fallback shown`);
// The framework light-slot marker is emitted.
assert.match(out, /data-webjs-light/, `[${runtime}] data-webjs-light marker present`);

console.log(`[${runtime}] slot SSR parity OK`);
