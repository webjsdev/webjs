/**
 * Route specificity is positional and deterministic (#750). The old score was a
 * coarse 3-bucket value (static=1 / dynamic=2 / catch-all=3) whose same-bucket
 * ties resolved by filesystem walk order, so two overlapping depth-2 dynamic
 * routes (`/[org]/[repo]` vs `/[user]/settings`) could match the WRONG page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildRouteTable, matchPage, compareSpecificity } from '../../src/router.js';

async function scaffold(rels) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-routespec-'));
  for (const rel of rels) {
    const p = join(dir, rel);
    await mkdir(join(p, '..'), { recursive: true });
    await writeFile(p, 'export default () => ""');
  }
  return dir;
}

test('a static segment outranks a dynamic one at the same position', async () => {
  const dir = await scaffold([
    'app/[org]/[repo]/page.js',
    'app/[user]/settings/page.js',
  ]);
  const table = await buildRouteTable(dir);
  const m = matchPage(table, '/acme/settings');
  assert.ok(m, 'a route matches /acme/settings');
  assert.equal(m.route.routeDir, '[user]/settings', 'the static-tail route wins over the all-dynamic one');
});

test('explicit static beats an optional catch-all base, and catch-all is last', async () => {
  const dir = await scaffold([
    'app/docs/page.js',
    'app/docs/[[...slug]]/page.js',
    'app/docs/intro/page.js',
    'app/[...all]/page.js',
  ]);
  const table = await buildRouteTable(dir);
  assert.equal(matchPage(table, '/docs').route.routeDir, 'docs', 'explicit /docs beats the optional catch-all base');
  assert.equal(matchPage(table, '/docs/intro').route.routeDir, 'docs/intro', 'explicit static beats the catch-all');
  assert.equal(matchPage(table, '/docs/a/b').route.routeDir, 'docs/[[...slug]]', 'the scoped catch-all takes the deep path');
  assert.equal(matchPage(table, '/random').route.routeDir, '[...all]', 'the root catch-all takes the leftover');
});

test('ordering is deterministic regardless of input order (no fs-walk dependence)', () => {
  const mk = (routeDir, isCatchAll = false) => ({ routeDir, isCatchAll });
  const routes = [
    mk('[org]/[repo]'), mk('[user]/settings'), mk('docs/intro'),
    mk('[...all]', true), mk('docs/[[...slug]]', true), mk('blog/[id]'),
  ];
  const order1 = [...routes].sort(compareSpecificity).map((r) => r.routeDir);
  const order2 = [...routes].reverse().sort(compareSpecificity).map((r) => r.routeDir);
  const order3 = [routes[3], routes[0], routes[5], routes[1], routes[4], routes[2]].sort(compareSpecificity).map((r) => r.routeDir);
  assert.deepEqual(order1, order2, 'same order regardless of starting order');
  assert.deepEqual(order1, order3, 'same order for a third permutation');
  assert.ok(order1.indexOf('[user]/settings') < order1.indexOf('[org]/[repo]'), 'static-tail dynamic before all-dynamic');
  assert.ok(order1.indexOf('docs/intro') < order1.indexOf('[...all]'), 'static before catch-all');
  assert.ok(order1.indexOf('blog/[id]') < order1.indexOf('[...all]'), 'dynamic before catch-all');
});

test('a genuine same-specificity tie resolves by an alphabetical key, not walk order', () => {
  const a = { routeDir: '[zeta]/[two]', isCatchAll: false };
  const b = { routeDir: '[alpha]/[two]', isCatchAll: false };
  // Identical kinds [1,1] and length: the documented deterministic tiebreak is
  // alphabetical routeDir, so the result never depends on insertion order.
  assert.ok(compareSpecificity(a, b) > 0, 'zeta sorts after alpha');
  assert.ok(compareSpecificity(b, a) < 0, 'and the reverse is consistent');
});

test('counterfactual: the old 3-bucket score tied the two depth-2 dynamic routes', () => {
  // Old dynScore: static=1, dynamic=2, catch-all=3. Both /[org]/[repo] and
  // /[user]/settings scored 2 (they have params), so a stable sort left them in
  // fs-walk order. The new comparator distinguishes them by positional kind.
  const oldDynScore = (r) => (r.isCatchAll ? 3 : (/\[/.test(r.routeDir) ? 2 : 1));
  const a = { routeDir: '[org]/[repo]', isCatchAll: false };
  const b = { routeDir: '[user]/settings', isCatchAll: false };
  assert.equal(oldDynScore(a), oldDynScore(b), 'the old score tied them (the bug)');
  assert.ok(compareSpecificity(a, b) > 0, 'the new comparator puts [user]/settings first');
});
