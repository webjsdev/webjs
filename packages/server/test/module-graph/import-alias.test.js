import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { expandImportAlias, appImportsMap, resolveImport, buildModuleGraph } from '../../src/module-graph.js';
import { importAliasBrowserEntries } from '../../src/importmap.js';

/**
 * `#` path-alias imports (#555). The alias is Node's native `package.json
 * "imports"` subpath map; webjs expands it inside `resolveImport` so the module
 * graph, auth gate, elision, and the server-import boundary all see the REAL
 * path (an alias must not launder a `.server.ts` past those checks), and the
 * browser importmap scope is derived from the SAME map so SSR and the browser
 * agree.
 *
 * The scaffold ships the single catch-all `"#*": "./*"`: one key, zero
 * maintenance (a new top-level folder is aliased with no config change), and
 * `#*` resolves natively on Node AND Bun. A `#/`-prefixed key is avoided
 * because Bun's resolver rejects it. The browser side expands the catch-all
 * into one prefix scope per top-level dir (a bare `#` cannot prefix-match an
 * importmap).
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

const CATCHALL = { '#*': './*' };
const PKG = (imports) => JSON.stringify({ name: 'x', type: 'module', imports }, null, 2);

test('appImportsMap reads the package.json "imports" block (null when absent)', async () => {
  const withBlock = await makeApp({ 'package.json': PKG(CATCHALL) });
  const without = await makeApp({ 'package.json': JSON.stringify({ name: 'y' }) });
  try {
    assert.deepEqual(appImportsMap(withBlock), CATCHALL);
    assert.equal(appImportsMap(without), null);
  } finally {
    await rm(withBlock, { recursive: true, force: true });
    await rm(without, { recursive: true, force: true });
  }
});

test('expandImportAlias expands the #* catch-all to the app-relative target', async () => {
  const dir = await makeApp({ 'package.json': PKG(CATCHALL) });
  try {
    assert.equal(expandImportAlias('#lib/db.server.ts', dir), './lib/db.server.ts');
    assert.equal(expandImportAlias('#components/button.ts', dir), './components/button.ts');
    // a brand-new folder is aliased by the catch-all with no config change
    assert.equal(expandImportAlias('#services/email.ts', dir), './services/email.ts');
    // bare npm specifier + plain relative are NOT aliases
    assert.equal(expandImportAlias('drizzle-orm', dir), null);
    assert.equal(expandImportAlias('../lib/x.ts', dir), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('expandImportAlias honors a non-default base (#* -> ./src/*), never hardcodes ./', async () => {
  const dir = await makeApp({ 'package.json': PKG({ '#*': './src/*' }) });
  try {
    assert.equal(expandImportAlias('#lib/db.server.ts', dir), './src/lib/db.server.ts');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('expandImportAlias is key-shape-agnostic (also handles per-dir + #/ keys)', async () => {
  const perdir = await makeApp({ 'package.json': PKG({ '#lib/*': './lib/*' }) });
  const slash = await makeApp({ 'package.json': PKG({ '#/*': './*' }) });
  try {
    assert.equal(expandImportAlias('#lib/db.server.ts', perdir), './lib/db.server.ts');
    // the resolver accepts a #/ key even though the scaffold avoids it (Bun)
    assert.equal(expandImportAlias('#/lib/db.server.ts', slash), './lib/db.server.ts');
  } finally {
    await rm(perdir, { recursive: true, force: true });
    await rm(slash, { recursive: true, force: true });
  }
});

test('resolveImport resolves a # alias to the real on-disk file', async () => {
  const dir = await makeApp({
    'package.json': PKG(CATCHALL),
    'lib/db.server.ts': 'export const db = {};\n',
    'app/page.ts': "import { db } from '#lib/db.server.ts';\nexport default () => db;\n",
  });
  try {
    const resolved = resolveImport('#lib/db.server.ts', join(dir, 'app/page.ts'), dir);
    assert.equal(resolved, join(dir, 'lib/db.server.ts'), 'alias resolves to the real path');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('buildModuleGraph follows a # alias edge (so preload/auth-gate see it)', async () => {
  const dir = await makeApp({
    'package.json': PKG(CATCHALL),
    'components/badge.ts': 'export const badge = 1;\n',
    'app/page.ts': "import { badge } from '#components/badge.ts';\nexport default () => badge;\n",
  });
  try {
    const graph = await buildModuleGraph(dir);
    const deps = graph.get(join(dir, 'app/page.ts'));
    assert.ok(deps, 'page has graph deps');
    assert.ok(deps.has(join(dir, 'components/badge.ts')), 'the # alias edge is in the graph');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('importAliasBrowserEntries expands the #* catch-all into a prefix scope per dir', () => {
  // The dir list is scanned by dev.js; the function stays pure.
  assert.deepEqual(
    importAliasBrowserEntries(CATCHALL, ['app', 'components', 'db', 'lib', 'modules']),
    { '#app/': '/app/', '#components/': '/components/', '#db/': '/db/', '#lib/': '/lib/', '#modules/': '/modules/' },
  );
  // non-default base folds into the URL
  assert.deepEqual(importAliasBrowserEntries({ '#*': './src/*' }, ['lib']), { '#lib/': '/src/lib/' });
  // a per-dir wildcard or exact key maps directly (no dir scan needed)
  assert.deepEqual(importAliasBrowserEntries({ '#lib/*': './lib/*' }), { '#lib/': '/lib/' });
  assert.deepEqual(importAliasBrowserEntries({ '#db': './db/index.ts' }), { '#db': '/db/index.ts' });
  // a conditional-export object target is not URL-mappable; skipped
  assert.deepEqual(importAliasBrowserEntries({ '#x': { node: './x.js' } }), {});
  assert.deepEqual(importAliasBrowserEntries(null), {});
});
