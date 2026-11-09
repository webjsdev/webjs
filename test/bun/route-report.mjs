/**
 * Cross-runtime proof that the route report (#1686) is IDENTICAL under
 * whichever runtime runs it:
 *
 *   node test/bun/route-report.mjs
 *   bun  test/bun/route-report.mjs
 *
 * WebJs runs on Node 24+ AND Bun (#508), and `webjs doctor` reads this report
 * against a Bun-served app, so a report that drifted between runtimes would
 * tell a Bun author something untrue about what their routes load. The
 * analysis is filesystem reads and regular expressions over source, and the
 * `.ts` files below go through the runtime's own module graph scan, so a
 * divergence shows up as a concrete row mismatch. Run from the repo root so
 * `@webjsdev/server` resolves.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { analyzeRouteModules } from '@webjsdev/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const dir = mkdtempSync(join(tmpdir(), 'webjs-route-report-x-'));

const write = (rel, src) => {
  const abs = join(dir, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, src);
};

try {
  write('package.json', JSON.stringify({ name: 'route-report-fixture', type: 'module' }));
  write('components/board.ts', `
import { WebComponent, html } from '@webjsdev/core';
type Cell = readonly [number, number];
export class Board extends WebComponent {
  render() { return html\`<div>board</div>\`; }
}
Board.register('my-board');
`);
  write('components/card.server.ts', `
import { WebComponent, html } from '@webjsdev/core';
export class Card extends WebComponent {
  render() { return html\`<div>card</div>\`; }
}
Card.register('my-card');
`);
  write('lib/boot.ts', "document.title = 'set at load';\nexport {};\n");
  write('app/layout.ts', "import { html } from '@webjsdev/core';\nimport '../components/board.ts';\nexport default ({ children }: { children: unknown }) => html`<my-board></my-board>${children}`;\n");
  write('app/page.ts', "import { html } from '@webjsdev/core';\nimport '../components/card.server.ts';\nimport '../lib/boot.ts';\nexport default () => html`<my-card></my-card>`;\n");
  write('app/error.ts', "import { html } from '@webjsdev/core';\nexport default () => html`<p>oops</p>`;\n");

  const r = await analyzeRouteModules(dir);
  assert.equal(r.analysed, true, `analysed on ${runtime}`);
  assert.deepEqual(r.routeModules.map(({ file, kind, emits }) => ({ file, kind, emits })), [
    { file: 'app/error.ts', kind: 'error', emits: [] },
    { file: 'app/layout.ts', kind: 'layout', emits: ['components/board.ts'] },
    { file: 'app/page.ts', kind: 'page', emits: [] },
  ], `route rows on ${runtime}`);
  const page = r.routeModules.find((m) => m.file === 'app/page.ts');
  assert.equal(page.hints.length, 1, `one hint on ${runtime}: ${JSON.stringify(page.hints)}`);
  assert.match(page.hints[0], /`\.\.\/lib\/boot\.ts` runs only on the server/);
  assert.deepEqual(r.summary, { routeModules: 3, zeroJs: 2, carriers: 1, orphans: 0 }, `summary on ${runtime}`);
  console.log(`[route-report] OK on ${runtime}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
