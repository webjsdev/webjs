/**
 * #899: the app-source deploy SIGNAL (`X-Webjs-Src` / `data-webjs-src`).
 *
 * Covers the two pure pieces the dev.js analysis composes into the signal:
 *  - `seenFilesFor(graph)`: the COMPLETE app-source set, including server-only
 *    `.server.ts` files that the browser-bound set omits (the load-bearing delta
 *    that lets the signal catch an SSR-only deploy).
 *  - `setAppSourceId` / `appSourceId`: deterministic digest of a raw input,
 *    distinct from the build id.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildModuleGraph, seenFilesFor } from '../../src/module-graph.js';

test('seenFilesFor includes ALL app source, including a server-only .server.ts a browser entry never imports', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-seen-'));
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'lib'), { recursive: true });
  // A browser-bound page and a plain util it imports.
  writeFileSync(join(dir, 'app', 'page.ts'), "import { x } from '../lib/util.ts';\nexport default () => x;\n");
  writeFileSync(join(dir, 'lib', 'util.ts'), "export const x = 1;\n");
  // A server-only file that NO browser entry imports (a leaf, no imports).
  writeFileSync(join(dir, 'lib', 'secret.server.ts'), "export const secret = 'ssr-only';\n");

  const graph = await buildModuleGraph(dir);
  const seen = [...seenFilesFor(graph)].map((p) => p.slice(dir.length));

  assert.ok(seen.some((p) => p.endsWith('/app/page.ts')), 'the page is in the source set');
  assert.ok(seen.some((p) => p.endsWith('/lib/util.ts')), 'an imported util is in the source set');
  assert.ok(seen.some((p) => p.endsWith('/lib/secret.server.ts')),
    'a server-only .server.ts (no browser entry imports it) IS in the source set (the #899 delta)');
});

test('seenFilesFor excludes node_modules / .webjs / public / dotfiles (no churn from generated files)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-seen-x-'));
  for (const d of ['app', 'node_modules/pkg', '.webjs', 'public', '.hidden']) mkdirSync(join(dir, d), { recursive: true });
  writeFileSync(join(dir, 'app', 'page.ts'), 'export default () => 1;\n');
  writeFileSync(join(dir, 'node_modules', 'pkg', 'index.js'), 'module.exports = 1;\n');
  writeFileSync(join(dir, '.webjs', 'routes.d.ts'), 'export {};\n');
  writeFileSync(join(dir, 'public', 'sw.js'), 'self.x = 1;\n');
  writeFileSync(join(dir, '.hidden', 'z.ts'), 'export const z = 1;\n');

  const seen = [...seenFilesFor(await buildModuleGraph(dir))].map((p) => p.slice(dir.length));
  assert.ok(seen.some((p) => p.endsWith('/app/page.ts')), 'app source is included');
  assert.ok(!seen.some((p) => p.includes('node_modules')), 'node_modules excluded');
  assert.ok(!seen.some((p) => p.includes('.webjs')), '.webjs excluded');
  assert.ok(!seen.some((p) => p.includes('/public/')), 'public excluded');
  assert.ok(!seen.some((p) => p.includes('.hidden')), 'dotfiles excluded');
});

test('setAppSourceId / appSourceId: deterministic, distinct from the build id, empty clears', async () => {
  const m = await import('../../src/importmap.js?appsrc');
  m.setAppSourceId('a:1\nb:2');
  const id1 = m.appSourceId();
  assert.match(id1, /^[0-9a-f]{16}$/, 'a short hex digest');
  m.setAppSourceId('a:1\nb:2');
  assert.equal(m.appSourceId(), id1, 'same input yields the same id (deterministic)');
  m.setAppSourceId('a:1\nb:3'); // a byte changed
  assert.notEqual(m.appSourceId(), id1, 'a changed source input changes the id');
  m.setAppSourceId('');
  assert.equal(m.appSourceId(), '', 'empty input clears the id (dev / warmup => client never acts)');
});
