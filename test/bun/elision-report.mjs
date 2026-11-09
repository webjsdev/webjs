/**
 * Cross-runtime proof that the app-level elision verdict (#1308) is IDENTICAL
 * under whichever runtime runs it:
 *
 *   node test/bun/elision-report.mjs
 *   bun  test/bun/elision-report.mjs
 *
 * WebJs runs on Node 24+ AND Bun (#508), and an app scaffolded with `--runtime
 * bun` runs `webjs elision` against a Bun-served app, so a verdict that drifted
 * between runtimes would mean the report told a Bun author something untrue
 * about their own app. The analysis is filesystem reads and regular expressions
 * over source the framework's TypeScript stripper has erased (#1423), and that
 * stripper IS runtime-specific: Node's built-in `module.stripTypeScriptTypes`
 * on one side, `amaro` on the other. The two are meant to be byte-identical,
 * and the `.ts` util below is what holds them to it, since a divergence there
 * would silently change what a Bun-served app downloads. Nothing here is
 * legitimate to skip, so this file carries no DENYLIST entry.
 *
 * The fixture covers components of each verdict and route modules that load
 * nothing and that load a component (route modules never ship, #1686), so a
 * divergence in ANY of the projection's moving parts (the tag sort,
 * the evidence pick, the path relativization, the summary counts) shows up as a
 * concrete row mismatch rather than a vague count difference. Run from the repo
 * root so `@webjsdev/server` resolves.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { analyzeAppElision } from '@webjsdev/server';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const dir = mkdtempSync(join(tmpdir(), 'webjs-elision-x-'));

const write = (rel, src) => {
  const abs = join(dir, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, src);
};

try {
  write('package.json', JSON.stringify({ name: 'elision-fixture', type: 'module' }));
  // Display-only: static markup, no events, no props, no hooks, light DOM.
  write('components/badge.js', `
import { WebComponent, html } from '@webjsdev/core';
export class Badge extends WebComponent {
  render() { return html\`<span>verified</span>\`; }
}
Badge.register('my-badge');
`);
  // Interactive: an @event binding is the plainest ship signal there is.
  write('components/counter.js', `
import { WebComponent, html } from '@webjsdev/core';
export class Counter extends WebComponent {
  render() { return html\`<button @click=\${() => {}}>+</button>\`; }
}
Counter.register('my-counter');
`);
  // Loads nothing: its only component is elided.
  write('app/about/page.js', "import { html } from '@webjsdev/core';\nimport '../../components/badge.js';\nexport default () => html`<my-badge></my-badge>`;");
  // Loads the counter in its place.
  write('app/page.js', "import { html } from '@webjsdev/core';\nimport '../components/counter.js';\nexport default () => html`<my-counter></my-counter>`;");
  // The STRIPPER seam: a parenthesised type annotation is call-shaped, so a
  // runtime whose stripper left it behind would read this util as running code
  // at module scope and ship the display-only board through its closure (#1423).
  write('modules/game/utils/game.ts', `
export type Cell = 'X' | 'O' | null;
export const LINES: readonly (readonly [number, number, number])[] = [[0, 1, 2], [3, 4, 5]];
`);
  write('components/board.ts', `
import { WebComponent, html } from '@webjsdev/core';
import { LINES } from '../modules/game/utils/game.ts';
export class Board extends WebComponent {
  render() { return html\`<p>\${LINES.length}</p>\`; }
}
Board.register('my-board');
`);
  write('app/typed/page.ts', "import { html } from '@webjsdev/core';\nimport '../../components/board.ts';\nexport default () => html`<my-board></my-board>`;");

  // A browser global's NAME inside a string in a template hole is data, not a
  // reference (the kit's `'lucide lucide-app-window'` icon class, #1666), so
  // the TypeScript icon helper does not ship the display-only component using it.
  write('lib/icons.ts', `
import { html } from '@webjsdev/core';
export function AppWindow(cls: string = '') {
  return html\`<svg class=\${'lucide lucide-app-window' + (cls ? ' ' + cls : '')}></svg>\`;
}
`);
  write('components/icon-row.ts', `
import { WebComponent, html } from '@webjsdev/core';
import { AppWindow } from '../lib/icons.ts';
export class IconRow extends WebComponent {
  render() { return html\`<p>\${AppWindow()}</p>\`; }
}
IconRow.register('icon-row');
`);
  write('app/icons/page.ts', "import { html } from '@webjsdev/core';\nimport '../../components/icon-row.ts';\nexport default () => html`<icon-row></icon-row>`;");
  // The same global as real code inside a hole is a reference, so the
  // component importing it ships through its closure.
  write('lib/title.js', "import { html } from '@webjsdev/core';\nexport const Title = () => html`<p>${document.title}</p>`;\n");
  write('components/titled.js', `
import { WebComponent, html } from '@webjsdev/core';
import { Title } from '../lib/title.js';
export class Titled extends WebComponent {
  render() { return html\`\${Title()}\`; }
}
Titled.register('my-titled');
`);
  write('app/titled/page.js', "import { html } from '@webjsdev/core';\nimport '../../components/titled.js';\nexport default () => html`<my-titled></my-titled>`;");

  const r = await analyzeAppElision(dir);

  assert.equal(r.analysed, true, 'the fixture app must be analysable');
  assert.equal(r.skipped, null);
  assert.equal(r.elide, true);

  // Component rows, exact.
  assert.deepEqual(
    r.components.map((c) => [c.file, c.tags.join(','), c.verdict, c.evidence]),
    [
      ['components/badge.js', 'my-badge', 'elided', null],
      ['components/board.ts', 'my-board', 'elided', null],
      ['components/counter.js', 'my-counter', 'shipped', 'own'],
      ['components/icon-row.ts', 'icon-row', 'elided', null],
      ['components/titled.js', 'my-titled', 'shipped', 'closure'],
    ],
    'both the verdicts and their order must match across runtimes',
  );
  assert.match(r.components[2].reason, /@event binding/, 'the ship reason is the analyser\'s own words');
  assert.equal(r.components[0].reason, null, 'an elided component reports no reason');

  // Route-module rows, exact.
  assert.deepEqual(
    r.routeModules.map((m) => [m.file, m.kind, m.emits.join(','), m.hints.length]),
    [
      ['app/about/page.js', 'page', '', 0],
      ['app/icons/page.ts', 'page', '', 0],
      ['app/page.js', 'page', 'components/counter.js', 0],
      ['app/titled/page.js', 'page', 'components/titled.js', 0],
      ['app/typed/page.ts', 'page', '', 0],
    ],
  );

  assert.deepEqual(r.orphans, []);
  assert.deepEqual(r.summary, {
    components: 5, elided: 3, shipped: 2,
    routeModules: 5, zeroJs: 3, carriers: 2,
    orphans: 0,
  });

  // Two consumers print this object verbatim, so it must survive a JSON
  // round-trip identically on both runtimes.
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r, 'the report is JSON-serializable');

  console.log(`OK  webjs elision verdict is identical on ${runtime}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
