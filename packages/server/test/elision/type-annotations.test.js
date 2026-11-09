/**
 * A TypeScript TYPE ANNOTATION must never be read as runtime behaviour by the
 * elision analyser (#1423).
 *
 * The scans in `component-elision.js` are lexical heuristics over source that
 * has had comments and literals redacted, and type syntax was not on that list.
 * `readonly (readonly [number, number, number])[]` is an identifier immediately
 * followed by `(`, so `hasModuleScopeSideEffect`'s top-level-call matcher read
 * it as a call and classified a module of pure typed data as running code at
 * module scope. The cost was invisible: no error, no warning, identical
 * behaviour, just any component importing or carrying such an annotation
 * forced to ship along with the display-only children it renders. (Route
 * modules never ship since #1686, so the component closure is where the
 * verdict lives now.)
 *
 * These tests drive the REAL pipeline over a REAL `.ts` app on disk, because
 * that is the only level the fix lives at: the analyser erases types before it
 * scans, so a unit call on a source string would prove nothing about the path
 * that decides what the browser downloads. The first two are the issue's
 * acceptance criteria, and they are the discriminating ones: reverting the
 * erasure reds them (proven at 3b3cb6a5 on the route-module form). The rest are the
 * counterweight that keeps them honest, since erasing too much would satisfy
 * the first three by simply never detecting anything, and they stay green in
 * both directions on purpose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildModuleGraph } from '../../src/module-graph.js';
import { scanComponents } from '../../src/component-scanner.js';
import { analyzeElision } from '../../src/component-elision.js';

/** The tic-tac-toe declaration from the report, verbatim in shape. */
const LINES_TS = `
export type Cell = 'X' | 'O' | null;
export interface Board { cells: Cell[]; }
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
export function winner(cells: Cell[]): Cell {
  for (const [a, b, c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[b] === cells[c]) return cells[a];
  }
  return null;
}
`;

/**
 * Write a throwaway TypeScript app, run the real pipeline over it, and return
 * the verdict plus the component the assertions key on: a display-only badge
 * that imports the util, rendered by a page. The util is the badge's whole
 * client closure, so a wrong verdict on it shows up directly as the badge
 * shipping.
 *
 * @param {{ utilSrc: string }} spec
 */
