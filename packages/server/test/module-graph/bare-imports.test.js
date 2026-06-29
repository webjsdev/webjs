import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { buildModuleGraph, bareImports } from '../../src/module-graph.js';

/**
 * A bare npm vendor specifier (`dayjs`, `@scope/pkg/sub`) is recorded as a
 * SEPARATE edge class (#754), parallel to the dynamic edges of #751. The static
 * app graph still only tracks relative + `#`-alias edges (so the auth gate /
 * elision are unchanged), but the exact bare specifier is kept so SSR can look
 * it up in the vendor importmap and emit a `modulepreload` for the reached
 * vendor URL, flattening the cross-origin CDN waterfall. Builtins and protocol
 * specifiers are excluded; an html-template example import is masked out.
 */

async function makeApp(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-bareimport-'));
  for (const [rel, contents] of Object.entries(files)) {
    const abs = join(dir, rel);
    await mkdir(abs.slice(0, abs.lastIndexOf('/')), { recursive: true });
    await writeFile(abs, contents);
  }
  return dir;
}

test('a bare vendor import is recorded as a bare edge, not a static edge', async () => {
  const dir = await makeApp({
    'components/clock.ts': `import dayjs from 'dayjs';
      export const now = () => dayjs();`,
  });
  const graph = await buildModuleGraph(dir);
  const clock = join(dir, 'components/clock.ts');

  const bare = bareImports(graph);
  assert.ok(bare.get(clock)?.has('dayjs'), 'recorded as a bare (vendor) edge');
  // It is NOT a static graph edge (the gate / elision never resolve it locally).
  assert.ok(!graph.get(clock), 'a file whose only import is a vendor has no static deps');
});

test('the exact specifier (scope + subpath) is preserved', async () => {
  const dir = await makeApp({
    'components/util.ts': `import utc from 'dayjs/plugin/utc';
      import { z } from '@scope/pkg/sub';
      export const u = [utc, z];`,
  });
  const graph = await buildModuleGraph(dir);
  const util = join(dir, 'components/util.ts');
  const bare = bareImports(graph);
  assert.ok(bare.get(util)?.has('dayjs/plugin/utc'), 'subpath specifier kept verbatim');
  assert.ok(bare.get(util)?.has('@scope/pkg/sub'), 'scoped subpath specifier kept verbatim');
});

test('node: builtins and protocol specifiers are NOT bare edges', async () => {
  const dir = await makeApp({
    'components/srv.ts': `import { readFile } from 'node:fs/promises';
      import data from 'data:text/javascript,export default 1';
      import x from 'https://example.com/x.js';
      export const y = [readFile, data, x];`,
  });
  const graph = await buildModuleGraph(dir);
  const srv = join(dir, 'components/srv.ts');
  const set = bareImports(graph).get(srv) || new Set();
  assert.ok(!set.has('node:fs/promises'), 'node: builtin excluded');
  assert.ok(![...set].some((s) => s.startsWith('data:')), 'data: url excluded');
  assert.ok(![...set].some((s) => s.startsWith('https:')), 'absolute url excluded');
});

test('relative + #-alias imports stay static (not bare edges)', async () => {
  const dir = await makeApp({
    'components/host.ts': `import { sib } from './sib.ts';
      import { lib } from '#lib/util.ts';
      import dayjs from 'dayjs';
      export const v = [sib, lib, dayjs];`,
    'components/sib.ts': `export const sib = 1;`,
    'lib/util.ts': `export const lib = 1;`,
    'package.json': JSON.stringify({ name: 'app', type: 'module', imports: { '#*': './*' } }),
  });
  const graph = await buildModuleGraph(dir);
  const host = join(dir, 'components/host.ts');
  const bare = bareImports(graph).get(host) || new Set();
  assert.deepEqual([...bare], ['dayjs'], 'only the vendor is a bare edge');
  // The relative + alias targets ARE static graph edges.
  assert.ok(graph.get(host)?.has(join(dir, 'components/sib.ts')), 'relative is a static edge');
  assert.ok(graph.get(host)?.has(join(dir, 'lib/util.ts')), '#-alias is a static edge');
});

test('a bare import inside an html template is masked out', async () => {
  const dir = await makeApp({
    'components/doc.ts': `import { html } from '@webjsdev/core';
      export const tpl = html\`<pre>import x from 'left-pad';</pre>\`;`,
  });
  const graph = await buildModuleGraph(dir);
  const doc = join(dir, 'components/doc.ts');
  const set = bareImports(graph).get(doc) || new Set();
  // The real @webjsdev/core import is a bare edge; the example inside the
  // template is masked (an analyser never treats example code as an edge).
  assert.ok(set.has('@webjsdev/core'), 'the real vendor import is a bare edge');
  assert.ok(!set.has('left-pad'), 'the templated example import is masked out');
});

test('bare edges survive the parse cache on rebuild', async () => {
  const dir = await makeApp({
    'components/clock.ts': `import dayjs from 'dayjs'; export const n = dayjs;`,
  });
  const clock = join(dir, 'components/clock.ts');
  await buildModuleGraph(dir); // warms the parse cache
  // Touch nothing: a second build reads the cached entry (same mtime + size),
  // which must still carry bareDeps.
  const graph2 = await buildModuleGraph(dir);
  assert.ok(bareImports(graph2).get(clock)?.has('dayjs'), 'cached rebuild keeps the bare edge');
});
