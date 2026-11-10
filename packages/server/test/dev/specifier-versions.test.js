/**
 * Browser module versions for `webjs dev` (#1689): which files a rebuild bumps,
 * how a served module's import specifiers carry the bump, and the handler
 * wiring that serves an importer of an edited module with `?t=<n>`.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createBrowserVersions, shippedImporters, versionImportSpecifiers } from '../../src/dev/specifier-versions.js';
import { importSpecifierRanges } from '../../src/module-graph.js';
import { createRequestHandler } from '../../src/dev.js';

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-specver-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

const APP = {
  'package.json': JSON.stringify({ name: 'x', type: 'module', imports: { '#*': './*' } }),
  'components/a.ts': 'export const a = 1;\n',
  'components/b.ts': 'export const b = 1;\n',
  'components/c.ts': 'export const c = 1;\n',
  'lib/util.ts': 'export const u = 1;\n',
};

test('versionImportSpecifiers rewrites static, export-from, multi-line and dynamic imports', () => {
  const appDir = makeApp(APP);
  const importer = join(appDir, 'components/x.ts');
  const versions = new Map([[join(appDir, 'components/a.ts'), 3], [join(appDir, 'components/b.ts'), 4], [join(appDir, 'lib/util.ts'), 5]]);
  const versionOf = (f) => versions.get(f) || 0;
  const src = [
    `import { a } from './a.ts';`,
    `export {`,
    `  b,`,
    `} from './b.ts';`,
    `import { u } from '#lib/util.ts';`,
    `const lazy = () => import('./a.ts');`,
    `import './c.ts';`,
  ].join('\n');
  const out = versionImportSpecifiers(src, importer, appDir, versionOf);
  assert.match(out, /from '\.\/a\.ts\?t=3';/);
  assert.match(out, /\} from '\.\/b\.ts\?t=4';/);
  assert.match(out, /from '#lib\/util\.ts\?t=5';/);
  assert.match(out, /import\('\.\/a\.ts\?t=3'\)/);
  assert.match(out, /import '\.\/c\.ts';/, 'an unbumped file keeps its bare URL');
});

test('versionImportSpecifiers leaves type-only, quoted, commented and bare specifiers alone', () => {
  const appDir = makeApp(APP);
  const importer = join(appDir, 'components/x.ts');
  const versionOf = () => 7;
  const src = [
    `import type { A } from './a.ts';`,
    `export type { B } from './b.ts';`,
    `const s = "import x from './a.ts'";`,
    `const t = html\`<pre>import y from './b.ts'</pre>\`;`,
    `// import z from './c.ts'`,
    `import { html } from '@webjsdev/core';`,
  ].join('\n');
  assert.equal(versionImportSpecifiers(src, importer, appDir, versionOf), src);
});

test('versionImportSpecifiers appends &t= after an existing query', () => {
  const appDir = makeApp({ ...APP, 'components/q.ts?raw': '' });
  const importer = join(appDir, 'components/x.ts');
  const out = versionImportSpecifiers(`import q from './q.ts?raw';`, importer, appDir, () => 2);
  assert.equal(out, `import q from './q.ts?raw&t=2';`);
});

test('versionImportSpecifiers returns the identical string at version 0 (counterfactual)', () => {
  const appDir = makeApp(APP);
  const src = `import { a } from './a.ts';\nimport('./b.ts');\n`;
  const out = versionImportSpecifiers(src, join(appDir, 'components/x.ts'), appDir, () => 0);
  assert.equal(out, src);
});

test('importSpecifierRanges positions point at the raw specifier text', () => {
  const src = `import a from './a.ts';\nexport * from "./b.ts";\nawait import('./c.ts');\n`;
  const ranges = importSpecifierRanges(src);
  assert.deepEqual(ranges.map((r) => [r.spec, r.dynamic]), [['./a.ts', false], ['./b.ts', false], ['./c.ts', true]]);
  for (const r of ranges) assert.equal(src.slice(r.start, r.end), r.spec);
});

test('bump reaches transitive importers inside shipped only, one number per bump', () => {
  const graph = new Map([
    ['/app/page.ts', new Set(['/app/comp.ts'])],
    ['/app/comp.ts', new Set(['/app/util.ts'])],
    ['/app/other.ts', new Set(['/app/util.ts'])],
    ['/app/server.ts', new Set(['/app/util.ts'])],
  ]);
  const shipped = new Set(['/app/page.ts', '/app/comp.ts', '/app/util.ts', '/app/other.ts']);
  const v = createBrowserVersions();
  const importers = shippedImporters(graph, shipped);
  assert.deepEqual([...importers.get('/app/util.ts')].sort(), ['/app/comp.ts', '/app/other.ts'], 'an unshipped importer is left out');
  const moved = v.bump(['/app/util.ts'], importers, shipped);
  assert.deepEqual([...moved].sort(), ['/app/comp.ts', '/app/other.ts', '/app/page.ts', '/app/util.ts']);
  assert.equal(v.versionOf('/app/util.ts'), 1);
  assert.equal(v.versionOf('/app/page.ts'), 1);
  assert.equal(v.versionOf('/app/server.ts'), 0, 'a module outside shipped is never versioned');
  v.bump(['/app/comp.ts'], importers, shipped);
  assert.equal(v.versionOf('/app/comp.ts'), 2);
  assert.equal(v.versionOf('/app/util.ts'), 1, 'a file below the edit keeps its version');
  assert.equal(v.bump(['/app/server.ts'], importers, shipped).size, 0, 'an unshipped edit bumps nothing');
  assert.equal(v.bump(['/app/util.ts'], null, shipped).size, 0, 'no graph yet bumps nothing');
});

test('handler serves an importer of an edited shipped module with ?t=', async () => {
  const appDir = makeApp({
    'package.json': JSON.stringify({ name: 'x', type: 'module' }),
    'app/page.ts': `import '../components/counter.ts';\nexport default () => 'ok';\n`,
    'components/counter.ts': [
      `import { WebComponent, html } from '@webjsdev/core';`,
      `import { label } from './label.ts';`,
      `class XCounter extends WebComponent() { render() { return html\`<button @click=\${() => 1}>\${label}</button>\`; } }`,
      `XCounter.register('x-counter');`,
    ].join('\n'),
    'components/label.ts': `export const label = 'one';\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const first = await (await app.handle(new Request('http://x/components/counter.ts'))).text();
  assert.match(first, /from '\.\/label\.ts';/, 'before any edit the import is bare');
  const label = join(appDir, 'components/label.ts');
  writeFileSync(label, `export const label = 'two';\n`);
  await app.rebuild({ v: 'reload', by: 'components/label.ts', why: 'ships-to-browser' }, { changed: [label] });
  const second = await (await app.handle(new Request('http://x/components/counter.ts'))).text();
  assert.match(second, /from '\.\/label\.ts\?t=1';/, 'after the edit the import is versioned');
  const helper = await app.handle(new Request('http://x/components/label.ts?t=1'));
  assert.equal(helper.status, 200, 'the versioned URL is servable');
  assert.match(await helper.text(), /'two'/);
});

// Review of #1689: a fresh document named an edited module by its bare url in
// the boot script and the modulepreload hints, while every served importer
// said `?t=<n>`, so the page loaded it twice (two instances, two evaluations).
// Every reference to one module in a document must agree.
test('after an edit the boot script and preload hints name a bumped module with its ?t=', async () => {
  const appDir = makeApp({
    'package.json': JSON.stringify({ name: 'x', type: 'module' }),
    'app/page.ts': [
      `import { html } from '@webjsdev/core';`,
      `import '../components/counter.ts';`,
      `export default () => html\`<x-counter></x-counter>\`;`,
    ].join('\n'),
    'components/counter.ts': [
      `import { WebComponent, html } from '@webjsdev/core';`,
      `class XCounter extends WebComponent() { render() { return html\`<button @click=\${() => 1}>c</button>\`; } }`,
      `XCounter.register('x-counter');`,
    ].join('\n'),
  });
  // `@webjsdev/core` resolves through the repo's node_modules during SSR.
  symlinkSync(join(process.cwd(), 'node_modules'), join(appDir, 'node_modules'), 'dir');
  const app = await createRequestHandler({ appDir, dev: true });
  const before = await (await app.handle(new Request('http://x/'))).text();
  assert.match(before, /import "\/components\/counter\.ts";/, 'before any edit the boot import is bare');
  const counter = join(appDir, 'components/counter.ts');
  writeFileSync(counter, readFileSync(counter, 'utf8').replace('>c<', '>d<'));
  await app.rebuild({ v: 'reload', by: 'components/counter.ts', why: 'ships-to-browser' }, { changed: [counter] });
  const after = await (await app.handle(new Request('http://x/'))).text();
  assert.match(after, /import "\/components\/counter\.ts\?t=1";/, 'the boot import carries the version');
  assert.doesNotMatch(after, /"\/components\/counter\.ts"/, 'no bare reference to the module is left');
  assert.match(after, /<link rel="modulepreload" href="\/components\/counter\.ts\?t=1"/, 'and so does its preload hint');
});