async function analyseApp(spec) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-type-annotations-'));
  try {
    await mkdir(join(dir, 'app'), { recursive: true });
    await mkdir(join(dir, 'components'), { recursive: true });
    await mkdir(join(dir, 'modules/game/utils'), { recursive: true });
    await writeFile(join(dir, 'modules/game/utils/game.ts'), spec.utilSrc);
    await writeFile(join(dir, 'components/badge.ts'), `
import { WebComponent, html } from '@webjsdev/core';
import { LINES } from '../modules/game/utils/game.ts';
export class Badge extends WebComponent {
  render() { return html\`<span class="badge">\${LINES.length}</span>\`; }
}
Badge.register('my-badge');
`);
    await writeFile(join(dir, 'app/page.ts'), `
import { html } from '@webjsdev/core';
import '../components/badge.ts';
export default () => html\`<my-badge></my-badge>\`;
`);

    const graph = await buildModuleGraph(dir);
    const components = await scanComponents(dir);
    const badgeFile = join(dir, 'components/badge.ts');
    const verdict = await analyzeElision(components, graph, (f) => readFile(f, 'utf8'), dir);
    return { verdict, badgeFile };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('a parenthesised type annotation does not mark its module as running code at module scope', async () => {
  const { verdict, badgeFile } = await analyseApp({ utilSrc: LINES_TS });
  const row = verdict.componentVerdicts.get(badgeFile);
  assert.ok(verdict.elidableComponents.has(badgeFile),
    `the badge must not ship; it did (${row && row.evidence}: ${row && row.reason})`);
});

test('a component whose only module-scope construct is a parenthesised annotation is elided', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-type-annotations-own-'));
  try {
    await mkdir(join(dir, 'components'), { recursive: true });
    await writeFile(join(dir, 'components/badge.ts'), `
import { WebComponent, html } from '@webjsdev/core';
const LINES: readonly (readonly [number, number, number])[] = [[0, 1, 2]];
export class Badge extends WebComponent {
  render() { return html\`<span>\${LINES.length}</span>\`; }
}
Badge.register('my-badge');
`);
    const badgeFile = join(dir, 'components/badge.ts');
    const verdict = await analyzeElision(await scanComponents(dir), await buildModuleGraph(dir),
      (f) => readFile(f, 'utf8'), dir);
    assert.ok(verdict.elidableComponents.has(badgeFile),
      'the badge renders static markup and the annotation is not a signal');
    assert.equal(verdict.componentVerdicts.get(badgeFile).shipped, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the pin is the ANNOTATION, not the data: an `as const` spelling was already elided', async () => {
  // The report's own workaround, kept as a control. Both spellings describe the
  // same runtime value, so a fix that only moved one of them would be reading
  // something other than the annotation.
  const asConst = LINES_TS.replace(
    /export const LINES: readonly \(readonly \[number, number, number\]\)\[\] = \[/,
    'export const LINES = [',
  ).replace(/\n\];/, '\n] as const;');
  assert.notEqual(asConst, LINES_TS, 'the control rewrite must actually apply');
  const { verdict, badgeFile } = await analyseApp({ utilSrc: asConst });
  assert.ok(verdict.elidableComponents.has(badgeFile));
});

test('real module-scope work in a .ts module still ships the component', async () => {
  // The conservative direction, asserted per construct. Type erasure must not
  // become a way for genuine client work to slip past: each of these is real
  // code in the file the browser would run.
  const cases = {
    'a top-level call': 'export const boot = init();\nfunction init() { return 1; }',
    'a non-data new': 'export const ws = new WebSocket("wss://x");',
    'a dynamic import': 'export const mod = import("./other.ts");',
    'a top-level await': 'export const v = await Promise.resolve(1);',
    'a browser global': 'export const w = window.innerWidth;',
  };
  for (const [label, stmt] of Object.entries(cases)) {
    const { verdict, badgeFile } = await analyseApp({
      utilSrc: `export const LINES: readonly (readonly [number, number, number])[] = [[0, 1, 2]];\n${stmt}\n`,
    });
    assert.ok(!verdict.elidableComponents.has(badgeFile), `${label} must keep the component shipping`);
  }
});

test('a genuine top-level call named like a type keyword still ships', async () => {
  // `readonly` is a legal function name in JavaScript, so exempting the bare
  // identifier would have been a false NEGATIVE, the one direction this
  // analyser may not take. Erasing types instead leaves the real call visible.
  const { verdict, badgeFile } = await analyseApp({
    utilSrc: 'function readonly(x: number) { return x; }\nexport const LINES = readonly(1);\n',
  });
  assert.ok(!verdict.elidableComponents.has(badgeFile),
    'a call to a function named `readonly` is a call');
});

test('a .tsx component is erased too, because it reaches the analysis by a wider filter', async () => {
  // `allFiles` is seeded from the COMPONENT set before the module graph, and
  // `scanComponents` admits `/\.m?[jt]sx?$/`, which is wider than both the
  // graph walker's file filter and the router's. So a `.tsx` component lands
  // in the analysis whatever those two admit, and an erasure set narrowed to
  // the SERVABLE extensions would leave exactly this file class un-erased,
  // with the #1423 verdict intact and nothing else covering it.
  const dir = await mkdtemp(join(tmpdir(), 'webjs-type-annotations-tsx-'));
  try {
    await mkdir(join(dir, 'components'), { recursive: true });
    await writeFile(join(dir, 'components/badge.tsx'), `
import { WebComponent, html } from '@webjsdev/core';
export const LINES: readonly (readonly [number, number, number])[] = [[0, 1, 2]];
export class Badge extends WebComponent {
  render() { return html\`<span>\${LINES.length}</span>\`; }
}
Badge.register('my-badge');
`);
    const graph = await buildModuleGraph(dir);
    const components = await scanComponents(dir);
    const badgeFile = join(dir, 'components/badge.tsx');
    assert.ok(components.some((c) => c.file === badgeFile),
      'precondition: the component scanner admits a .tsx file');
    const verdict = await analyzeElision(components, graph, (f) => readFile(f, 'utf8'), dir);
    assert.ok(verdict.elidableComponents.has(badgeFile),
      'the annotation is not a signal in a .tsx file either');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the strip memo is validated against the source, so an edit is re-erased', async () => {
  // The memo is keyed by PATH and holds the source it was derived from, because
  // this runs on every dev rebuild and stripping costs roughly 50x the read it
  // sits beside. Keying by path alone would serve a stale strip after an edit,
  // and mtime would miss a same-mtime rewrite, so the check is on content. Same
  // path, two different sources, two different verdicts is what proves it.
  const dir = await mkdtemp(join(tmpdir(), 'webjs-type-annotations-memo-'));
  try {
    await mkdir(join(dir, 'components'), { recursive: true });
    await mkdir(join(dir, 'modules/game/utils'), { recursive: true });
    const util = join(dir, 'modules/game/utils/game.ts');
    const badgeFile = join(dir, 'components/badge.ts');
    await writeFile(badgeFile, `
import { WebComponent, html } from '@webjsdev/core';
import { LINES } from '../modules/game/utils/game.ts';
export class Badge extends WebComponent {
  render() { return html\`<span>\${LINES.length}</span>\`; }
}
Badge.register('my-badge');
`);
    const analyse = async () => {
      const graph = await buildModuleGraph(dir);
      return analyzeElision(await scanComponents(dir), graph, (f) => readFile(f, 'utf8'), dir);
    };

    await writeFile(util, 'export const LINES: readonly (readonly [number, number, number])[] = [[0, 1, 2]];\n');
    assert.ok((await analyse()).elidableComponents.has(badgeFile), 'pure typed data keeps the badge elided');

    // Same path, new content that DOES do module-scope work. A memo keyed only
    // by path would hand back the erased first version and elide this too.
    await writeFile(util, 'export const LINES = init();\nfunction init() { return [[0, 1, 2]]; }\n');
    assert.ok(!(await analyse()).elidableComponents.has(badgeFile),
      'the edit must be re-read and re-scanned, not served from the memo');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a .ts module with non-erasable syntax falls back to scanning it as authored', async () => {
  // The stripper throws on non-erasable TypeScript (invariant 10 forbids it and
  // `webjs check` catches it at edit time, so this is a broken app rather than a
  // supported one). The analyser must not throw with it: it keeps the source as
  // authored, which is the pre-#1423 behaviour and therefore the conservative
  // direction. The `init()` call is the proof it still SCANNED rather than
  // silently gave up and called the module clean.
  const { verdict, badgeFile } = await analyseApp({
    utilSrc: 'export enum E { A, B }\nexport const LINES = init();\nfunction init() { return []; }\n',
  });
  assert.ok(!verdict.elidableComponents.has(badgeFile),
    'an unstrippable module is still scanned, and its real call still ships the component');
});
