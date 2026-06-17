import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { expandImportAlias, appImportsMap, resolveImport, buildModuleGraph } from '../../src/module-graph.js';
import { importAliasBrowserEntries } from '../../src/importmap.js';

/**
 * `#/` path-alias imports (#555). The alias is Node's native `package.json
 * "imports"` subpath map; webjs expands it inside `resolveImport` so the module
 * graph, auth gate, elision, and the server-import boundary all see the REAL
 * path (an alias must not launder a `.server.ts` past those checks), and the
 * browser importmap scope is derived from the SAME map so SSR and the browser
 * agree.
 */

async function makeApp(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-import-alias-'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = join(dir, rel);
    await mkdir(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    await writeFile(abs, contents);
  }
  return dir;
}

const PKG = (imports) => JSON.stringify({ name: 'x', type: 'module', imports }, null, 2);

test('appImportsMap reads the package.json "imports" block (null when absent)', async () => {
  const withBlock = await makeApp({ 'package.json': PKG({ '#/*': './*' }) });
  const without = await makeApp({ 'package.json': JSON.stringify({ name: 'y' }) });
  try {
    assert.deepEqual(appImportsMap(withBlock), { '#/*': './*' });
    assert.equal(appImportsMap(without), null);
  } finally {
    await rm(withBlock, { recursive: true, force: true });
    await rm(without, { recursive: true, force: true });
  }
});

test('expandImportAlias expands a #/ wildcard to the app-relative target', async () => {
  const dir = await makeApp({ 'package.json': PKG({ '#/*': './*' }) });
  try {
    assert.equal(expandImportAlias('#/lib/db.server.ts', dir), './lib/db.server.ts');
    assert.equal(expandImportAlias('#/components/button.ts', dir), './components/button.ts');
    // bare npm specifier + plain relative are NOT aliases
    assert.equal(expandImportAlias('drizzle-orm', dir), null);
    assert.equal(expandImportAlias('../lib/x.ts', dir), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('expandImportAlias honors a non-default base (./src/*), never hardcodes ./', async () => {
  const dir = await makeApp({ 'package.json': PKG({ '#/*': './src/*' }) });
  try {
    assert.equal(expandImportAlias('#/lib/db.server.ts', dir), './src/lib/db.server.ts');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('resolveImport resolves a #/ alias to the real on-disk file', async () => {
  const dir = await makeApp({
    'package.json': PKG({ '#/*': './*' }),
    'lib/db.server.ts': 'export const db = {};\n',
    'app/page.ts': "import { db } from '#/lib/db.server.ts';\nexport default () => db;\n",
  });
  try {
    const resolved = resolveImport('#/lib/db.server.ts', join(dir, 'app/page.ts'), dir);
    assert.equal(resolved, join(dir, 'lib/db.server.ts'), 'alias resolves to the real path');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('buildModuleGraph follows a #/ alias edge (so preload/auth-gate see it)', async () => {
  const dir = await makeApp({
    'package.json': PKG({ '#/*': './*' }),
    'components/badge.ts': 'export const badge = 1;\n',
    'app/page.ts': "import { badge } from '#/components/badge.ts';\nexport default () => badge;\n",
  });
  try {
    const graph = await buildModuleGraph(dir);
    const deps = graph.get(join(dir, 'app/page.ts'));
    assert.ok(deps, 'page has graph deps');
    assert.ok(deps.has(join(dir, 'components/badge.ts')), 'the #/ alias edge is in the graph');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('importAliasBrowserEntries derives the browser scope from the same map', () => {
  assert.deepEqual(importAliasBrowserEntries({ '#/*': './*' }), { '#/': '/' });
  assert.deepEqual(importAliasBrowserEntries({ '#/*': './src/*' }), { '#/': '/src/' });
  assert.deepEqual(importAliasBrowserEntries({ '#db': './lib/db.server.ts' }), { '#db': '/lib/db.server.ts' });
  // a conditional-export object target is not URL-mappable; skipped
  assert.deepEqual(importAliasBrowserEntries({ '#x': { node: './x.js' } }), {});
  assert.deepEqual(importAliasBrowserEntries(null), {});
});
