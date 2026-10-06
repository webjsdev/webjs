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

import { buildRouteTable, matchPage, matchApi, compareSpecificity } from '../../src/router.js';
import { createRequestHandler } from '../../src/dev.js';

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

test('explicit static beats an optional catch-all base; the root catch-all is the fallback', async () => {
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

test('a literal-prefixed catch-all outranks an all-dynamic route (specificity is positional, not catch-all-last)', async () => {
  // The catch-all kind is the lowest priority AT ITS POSITION, not a global
  // "always last" bucket: a literal first segment (`docs`) outranks a dynamic
  // one (`[org]`), so `/docs/x` must resolve to the scoped catch-all, NOT bind
  // org=docs, repo=x on the all-dynamic route.
  const dir = await scaffold([
    'app/[org]/[repo]/page.js',
    'app/docs/[[...slug]]/page.js',
  ]);
  const table = await buildRouteTable(dir);
  assert.equal(matchPage(table, '/docs/x').route.routeDir, 'docs/[[...slug]]', 'literal-prefixed catch-all wins over all-dynamic');
  assert.equal(matchPage(table, '/docs').route.routeDir, 'docs/[[...slug]]', 'the optional catch-all also takes /docs');
  const acme = matchPage(table, '/acme/repo');
  assert.equal(acme.route.routeDir, '[org]/[repo]', 'an unrelated 2-seg path still hits the all-dynamic route');
  assert.deepEqual(acme.params, { org: 'acme', repo: 'repo' }, 'and binds its params');
});

test('counterfactual: a global catch-all-last rule would shadow the literal-prefixed catch-all', () => {
  // The OLD coarse score bucketed every catch-all to 3 globally, so
  // `docs/[[...slug]]` (a catch-all) lost to `[org]/[repo]` (not a catch-all)
  // regardless of the literal `docs` prefix. The new positional comparator must
  // rank the literal-prefixed catch-all FIRST.
  const globalCatchAllLast = (r) => (r.isCatchAll ? 3 : (/\[/.test(r.routeDir) ? 2 : 1));
  const literalCatchAll = { routeDir: 'docs/[[...slug]]', isCatchAll: true };
  const allDynamic = { routeDir: '[org]/[repo]', isCatchAll: false };
  assert.ok(globalCatchAllLast(literalCatchAll) > globalCatchAllLast(allDynamic), 'the old rule wrongly ranked the catch-all last');
  assert.ok(compareSpecificity(literalCatchAll, allDynamic) < 0, 'the new comparator ranks the literal-prefixed catch-all first');
});

test('route groups and private folders do not affect specificity', () => {
  // `(group)` and `_private` segments are not URL segments, so they must be
  // stripped before comparing: a grouped/nested-private route sorts identically
  // to its bare URL-segment equivalent.
  const grouped = { routeDir: '(marketing)/[id]', isCatchAll: false };
  const bare = { routeDir: '[id]', isCatchAll: false };
  assert.equal(compareSpecificity(grouped, bare), grouped.routeDir < bare.routeDir ? -1 : 1,
    'grouped [id] ties bare [id] on specificity, falling to the alphabetical routeDir key only');
  // A static-tail grouped route still outranks an all-dynamic one positionally.
  const groupedStatic = { routeDir: '(app)/_internal/users/settings', isCatchAll: false };
  const allDynamic = { routeDir: '[a]/[b]', isCatchAll: false };
  assert.ok(compareSpecificity(groupedStatic, allDynamic) < 0,
    'users/settings (static after stripping the group + private) beats [a]/[b]');
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

// #1510: route handlers rank exactly like pages. They used to keep filesystem
// walk order, so a catch-all auth handler answered for its more specific
// siblings. Directory names are chosen so the catch-all sorts FIRST in a
// plain listing (`[` sorts before lowercase letters), which is the order that
// exposed it.
test('API routes rank by the same specificity as pages (#1510)', async () => {
  const dir = await scaffold([
    'app/api/auth/[...path]/route.js',
    'app/api/auth/callback/github/connect/route.js',
    'app/api/auth/callback/[provider]/route.js',
    'app/api/auth/session/route.js',
    'app/api/[...rest]/route.js',
  ]);
  const table = await buildRouteTable(dir);
  const at = (p) => matchApi(table, p).route.routeDir;
  assert.equal(at('/api/auth/callback/github/connect'), 'api/auth/callback/github/connect', 'the longest static route wins over the catch-all');
  assert.equal(at('/api/auth/callback/google'), 'api/auth/callback/[provider]', 'a dynamic segment beats a catch-all');
  assert.equal(at('/api/auth/session'), 'api/auth/session', 'a static leaf beats the catch-all');
  assert.equal(at('/api/auth/signin/github'), 'api/auth/[...path]', 'the scoped catch-all takes what is left under /api/auth');
  assert.equal(at('/api/other/thing'), 'api/[...rest]', 'the outer catch-all takes the rest');
});

test('API specificity holds through the request handler, dev and production alike (#1510)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-apispec-'));
  const files = {
    'app/api/auth/[...path]/route.js': 'export const GET = () => new Response("catch-all");',
    'app/api/auth/callback/github/connect/route.js': 'export const GET = () => new Response("connect");',
  };
  for (const [rel, body] of Object.entries(files)) {
    await mkdir(join(dir, rel, '..'), { recursive: true });
    await writeFile(join(dir, rel), body);
  }
  for (const dev of [true, false]) {
    const app = await createRequestHandler({ appDir: dir, dev });
    const hit = async (p) => (await app.handle(new Request('http://x' + p))).text();
    assert.equal(await hit('/api/auth/callback/github/connect'), 'connect', `the specific handler answers (dev=${dev})`);
    assert.equal(await hit('/api/auth/signin'), 'catch-all', `the catch-all still answers the rest (dev=${dev})`);
  }
});
