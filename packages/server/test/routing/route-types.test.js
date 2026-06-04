/**
 * Unit tests for the route-types generator (#258): `generateRouteTypes` and
 * its key/param helpers. It walks `app/` (via buildRouteTable) and emits the
 * `.d.ts` text that augments @webjsdev/core.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  generateRouteTypes,
  routeKeyFromDir,
  dynamicSegments,
  paramTypeForKey,
  webjsRoutesKeysForKey,
} from '../../src/route-types.js';

async function scaffold(files) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-routetypes-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(dir, rel);
    await mkdir(join(p, '..'), { recursive: true });
    await writeFile(p, body);
  }
  return dir;
}

const PAGE = 'export default () => ""';

test('emits WebjsRoutes + RouteParamMap for a representative app', async () => {
  const dir = await scaffold({
    'app/page.js': PAGE,
    'app/about/page.js': PAGE,
    'app/blog/[slug]/page.js': PAGE,
    'app/files/[...rest]/page.js': PAGE,
    'app/docs/[[...slug]]/page.js': PAGE,
    // Route group: the (marketing) folder is stripped from the URL.
    'app/(marketing)/pricing/page.js': PAGE,
    // Private folder: fully excluded from routing AND the types.
    'app/_secret/page.js': PAGE,
    // A route handler is NOT a navigable page, so it is excluded.
    'app/api/health/route.js': 'export const GET = () => ({})',
  });
  try {
    const text = await generateRouteTypes(dir);

    // Static + dynamic page route keys are present in WebjsRoutes.
    assert.match(text, /"\/": true;/);
    assert.match(text, /"\/about": true;/);
    assert.match(text, /"\/blog\/\[slug\]": true;/);
    assert.match(text, /"\/files\/\[\.\.\.rest\]": true;/);
    // Route group stripped from the URL.
    assert.match(text, /"\/pricing": true;/);

    // Optional catch-all emits BOTH the without-segment `/docs` and the
    // normalized with-segment `/docs/[...slug]` as Route-union keys.
    assert.match(text, /"\/docs": true;/);
    assert.match(text, /"\/docs\/\[\.\.\.slug\]": true;/);

    // RouteParamMap carries the param shapes, keyed on the author-facing
    // literal (the doubled [[...slug]] for the optional catch-all).
    assert.match(text, /"\/blog\/\[slug\]": \{ slug: string \};/);
    assert.match(text, /"\/files\/\[\.\.\.rest\]": \{ rest: string\[\] \};/);
    assert.match(text, /"\/docs\/\[\[\.\.\.slug\]\]": \{ slug\?: string\[\] \};/);

    // Counterfactual: the private route is NOT present anywhere.
    assert.doesNotMatch(text, /_secret/);
    assert.doesNotMatch(text, /"\/_secret"/);

    // Counterfactual: a route.js API path is NOT a navigable Route key.
    assert.doesNotMatch(text, /"\/api\/health"/);

    // A static route gets no RouteParamMap entry.
    assert.doesNotMatch(text, /"\/about": \{/);
    assert.doesNotMatch(text, /"\/pricing": \{/);

    // The augmentation targets the right module.
    assert.match(text, /declare module '@webjsdev\/core'/);
    assert.match(text, /interface WebjsRoutes/);
    assert.match(text, /interface RouteParamMap/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('output is deterministic (byte-identical across runs)', async () => {
  const files = {
    'app/page.js': PAGE,
    'app/zebra/page.js': PAGE,
    'app/alpha/page.js': PAGE,
    'app/blog/[slug]/page.js': PAGE,
  };
  const dir = await scaffold(files);
  try {
    const a = await generateRouteTypes(dir);
    const b = await generateRouteTypes(dir);
    assert.equal(a, b);
    // Keys are sorted, so `/alpha` precedes `/zebra` in the output.
    assert.ok(a.indexOf('"/alpha"') < a.indexOf('"/zebra"'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('routeKeyFromDir strips groups + private and handles root', () => {
  assert.equal(routeKeyFromDir('.'), '/');
  assert.equal(routeKeyFromDir('about'), '/about');
  assert.equal(routeKeyFromDir('blog/[slug]'), '/blog/[slug]');
  assert.equal(routeKeyFromDir('(marketing)/pricing'), '/pricing');
});

test('dynamicSegments classifies single / catch-all / optional', () => {
  assert.deepEqual(dynamicSegments('/about'), []);
  assert.deepEqual(dynamicSegments('/blog/[slug]'), [{ name: 'slug', kind: 'single' }]);
  assert.deepEqual(dynamicSegments('/files/[...rest]'), [{ name: 'rest', kind: 'catchAll' }]);
  assert.deepEqual(dynamicSegments('/docs/[[...slug]]'), [
    { name: 'slug', kind: 'optionalCatchAll' },
  ]);
});

test('paramTypeForKey emits the right TS shape (null for static)', () => {
  assert.equal(paramTypeForKey('/about'), null);
  assert.equal(paramTypeForKey('/blog/[slug]'), '{ slug: string }');
  assert.equal(paramTypeForKey('/files/[...rest]'), '{ rest: string[] }');
  assert.equal(paramTypeForKey('/docs/[[...slug]]'), '{ slug?: string[] }');
});

test('webjsRoutesKeysForKey normalizes the optional catch-all into two keys', () => {
  assert.deepEqual(webjsRoutesKeysForKey('/about'), ['/about']);
  assert.deepEqual(webjsRoutesKeysForKey('/blog/[slug]'), ['/blog/[slug]']);
  const docs = webjsRoutesKeysForKey('/docs/[[...slug]]');
  assert.ok(docs.includes('/docs'));
  assert.ok(docs.includes('/docs/[...slug]'));
  assert.ok(!docs.includes('/docs/[[...slug]]'));
});
