import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { buildModuleGraph, transitiveDeps, _parseCacheHas } from '../../src/module-graph.js';

test('buildModuleGraph: builds graph from source files', async () => {
  const dir = join(tmpdir(), `webjs-test-graph-${Date.now()}`);
  await mkdir(join(dir, 'components'), { recursive: true });

  await writeFile(join(dir, 'page.ts'), `
    import { html } from '@webjsdev/core';
    import './components/counter.ts';
    import './components/header.ts';
  `);
  await writeFile(join(dir, 'components', 'counter.ts'), `
    import { WebComponent, html } from '@webjsdev/core';
    import './shared.ts';
  `);
  await writeFile(join(dir, 'components', 'header.ts'), `
    import { WebComponent, html } from '@webjsdev/core';
    import './shared.ts';
  `);
  await writeFile(join(dir, 'components', 'shared.ts'), `
    export const VERSION = '1.0';
  `);

  const graph = await buildModuleGraph(dir);

  // page.ts should import counter and header
  const pageDeps = graph.get(join(dir, 'page.ts'));
  assert.ok(pageDeps, 'page.ts should have deps');
  assert.ok(pageDeps.has(join(dir, 'components', 'counter.ts')));
  assert.ok(pageDeps.has(join(dir, 'components', 'header.ts')));

  // counter.ts should import shared.ts
  const counterDeps = graph.get(join(dir, 'components', 'counter.ts'));
  assert.ok(counterDeps, 'counter.ts should have deps');
  assert.ok(counterDeps.has(join(dir, 'components', 'shared.ts')));

  // Bare specifiers (e.g. '@webjsdev/core') should NOT be in the graph: only
  // relative imports resolve to absolute paths.
  if (pageDeps) {
    for (const dep of pageDeps) {
      assert.ok(dep.startsWith('/'), 'all deps should be absolute paths');
    }
  }

  await rm(dir, { recursive: true, force: true });
});

test('transitiveDeps: returns all transitive dependencies', async () => {
  const dir = join(tmpdir(), `webjs-test-transitive-${Date.now()}`);
  await mkdir(join(dir, 'components'), { recursive: true });

  await writeFile(join(dir, 'page.ts'), `
    import './components/a.ts';
  `);
  await writeFile(join(dir, 'components', 'a.ts'), `
    import './b.ts';
  `);
  await writeFile(join(dir, 'components', 'b.ts'), `
    import './c.ts';
  `);
  await writeFile(join(dir, 'components', 'c.ts'), `
    export const x = 1;
  `);

  const graph = await buildModuleGraph(dir);
  const deps = transitiveDeps(graph, [join(dir, 'page.ts')], dir);

  // Should include a.ts, b.ts, c.ts (transitive chain)
  assert.ok(deps.includes(join(dir, 'components', 'a.ts')));
  assert.ok(deps.includes(join(dir, 'components', 'b.ts')));
  assert.ok(deps.includes(join(dir, 'components', 'c.ts')));
  // Should NOT include the entry file itself
  assert.ok(!deps.includes(join(dir, 'page.ts')));

  await rm(dir, { recursive: true, force: true });
});

