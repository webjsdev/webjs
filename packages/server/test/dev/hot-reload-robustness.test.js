/**
 * The pieces of the `bun --hot` robustness fix (#1575) that hold without a
 * running server. The end-to-end proof (a real `webjs dev` taking agent-style
 * edits) is `test/bun/dev-reload-stress.mjs`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { hotRerunCapable, needsHotReset, hotSentinelPath, hotHostKey, getHotHost, setHotHost, deleteHotHost } from '../../src/dev/hot-host.js';
import { resolveAppAlias } from '../../src/dev/bun-alias-resolve.js';
import { appSourceFilter } from '../../src/dev/bun-app-source.js';
import { buildModuleGraph } from '../../src/module-graph.js';
import { devImport } from '../../src/dev-import.js';

function tempApp() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-hot-robust-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module', imports: { '#*': './*' } }));
  return dir;
}

test('only Bun under --hot re-runs the entry', () => {
  assert.equal(hotRerunCapable({ isBun: true, execArgv: ['--hot'] }), true);
  assert.equal(hotRerunCapable({ isBun: true, execArgv: [] }), false);
  assert.equal(hotRerunCapable({ isBun: false, execArgv: ['--hot'] }), false);
});

test('the hot host lives on globalThis, so a re-run (a fresh module copy) finds it', async () => {
  const key = hotHostKey('/srv/app', 4321);
  const host = { version: 'x', rerun: async () => 'rerun', poke: () => {} };
  setHotHost(key, host);
  try {
    // A query makes a second, independent instance of the module: exactly what
    // a `bun --hot` re-run evaluates.
    const fresh = await import(`../../src/dev/hot-host.js?copy=${Date.now()}`);
    assert.equal(fresh.getHotHost(key), host);
  } finally {
    deleteHotHost(key);
  }
  assert.equal(getHotHost(key), undefined);
});

test('which edits need a registry reset on Bun', () => {
  const routeOnly = (p) => p === 'app/page.ts';
  // An imported module, a server module, a new module: reset.
  for (const p of ['components/x.js', 'modules/a/actions/b.server.ts', 'lib/y.mts']) assert.equal(needsHotReset(p, routeOnly), true, p);
  // A module only the router loads is re-imported by content: no reset.
  assert.equal(needsHotReset('app/page.ts', routeOnly), false);
  // `sed -i` renames an extensionless temp file over the module: the event may
  // name only the temp file, so an unplaceable path resets.
  assert.equal(needsHotReset('lib/sedAb12Cd', routeOnly), true);
  for (const p of ['public/app.css', 'content/post.md', 'node_modules/pkg/index.js']) assert.equal(needsHotReset(p, routeOnly), false, p);
});

test('the sentinel lives outside the app, so neither the app-source plugin nor the watcher sees it', () => {
  const p = hotSentinelPath('/srv/app');
  assert.ok(!p.startsWith('/srv/app/'), p);
  assert.ok(p.endsWith('.mjs'));
  assert.equal(hotSentinelPath('/srv/app'), p, 'stable for one app in one process');
  assert.notEqual(hotSentinelPath('/srv/other'), p);
});

test('the app-source filter takes app modules and leaves node_modules and *.server.* alone', () => {
  const f = appSourceFilter('/srv/app');
  for (const p of ['/srv/app/app/page.ts', '/srv/app/components/c.js?t=abc', '/srv/app/lib/x.mts']) assert.ok(f.test(p), p);
  for (const p of ['/srv/app/node_modules/x/i.js', '/srv/app/modules/a.server.ts', '/srv/other/app/page.ts', '/srv/app/app/style.css']) assert.ok(!f.test(p), p);
});

test('a # alias resolves to the file on disk, only for an importer inside the app', () => {
  const dir = tempApp();
  try {
    mkdirSync(join(dir, 'modules/u'), { recursive: true });
    const importer = join(dir, 'modules/a.server.ts');
    assert.equal(resolveAppAlias('#modules/u/new.ts', importer + '?t=1', dir), null, 'not there yet');
    writeFileSync(join(dir, 'modules/u/new.ts'), 'export const v = 1;\n');
    assert.equal(resolveAppAlias('#modules/u/new.ts', importer + '?t=1', dir), join(dir, 'modules/u/new.ts'));
    assert.equal(resolveAppAlias('#modules/u/new.ts', join(dir, 'node_modules/p/i.js'), dir), null, 'a package keeps its own map');
    assert.equal(resolveAppAlias('./u/new.ts', importer, dir), null, 'not an alias');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an importer written before its import target gains the edge once the target exists', async () => {
  const dir = tempApp();
  try {
    mkdirSync(join(dir, 'app'), { recursive: true });
    mkdirSync(join(dir, 'components'), { recursive: true });
    const page = join(dir, 'app/page.ts');
    // Two resolutions that depend on what exists: an extensionless specifier,
    // and a `.js` specifier naming a `.ts` file (the TypeScript convention).
    writeFileSync(page, "import './local';\nimport '#components/widget.js';\nexport default () => '';\n");
    let g = await buildModuleGraph(dir);
    assert.equal(g.get(page)?.has(join(dir, 'app/local.ts')) ?? false, false);
    // The page is untouched, so its parse comes from the cache. A cached
    // RESOLUTION kept the old guess forever; a cached specifier re-resolves.
    writeFileSync(join(dir, 'app/local.ts'), 'export {};\n');
    writeFileSync(join(dir, 'components/widget.ts'), 'export {};\n');
    g = await buildModuleGraph(dir);
    assert.equal(g.get(page)?.has(join(dir, 'app/local.ts')), true);
    assert.equal(g.get(page)?.has(join(dir, 'components/widget.ts')), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('devImport never re-imports a specifier that failed, and recovers when the file is fixed', async () => {
  const dir = tempApp();
  try {
    const f = join(dir, 'm.mjs');
    writeFileSync(f, 'export default (((;\n');
    await assert.rejects(devImport(f, true));
    // Same bytes: a fresh key, so it fails again rather than reusing (and on
    // Bun under --hot, hanging on) the failed module record.
    await assert.rejects(devImport(f, true));
    writeFileSync(f, 'export default "fixed";\n');
    assert.equal((await devImport(f, true)).default, 'fixed');
    // Unchanged content reuses the loaded module (no new instance per call).
    assert.equal(await devImport(f, true), await devImport(f, true));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
