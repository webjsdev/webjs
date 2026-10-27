/**
 * The per-render preload hints walk the module graph ONCE (#1644). The
 * app-module preload pass and the vendor pass used to each run their own
 * `transitiveDeps` over the same roots with the same skip set. The shared
 * helper walks once and feeds both. The output must equal the two-call form
 * exactly, and a lookup counter on a real graph proves the second walk is
 * gone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { pagePreloadHints, deduplicatedPreloads, reachedVendorSpecifiers } from '../../src/ssr/preloads.js';
import { buildModuleGraph } from '../../src/module-graph.js';

/**
 * A real app on disk so the graph carries bare-import edges (their recorder
 * is private to module-graph.js). Shape: page and component both import
 * util, util imports deep and the vendor `dayjs`. The layout imports nothing.
 */
async function fixture() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'webjs-preloads-')));
  const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(join(abs, '..'), { recursive: true }); writeFileSync(abs, body); };
  w('package.json', JSON.stringify({ name: 'preloads', type: 'module' }));
  w('app/page.ts', "import '../lib/util.ts';\nexport default () => '';\n");
  w('app/badge-page.ts', "import '../components/badge.ts';\nexport default () => '';\n");
  w('app/layout.ts', 'export default ({ children }) => children;\n');
  w('components/hot.ts', "import '../lib/util.ts';\nexport class Hot {}\n");
  w('components/badge.ts', "import '../lib/badge-only.ts';\nexport class Badge {}\n");
  w('lib/util.ts', "import './deep.ts';\nimport dayjs from 'dayjs';\nexport const u = dayjs;\n");
  w('lib/deep.ts', 'export const deep = 1;\n');
  w('lib/badge-only.ts', "import 'only-vendor';\nexport const b = 1;\n");
  const graph = await buildModuleGraph(dir);
  return { dir, graph };
}

/** Count `graph.get` calls across `fn` by shadowing the method on the instance. */
function countGets(graph, fn) {
  const real = graph.get.bind(graph);
  let gets = 0;
  graph.get = (k) => { gets++; return real(k); };
  try { fn(); } finally { delete graph.get; }
  return gets;
}

test('pagePreloadHints equals the two-call form and walks the graph once', async () => {
  const { dir, graph } = await fixture();
  try {
    const moduleUrls = ['/app/page.ts', '/app/layout.ts'];
    const shippedRoots = moduleUrls.map((u) => resolve(dir, u.slice(1)));
    const components = ['/components/hot.ts'];

    let preloadsOld, vendorsOld;
    const twoWalks = countGets(graph, () => {
      preloadsOld = deduplicatedPreloads(components, moduleUrls, graph, shippedRoots, dir, undefined, undefined);
      vendorsOld = reachedVendorSpecifiers(graph, shippedRoots, components, dir, undefined, undefined);
    });
    let out;
    const oneWalk = countGets(graph, () => {
      out = pagePreloadHints({ graph, appDir: dir, moduleUrls, eagerComponents: components, elidableComponents: undefined, lazyFiles: undefined, serverFiles: undefined });
    });
    assert.deepEqual(out.preloads, preloadsOld, 'same modulepreload list as the two-call form');
    assert.deepEqual([...out.vendorSpecifiers], [...vendorsOld], 'same vendor specifier set');
    assert.deepEqual(out.preloads, ['/components/hot.ts', '/lib/util.ts', '/lib/deep.ts']);
    assert.deepEqual([...out.vendorSpecifiers], ['dayjs']);
    assert.ok(oneWalk < twoWalks, `one walk costs fewer graph lookups than two (${oneWalk} vs ${twoWalks})`);
    assert.ok(oneWalk <= Math.ceil(twoWalks / 2), `about half (${oneWalk} vs ${twoWalks}): the closure was walked once`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pagePreloadHints skips an elided component and the subtree only it reaches, vendor included', async () => {
  const { dir, graph } = await fixture();
  try {
    // The badge page imports the badge component; with the badge elided
    // (its import is stripped from the served page), neither it nor the
    // helper only it reaches may be hinted. A rendered elided component never
    // reaches `eagerComponents` (componentPreloads drops it), so the root here
    // is the page alone.
    const out = pagePreloadHints({
      graph, appDir: dir, moduleUrls: ['/app/badge-page.ts'], eagerComponents: [],
      elidableComponents: new Set([resolve(dir, 'components/badge.ts')]), lazyFiles: undefined, serverFiles: undefined,
    });
    assert.deepEqual(out.preloads, [], 'nothing behind the elided component is hinted');
    assert.deepEqual([...out.vendorSpecifiers], [], 'and its vendor is not reached');
    const kept = pagePreloadHints({
      graph, appDir: dir, moduleUrls: ['/app/badge-page.ts'], eagerComponents: [],
      elidableComponents: undefined, lazyFiles: undefined, serverFiles: undefined,
    });
    assert.deepEqual(kept.preloads, ['/components/badge.ts', '/lib/badge-only.ts'], 'counterfactual: not elided, the subtree is hinted');
    assert.deepEqual([...kept.vendorSpecifiers], ['only-vendor']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pagePreloadHints folds lazy files into a skip set memoized per lazy map', async () => {
  const { dir, graph } = await fixture();
  try {
    const lazy = new Map([[resolve(dir, 'components/badge.ts'), ['lazy-badge']]]);
    // A lazy component is diverted to the lazy loader before it could reach
    // `eagerComponents`, so the root is the page that imports it.
    const run = () => pagePreloadHints({ graph, appDir: dir, moduleUrls: ['/app/badge-page.ts'], eagerComponents: [], elidableComponents: undefined, lazyFiles: lazy, serverFiles: undefined });
    const a = run();
    assert.deepEqual(a.preloads, [], 'the lazy subtree is not hinted');
    assert.ok(a.skip.has(resolve(dir, 'components/badge.ts')));
    assert.equal(run().skip, a.skip, 'the skip set is one object per lazy map');
    assert.equal(run().skip, pagePreloadHints({ graph, appDir: dir, moduleUrls: [], eagerComponents: [], elidableComponents: undefined, lazyFiles: lazy, serverFiles: undefined }).skip);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