test('transitiveDeps: handles cycles without infinite loop', async () => {
  const dir = join(tmpdir(), `webjs-test-cycle-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, 'a.js'), `import './b.js';`);
  await writeFile(join(dir, 'b.js'), `import './a.js';`);

  const graph = await buildModuleGraph(dir);
  // Should not hang
  const deps = transitiveDeps(graph, [join(dir, 'a.js')], dir);
  assert.ok(deps.includes(join(dir, 'b.js')));
  assert.ok(!deps.includes(join(dir, 'a.js')), 'entry should not appear in deps');

  await rm(dir, { recursive: true, force: true });
});

test('transitiveDeps: deduplicates shared deps', async () => {
  const dir = join(tmpdir(), `webjs-test-dedup-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  // Both a and b import shared
  await writeFile(join(dir, 'a.js'), `import './shared.js';`);
  await writeFile(join(dir, 'b.js'), `import './shared.js';`);
  await writeFile(join(dir, 'shared.js'), `export const x = 1;`);

  const graph = await buildModuleGraph(dir);
  const deps = transitiveDeps(graph, [join(dir, 'a.js'), join(dir, 'b.js')], dir);

  // shared.js should appear only once
  const sharedCount = deps.filter(d => d.endsWith('shared.js')).length;
  assert.equal(sharedCount, 1);

  await rm(dir, { recursive: true, force: true });
});

test('transitiveDeps: skip set excludes a node and its unique subtree', async () => {
  const dir = join(tmpdir(), `webjs-test-skip-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  // page -> badge -> dayjs-shim (reachable only via badge)
  // page -> counter (kept)
  await writeFile(join(dir, 'page.js'), `import './badge.js';\nimport './counter.js';`);
  await writeFile(join(dir, 'badge.js'), `import './dayjs-shim.js';`);
  await writeFile(join(dir, 'dayjs-shim.js'), `export const d = 1;`);
  await writeFile(join(dir, 'counter.js'), `export const c = 1;`);

  const graph = await buildModuleGraph(dir);
  const skip = new Set([join(dir, 'badge.js')]);
  const deps = transitiveDeps(graph, [join(dir, 'page.js')], dir, skip);

  // badge and its unique subtree (dayjs-shim) are gone; counter stays.
  assert.ok(!deps.some((d) => d.endsWith('badge.js')));
  assert.ok(!deps.some((d) => d.endsWith('dayjs-shim.js')));
  assert.ok(deps.some((d) => d.endsWith('counter.js')));

  await rm(dir, { recursive: true, force: true });
});

test('transitiveDeps: stops at the .server.* boundary (no preload for server-only deps)', async () => {
  // The preload emitter walks transitiveDeps. A client import of a server
  // action is rewritten to an RPC stub, so the browser fetches the stub URL
  // but NEVER the server file's own imports. transitiveDeps must therefore
  // stop at `.server.*`, exactly like reachableFromEntries (the auth gate);
  // otherwise it emits modulepreload hints for server-only files the gate
  // then 404s (#158: slugify.ts / types.ts on the blog). Counterfactual:
  // remove the `SERVER_FILE_RE.test(dep)` guard in transitiveDeps and the
  // `slugify.ts` assertion below fails (it leaks into the preload list).
  const dir = join(tmpdir(), `webjs-test-serverbound-${Date.now()}`);
  await mkdir(join(dir, 'modules'), { recursive: true });

  // page -> create.server.ts -> slugify.ts (server-only, reachable ONLY via
  //         the server file)
  // page -> counter.ts (client, kept)
  // page -> shared.ts AND create.server.ts -> shared.ts (reachable via BOTH a
  //         server file and a real client path: must still be included)
  await writeFile(join(dir, 'page.ts'),
    `import './modules/create.server.ts';\nimport './counter.ts';\nimport './shared.ts';`);
  await writeFile(join(dir, 'modules', 'create.server.ts'),
    `'use server';\nimport '../slugify.ts';\nimport '../shared.ts';`);
  await writeFile(join(dir, 'slugify.ts'), `export const slug = (s) => s;`);
  await writeFile(join(dir, 'counter.ts'), `export const c = 1;`);
  await writeFile(join(dir, 'shared.ts'), `export const s = 1;`);

  const graph = await buildModuleGraph(dir);
  const deps = transitiveDeps(graph, [join(dir, 'page.ts')], dir);

  // The server file's URL itself is fetched (as a stub), so it stays in.
  assert.ok(deps.some((d) => d.endsWith('create.server.ts')), 'the .server.* stub URL is preloadable');
  // Its server-only dep is NOT preloaded (the gate would 404 it).
  assert.ok(!deps.some((d) => d.endsWith('slugify.ts')), 'server-only dep must not leak into preloads');
  // The plain client edge is preserved.
  assert.ok(deps.some((d) => d.endsWith('counter.ts')), 'client dep stays');
  // A file reachable via BOTH a server file and a real client path is kept
  // (the client path still reaches it; the boundary only prunes the server path).
  assert.ok(deps.some((d) => d.endsWith('shared.ts')), 'dual-reachable file kept via client path');

  await rm(dir, { recursive: true, force: true });
});

test('buildModuleGraph: ignores import/export shown as code inside a template literal', async () => {
  // A docs/tutorial page renders example code (including import statements)
  // as TEXT inside an `html\`\`` template. The scanner must not mistake that
  // for a real import edge (#159: a phantom /app/docs/components/counter.ts
  // preload 404 on docs.webjs.dev). Counterfactual: drop the redaction-mask
  // guard in parseFile and the `phantom.ts` / `phantom2.ts` assertions fail.
  const dir = join(tmpdir(), `webjs-test-tmpl-import-${Date.now()}`);
  await mkdir(dir, { recursive: true });

  // Real imports live at top level; the phantom ones live inside the template
  // body. A real multi-line `export … from` barrel re-export is included to
  // prove the mask does not over-redact actual statements.
  const pageSrc = [
    "import { html } from '@webjsdev/core';",
    "import './real.ts';",
    "export {",
    "  a,",
    "} from './barrel.ts';",
    "export default function Page() {",
    "  return html`",
    "    <h3>app/page.ts</h3>",
    "    <pre>import './phantom.ts';",
    "export { x } from './phantom2.ts';</pre>",
    "  `;",
    "}",
  ].join('\n');
  await writeFile(join(dir, 'page.ts'), pageSrc);
  await writeFile(join(dir, 'real.ts'), `export const r = 1;`);
  await writeFile(join(dir, 'barrel.ts'), `export const a = 1;`);
  await writeFile(join(dir, 'phantom.ts'), `export const p = 1;`);
  await writeFile(join(dir, 'phantom2.ts'), `export const p2 = 1;`);

  const graph = await buildModuleGraph(dir);
  const deps = graph.get(join(dir, 'page.ts')) || new Set();

  // Real top-level imports / re-exports are detected.
  assert.ok(deps.has(join(dir, 'real.ts')), 'real import detected');
  assert.ok(deps.has(join(dir, 'barrel.ts')), 'real multi-line export-from detected (no over-redaction)');
  // Imports shown as text inside the template literal are NOT edges.
  assert.ok(!deps.has(join(dir, 'phantom.ts')), 'import inside template literal is not an edge');
  assert.ok(!deps.has(join(dir, 'phantom2.ts')), 'export-from inside template literal is not an edge');

  await rm(dir, { recursive: true, force: true });
});

test('buildModuleGraph: skips node_modules and _private', async () => {
  const dir = join(tmpdir(), `webjs-test-graph-skip-${Date.now()}`);
  await mkdir(join(dir, 'node_modules'), { recursive: true });
  await mkdir(join(dir, '_private'), { recursive: true });

  await writeFile(join(dir, 'app.js'), `import './local.js';`);
  await writeFile(join(dir, 'local.js'), `export const x = 1;`);
  await writeFile(join(dir, 'node_modules', 'lib.js'), `import 'x';`);
  await writeFile(join(dir, '_private', 'secret.js'), `import 'y';`);

  const graph = await buildModuleGraph(dir);
  assert.ok(graph.has(join(dir, 'app.js')));
  assert.ok(!graph.has(join(dir, 'node_modules', 'lib.js')));
  assert.ok(!graph.has(join(dir, '_private', 'secret.js')));

  await rm(dir, { recursive: true, force: true });
});

test('buildModuleGraph: PARSE_CACHE reuses unchanged files and a size-changing edit at the SAME mtime is still picked up', async () => {
  // Incremental rebuild (#141): the parse cache is keyed by mtime AND size, so
  // an edit that changes the file length is caught even if the filesystem
  // reports an identical mtime (coarse-resolution / sub-tick edits). To isolate
  // the `size` half of the key, page.ts is stamped to a FIXED mtime BEFORE the
  // first build (so the cache records that mtime), then re-stamped to the SAME
  // mtime after the edit, leaving size as the only thing that differs. With a
  // mtime-only key the second build would hit the cache and return the stale
  // ['a.ts'] deps, so this assertion fails without the size discriminator.
  const { utimes, mkdtemp } = await import('node:fs/promises');
  const dir = await mkdtemp(join(tmpdir(), 'webjs-parsecache-'));
  try {
    const page = join(dir, 'page.ts');
    const fixed = new Date(2020, 0, 1);
    await writeFile(page, `import './a.ts';\n`);
    await writeFile(join(dir, 'a.ts'), `export const a = 1;\n`);
    await writeFile(join(dir, 'b.ts'), `export const b = 2;\n`);
    await utimes(page, fixed, fixed); // pin the mtime BEFORE the cache records it

    const g1 = await buildModuleGraph(dir);
    assert.deepEqual([...(g1.get(page) || [])].map((f) => f.split('/').pop()), ['a.ts']);

    // Rewrite page.ts to import b.ts (DIFFERENT length) and re-stamp the SAME
    // mtime, so only `size` distinguishes this version from the cached one.
    await writeFile(page, `import './b.ts'; // now imports b, a longer line\n`);
    await utimes(page, fixed, fixed);

    const g2 = await buildModuleGraph(dir);
    assert.deepEqual([...(g2.get(page) || [])].map((f) => f.split('/').pop()), ['b.ts'],
      'size-changing edit must invalidate the parse cache even at the same mtime');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('buildModuleGraph: evicts the parse-cache entry for a deleted file on rebuild', async () => {
  // Incremental rebuild keeps a parse cache keyed by path. Over a long dev
  // session, renamed/deleted files would otherwise leave dead entries forever.
  // A rebuild walks only live files, so any cache key under appDir not seen
  // this walk is evicted.
  const { mkdtemp } = await import('node:fs/promises');
  const dir = await mkdtemp(join(tmpdir(), 'webjs-graph-evict-'));
  try {
    const page = join(dir, 'page.ts');
    const gone = join(dir, 'gone.ts');
    await writeFile(page, `import './gone.ts';\n`);
    await writeFile(gone, `export const g = 1;\n`);
    await buildModuleGraph(dir);
    assert.ok(_parseCacheHas(page), 'page cached after first build');
    assert.ok(_parseCacheHas(gone), 'gone cached after first build');

    // Delete gone.ts and drop its import, then rebuild.
    await rm(gone);
    await writeFile(page, `export const p = 1;\n`);
    await buildModuleGraph(dir);
    assert.ok(_parseCacheHas(page), 'live file stays cached');
    assert.ok(!_parseCacheHas(gone), 'deleted file is evicted from the parse cache');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
