// Route modules never ship (#1686): the boot imports each route module's
// component frontier in its place. These cases pin the walk and the set of
// route modules it runs over.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { routeFrontiers } from '../../src/route-frontier.js';
import { collectBootRouteModules } from '../../src/dev/helpers.js';

/** @param {Record<string, string[]>} edges */
const graph = (edges) => new Map(Object.entries(edges).map(([k, v]) => [k, new Set(v)]));

test('a page with no component import has an empty frontier', () => {
  const g = graph({ '/app/page.ts': ['/lib/format.ts'], '/lib/format.ts': [] });
  const out = routeFrontiers(['/app/page.ts'], g, new Set(), new Set());
  assert.deepEqual(out.get('/app/page.ts'), []);
});

test('components reached through plain helpers are emitted; the walk stops at a component', () => {
  const g = graph({
    '/app/page.ts': ['/lib/barrel.ts', '/c/a.ts'],
    '/lib/barrel.ts': ['/c/b.ts'],
    '/c/a.ts': ['/c/nested.ts'],
    '/c/b.ts': [],
    '/c/nested.ts': [],
  });
  const comps = new Set(['/c/a.ts', '/c/b.ts', '/c/nested.ts']);
  const out = routeFrontiers(['/app/page.ts'], g, comps, new Set());
  // `nested` loads with `a`, so it is not re-emitted.
  assert.deepEqual(out.get('/app/page.ts')?.sort(), ['/c/a.ts', '/c/b.ts']);
});

test('an elided component and a .server file are skipped, and so is everything behind them', () => {
  const g = graph({
    '/app/page.ts': ['/c/static.ts', '/lib/db.server.ts'],
    '/c/static.ts': ['/c/inner.ts'],
    '/lib/db.server.ts': ['/c/behind-server.ts'],
  });
  const comps = new Set(['/c/static.ts', '/c/inner.ts', '/c/behind-server.ts']);
  const out = routeFrontiers(['/app/page.ts'], g, comps, new Set(['/c/static.ts']));
  assert.deepEqual(out.get('/app/page.ts'), []);
});

test('a cycle through helpers terminates and emits each component once', () => {
  const g = graph({
    '/app/page.ts': ['/lib/a.ts'],
    '/lib/a.ts': ['/lib/b.ts', '/c/x.ts'],
    '/lib/b.ts': ['/lib/a.ts', '/c/x.ts'],
  });
  const out = routeFrontiers(['/app/page.ts'], g, new Set(['/c/x.ts']), new Set());
  assert.deepEqual(out.get('/app/page.ts'), ['/c/x.ts']);
});

test('the route module itself is never part of its own frontier', () => {
  // A route file that is also scanned as a component (it defines one) must
  // still not be emitted: route modules never ship.
  const g = graph({ '/app/page.ts': ['/c/a.ts'], '/c/a.ts': ['/app/page.ts'] });
  const comps = new Set(['/app/page.ts', '/c/a.ts']);
  const out = routeFrontiers(['/app/page.ts'], g, comps, new Set());
  assert.deepEqual(out.get('/app/page.ts'), ['/c/a.ts']);
});

test('collectBootRouteModules covers pages, layouts and every boundary kind, never global-error', () => {
  const table = {
    pages: [{
      file: '/app/page.ts',
      layouts: ['/app/layout.ts'],
      errors: ['/app/error.ts'],
      loadings: ['/app/loading.ts'],
      notFounds: ['/app/not-found.ts'],
      forbiddens: ['/app/forbidden.ts'],
      unauthorizeds: ['/app/unauthorized.ts'],
    }, {
      file: '/app/blog/page.ts',
      layouts: ['/app/layout.ts', '/app/blog/layout.ts'],
    }],
    notFound: '/app/not-found.ts',
    notFounds: new Map([['/blog', '/app/blog/not-found.ts']]),
    globalNotFound: '/app/global-not-found.ts',
    globalError: '/app/global-error.ts',
  };
  const mods = collectBootRouteModules(/** @type {any} */ (table));
  assert.deepEqual([...mods].sort(), [
    '/app/blog/layout.ts', '/app/blog/not-found.ts', '/app/blog/page.ts',
    '/app/error.ts', '/app/forbidden.ts', '/app/global-not-found.ts',
    '/app/layout.ts', '/app/loading.ts', '/app/not-found.ts', '/app/page.ts',
    '/app/unauthorized.ts',
  ]);
  assert.ok(!mods.includes('/app/global-error.ts'));
});
