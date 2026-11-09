/**
 * Path-aware frontier (#963, #1686): a route module never ships, and the boot
 * imports its component FRONTIER instead. A client-effecting NON-component
 * module (the module-scope-signal-in-its-own-file idiom of invariant 5)
 * loads in the browser only through a component that imports it, and a path
 * from the page to it with no component on the way contributes nothing: the
 * page runs on the server only, so that import never reaches a browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { routeFrontiers } from '../../src/route-frontier.js';

function graphOf(edges) {
  const g = new Map();
  for (const [from, tos] of Object.entries(edges)) g.set(from, new Set(tos));
  return g;
}

/** The page's frontier, with route files and server files skipped as the dev server does. */
function frontierOf({ edges, components, routeModules = ['/app/page.js'], elided = [] }) {
  const out = routeFrontiers(routeModules, graphOf(edges), new Set(components),
    new Set([...elided, ...routeModules]));
  return out.get('/app/page.js');
}

test('a signal module reached only THROUGH a shipping component is carried by it (#963)', () => {
  assert.deepEqual(
    frontierOf({
      components: ['/app/components/overlay.js'],
      edges: {
        '/app/page.js': ['/app/components/overlay.js'],
        '/app/components/overlay.js': ['/app/lib/bus.js'],
      },
    }),
    ['/app/components/overlay.js'],
    'the boot imports the component that carries the bus',
  );
});

test('the SAME signal module imported DIRECTLY by the page adds nothing to the boot (#1686)', () => {
  // Before #1686 this pinned the whole page to the browser. The page now runs
  // on the server only, so its direct import of the bus never loads there.
  assert.deepEqual(
    frontierOf({
      components: ['/app/components/overlay.js'],
      edges: {
        '/app/page.js': ['/app/components/overlay.js', '/app/lib/bus.js'],
        '/app/components/overlay.js': ['/app/lib/bus.js'],
      },
    }),
    ['/app/components/overlay.js'],
    'a non-component is never emitted in the page\'s place',
  );
});

test('a component reached through a plain helper is part of the frontier', () => {
  assert.deepEqual(
    frontierOf({
      components: ['/app/components/overlay.js', '/app/components/chip.js'],
      edges: {
        '/app/page.js': ['/app/components/overlay.js', '/app/lib/helper.js'],
        '/app/lib/helper.js': ['/app/lib/bus.js', '/app/components/chip.js'],
        '/app/components/overlay.js': ['/app/lib/bus.js'],
      },
    }).sort(),
    ['/app/components/chip.js', '/app/components/overlay.js'],
    'the helper is a carrier: walked, never emitted',
  );
});

test('a component nested BEHIND another shipping component is not re-emitted (carried by its importer)', () => {
  assert.deepEqual(
    frontierOf({
      components: ['/app/components/outer.js', '/app/components/counter.js'],
      edges: {
        '/app/page.js': ['/app/components/outer.js'],
        '/app/components/outer.js': ['/app/components/counter.js'],
      },
    }),
    ['/app/components/outer.js'],
    'only the frontier component is emitted; the nested one loads via its import',
  );
});

test('an elided component is never emitted, and the walk does not continue through it', () => {
  assert.deepEqual(
    frontierOf({
      components: ['/app/components/badge.js', '/app/components/inner.js'],
      elided: ['/app/components/badge.js'],
      edges: {
        '/app/page.js': ['/app/components/badge.js'],
        '/app/components/badge.js': ['/app/components/inner.js'],
      },
    }),
    [],
  );
});

test('a .server.* file OUTSIDE appDir is a traversal stop (#963)', () => {
  // /shared/db.server.ts sits outside the app dir, so the dev server's
  // server-file set does not name it; the walk must still stop at it (its
  // subtree only ever reaches the browser as a stub), or a component behind it
  // would be booted for nothing.
  assert.deepEqual(
    frontierOf({
      components: ['/app/components/overlay.js', '/app/components/behind.js'],
      edges: {
        '/app/page.js': ['/app/components/overlay.js', '/shared/db.server.ts'],
        '/shared/db.server.ts': ['/app/components/behind.js'],
      },
    }),
    ['/app/components/overlay.js'],
    'nothing behind the server stub is emitted',
  );
});
