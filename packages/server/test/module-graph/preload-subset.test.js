/**
 * Preload-subset invariant, synthetic-graph unit layer (issue #182).
 *
 * The two graph walks that decide what the browser may fetch must never
 * disagree in the dangerous direction: the preload set (`transitiveDeps`,
 * which feeds `<link rel="modulepreload">`) must always be a SUBSET of the
 * servable set (`reachableFromEntries`, the auth gate). When they diverge
 * the framework emits a preload the gate then 404s (the #158 / #159 class).
 * Both stop at `.server.*` boundaries and walk the same graph from the same
 * entries, so the invariant holds by construction; these tests lock that
 * against a future edit to either walk, and the counterfactual proves the
 * subset check has teeth.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { transitiveDeps, reachableFromEntries } from '../../src/module-graph.js';

const APP = '/app';
const f = (p) => `${APP}/${p}`;

/** Build a Map<abs, Set<abs>> graph from a `{ from: [to, ...] }` spec. */
function graphOf(edges) {
  const g = new Map();
  for (const [from, tos] of Object.entries(edges)) g.set(f(from), new Set(tos.map(f)));
  return g;
}

const SERVER_FILE_RE = /\.server\.m?[jt]s$/;

/**
 * The complete preload set the SSR pipeline would emit: the under-app entry
 * files (page + layouts + eager components) plus their transitive deps,
 * with `.server.*` files removed exactly as `deduplicatedPreloads` does (a
 * server file rides the graph as a stub boundary but is never preloaded).
 */
function preloadSet(graph, entries, skip) {
  const entryUrls = entries.map(f).filter((e) => e.startsWith(APP));
  return new Set(
    [...entryUrls, ...transitiveDeps(graph, entries.map(f), APP, skip)]
      .filter((u) => !SERVER_FILE_RE.test(u)),
  );
}

function assertSubset(preloads, servable, msg) {
  const missing = [...preloads].filter((p) => !servable.has(p));
  assert.deepEqual(missing, [], `${msg}: these preloads are NOT servable: ${JSON.stringify(missing)}`);
}

test('plain diamond: every preload is servable', () => {
  const g = graphOf({
    'page.ts': ['components/counter.ts', 'components/header.ts'],
    'components/counter.ts': ['components/shared.ts'],
    'components/header.ts': ['components/shared.ts'],
    'components/shared.ts': [],
  });
  const entries = ['page.ts'];
  const preloads = preloadSet(g, entries);
  const servable = reachableFromEntries(g, entries.map(f), APP);
  assertSubset(preloads, servable, 'diamond');
  assert.ok(preloads.has(f('components/shared.ts')), 'shared dep is both preloaded and servable');
});

test('.server.* boundary: a server-only dep is in NEITHER set', () => {
  const g = graphOf({
    'page.ts': ['actions/create.server.ts', 'components/counter.ts'],
    'actions/create.server.ts': ['lib/slugify.ts'], // server-only, reached ONLY via the server file
    'components/counter.ts': [],
    'lib/slugify.ts': [],
  });
  const entries = ['page.ts'];
  const preloads = preloadSet(g, entries);
  const servable = reachableFromEntries(g, entries.map(f), APP);
  assertSubset(preloads, servable, 'server-boundary');
  // The .server.ts file itself is servable (yields a stub) but never preloaded.
  assert.ok(servable.has(f('actions/create.server.ts')), 'the .server file is servable (stub)');
  assert.ok(!preloads.has(f('actions/create.server.ts')), 'the .server file is not preloaded');
  // slugify, reachable only through the server file, is in neither: not
  // preloaded (so no 404 hint) and not servable (the gate 404s it).
  assert.ok(!preloads.has(f('lib/slugify.ts')), 'server-only dep not preloaded');
  assert.ok(!servable.has(f('lib/slugify.ts')), 'server-only dep not servable');
});

test('dep reached via BOTH a client path and a server path stays preloaded + servable', () => {
  const g = graphOf({
    'page.ts': ['components/counter.ts', 'actions/create.server.ts'],
    'components/counter.ts': ['lib/shared.ts'],       // client path to shared
    'actions/create.server.ts': ['lib/shared.ts'],    // also via the server file
    'lib/shared.ts': [],
  });
  const entries = ['page.ts'];
  const preloads = preloadSet(g, entries);
  const servable = reachableFromEntries(g, entries.map(f), APP);
  assertSubset(preloads, servable, 'dual-path');
  assert.ok(preloads.has(f('lib/shared.ts')), 'shared reached via client path is preloaded');
  assert.ok(servable.has(f('lib/shared.ts')), 'and servable');
});

test('elided components are dropped from preloads (skip), still a subset', () => {
  const g = graphOf({
    'page.ts': ['components/badge.ts', 'components/counter.ts'],
    'components/badge.ts': ['lib/fmt.ts'], // display-only, elided
    'components/counter.ts': [],
    'lib/fmt.ts': [],
  });
  const entries = ['page.ts'];
  const skip = new Set([f('components/badge.ts')]);
  const preloads = preloadSet(g, entries, skip);
  const servable = reachableFromEntries(g, entries.map(f), APP);
  assertSubset(preloads, servable, 'elided');
  assert.ok(!preloads.has(f('components/badge.ts')), 'elided component not preloaded');
  // The skip prunes the elided component AND its now-unreachable dep.
  assert.ok(!preloads.has(f('lib/fmt.ts')), 'elided component dep not preloaded');
});

test('counterfactual: a preload pointing outside the servable set is detected', () => {
  // A divergence between the two walks would manifest as a preload not in the
  // servable set. Simulate it by adding a server-only file to the preload set
  // and asserting the subset check flags it.
  const g = graphOf({
    'page.ts': ['actions/create.server.ts'],
    'actions/create.server.ts': ['lib/slugify.ts'],
    'lib/slugify.ts': [],
  });
  const entries = ['page.ts'];
  const servable = reachableFromEntries(g, entries.map(f), APP);
  assert.ok(!servable.has(f('lib/slugify.ts')), 'precondition: slugify is server-only, not servable');
  const badPreloads = new Set([...preloadSet(g, entries), f('lib/slugify.ts')]);
  assert.throws(
    () => assertSubset(badPreloads, servable, 'should-fail'),
    /NOT servable.*slugify/s,
    'the subset check must flag a preload outside the servable set',
  );
});
