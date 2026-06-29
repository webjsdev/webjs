import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  buildModuleGraph, reachableFromEntries, transitiveDeps, dynamicEdges,
} from '../../src/module-graph.js';

/**
 * A dynamic `import('./local.ts')` of an app module must be discovered by the
 * browser-bound graph (#751). The old regex scanner matched only static
 * `import`/`export ... from`, so a string-literal dynamic import was never
 * added to the servable set: the authorization gate failed closed and the
 * module 404'd at runtime. The fix tracks string-literal dynamic edges as a
 * SEPARATE class: the gate (`reachableFromEntries`) admits them, but the
 * preload walk (`transitiveDeps`) does NOT eagerly fetch them (a dynamic import
 * is lazy by author intent). The `.server.*` boundary is preserved, and a
 * computed `import(expr)` stays out (it cannot be captured).
 */

async function makeApp(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-dynimport-'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = join(dir, rel);
    await mkdir(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    await writeFile(abs, contents);
  }
  return dir;
}

test('a string-literal dynamic import is admitted to the gate (no 404)', async () => {
  const dir = await makeApp({
    'components/host.ts': `export class Host {
      async open() { const m = await import('./widget.ts'); return m; }
    }`,
    'components/widget.ts': `export const widget = 1;`,
  });
  const graph = await buildModuleGraph(dir);
  const host = join(dir, 'components/host.ts');
  const widget = join(dir, 'components/widget.ts');

  const servable = reachableFromEntries(graph, [host], dir);
  assert.ok(servable.has(widget), 'the dynamically-imported widget is servable');

  // It is tracked as a DYNAMIC edge, not a static one.
  const dyn = dynamicEdges(graph);
  assert.ok(dyn.get(host)?.has(widget), 'recorded as a dynamic edge');
  assert.ok(!graph.get(host)?.has(widget), 'not recorded as a static edge');
});

test('counterfactual: without dynamic tracking the module is NOT servable', async () => {
  // Prove the prior 404: a graph built ignoring dynamic edges (i.e. only the
  // static map) does not reach the widget, which is exactly the old behaviour.
  const dir = await makeApp({
    'components/host.ts': `export class Host {
      async open() { return import('./widget.ts'); }
    }`,
    'components/widget.ts': `export const widget = 1;`,
  });
  const graph = await buildModuleGraph(dir);
  const host = join(dir, 'components/host.ts');
  const widget = join(dir, 'components/widget.ts');
  // The static graph alone (the pre-#751 source) has no host->widget edge.
  assert.ok(!graph.get(host)?.has(widget), 'static graph never linked the dynamic import');
  // Strip the dynamic edges and the gate fails closed, the old 404 path.
  const staticOnly = new Map(graph); // a plain Map has no associated dynamic edges
  const servable = reachableFromEntries(staticOnly, [host], dir);
  assert.ok(!servable.has(widget), 'gate would 404 the dynamic target without #751');
});

test('a dynamically-imported module subtree is fully servable', async () => {
  const dir = await makeApp({
    'components/host.ts': `export const load = () => import('./lazy.ts');`,
    'components/lazy.ts': `import { dep } from './dep.ts'; export const lazy = dep;`,
    'components/dep.ts': `export const dep = 1;`,
  });
  const graph = await buildModuleGraph(dir);
  const host = join(dir, 'components/host.ts');
  const servable = reachableFromEntries(graph, [host], dir);
  assert.ok(servable.has(join(dir, 'components/lazy.ts')), 'lazy module servable');
  assert.ok(servable.has(join(dir, 'components/dep.ts')), 'its static dep servable too');
});

test('the .server.* boundary holds for a dynamic import', async () => {
  const dir = await makeApp({
    'components/host.ts': `export const load = () => import('./data.server.ts');`,
    'components/data.server.ts': `'use server';
      import { secret } from './secret.server.ts';
      export async function getData() { return secret; }`,
    'components/secret.server.ts': `export const secret = 42;`,
  });
  const graph = await buildModuleGraph(dir);
  const host = join(dir, 'components/host.ts');
  const servable = reachableFromEntries(graph, [host], dir);
  // The server file is admitted (served as a stub), but NOT traversed into.
  assert.ok(servable.has(join(dir, 'components/data.server.ts')), 'server file admitted (stub)');
  assert.ok(!servable.has(join(dir, 'components/secret.server.ts')), 'its server-only import stays out');
});

test('dynamic targets are NOT eagerly preloaded (lazy by intent)', async () => {
  const dir = await makeApp({
    'components/host.ts': `import { eager } from './eager.ts';
      export const load = () => import('./lazy.ts');`,
    'components/eager.ts': `export const eager = 1;`,
    'components/lazy.ts': `export const lazy = 1;`,
  });
  const graph = await buildModuleGraph(dir);
  const host = join(dir, 'components/host.ts');
  const preload = transitiveDeps(graph, [host], dir);
  assert.ok(preload.includes(join(dir, 'components/eager.ts')), 'a static import IS preloaded');
  assert.ok(!preload.includes(join(dir, 'components/lazy.ts')), 'a dynamic import is NOT preloaded');
});

test('a computed dynamic import is not captured (stays out)', async () => {
  const dir = await makeApp({
    'components/host.ts': `export const load = (name) => import('./pages/' + name + '.ts');`,
    'components/pages/a.ts': `export const a = 1;`,
  });
  const graph = await buildModuleGraph(dir);
  const host = join(dir, 'components/host.ts');
  const dyn = dynamicEdges(graph);
  assert.ok(!dyn.get(host), 'a computed specifier yields no dynamic edge');
});

test('a dynamic import written inside an html template literal is not an edge', async () => {
  const dir = await makeApp({
    'components/host.ts': `import { html } from '@webjsdev/core';
      export const tpl = html\`<pre>const m = await import('./not-real.ts');</pre>\`;`,
  });
  const graph = await buildModuleGraph(dir);
  const host = join(dir, 'components/host.ts');
  assert.ok(!dynamicEdges(graph).get(host), 'an example import inside a template is masked out');
});
