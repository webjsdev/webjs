/**
 * The repo-root gallery app (gallery.webjs.dev): single-concept demos under
 * app/features/<name>, one whole example app under app/examples/todo, logic in
 * modules/<name>. The scaffold no longer ships it, so these assertions read the
 * gallery in place rather than a generated app.
 *
 * The todo query assertion guards the relational-query orderBy: relations v2
 * refuses the array form `[desc(col)]` (rc.5 throws `Unknown relational order
 * field`), so the query must use the object form `{ createdAt: 'desc' }`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GALLERY = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'gallery');
const read = (rel) => readFile(join(GALLERY, rel), 'utf8');

const FEATURES = [
  'routing', 'boundaries', 'auth', 'components', 'server-actions', 'optimistic-ui',
  'async-render', 'streaming', 'stream', 'suspense', 'directives', 'route-handler', 'forms',
  'metadata', 'caching', 'env', 'client-router', 'view-transitions', 'frames',
  'service-worker', 'websockets', 'broadcast', 'rate-limit', 'file-storage', 'sessions',
];
const EXAMPLE_APPS = ['todo'];

test('every feature demo and the example app has a route, and the nav lists it', async () => {
  const nav = await read('modules/gallery/nav.ts');
  for (const name of FEATURES) {
    assert.ok(existsSync(join(GALLERY, 'app', 'features', name, 'page.ts')), `app/features/${name}/page.ts`);
    assert.match(nav, new RegExp(`/features/${name}\\b`), `nav lists /features/${name}`);
  }
  for (const name of EXAMPLE_APPS) {
    assert.ok(existsSync(join(GALLERY, 'app', 'examples', name, 'page.ts')), `app/examples/${name}/page.ts`);
    assert.match(nav, new RegExp(`/examples/${name}\\b`), `nav lists /examples/${name}`);
  }
  // The nav is the one index: no feature directory exists that it omits.
  const dirs = readdirSync(join(GALLERY, 'app', 'features'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name);
  assert.deepEqual(dirs.sort(), [...FEATURES].sort(), 'FEATURES matches app/features/');
});

test('feature pages link no /examples/ route other than the todo app', async () => {
  for (const name of FEATURES) {
    const src = await read(`app/features/${name}/page.ts`);
    for (const m of src.matchAll(/\/examples\/[a-z-]+/g)) {
      assert.equal(m[0], '/examples/todo', `${name}: stale link ${m[0]}`);
    }
  }
});

test('the todo example is backed by a todos table and the object-form orderBy', async () => {
  const schema = await read('db/schema.server.ts');
  assert.match(schema, /table\('todos'/, 'the todos table');
  const dir = join(GALLERY, 'modules', 'todo', 'queries');
  const sources = await Promise.all(readdirSync(dir).map((f) => readFile(join(dir, f), 'utf8')));
  const all = sources.join('\n');
  assert.match(all, /orderBy:\s*\{\s*createdAt:\s*'desc'\s*\}/, 'object-form orderBy');
  assert.doesNotMatch(all, /orderBy:\s*\[/, 'never the array form relations v2 refuses');
});

test('the auth card wires a real, protected auth baseline', async () => {
  for (const rel of [
    'app/features/auth/login/page.ts',
    'app/features/auth/signup/page.ts',
    'app/features/auth/dashboard/page.ts',
    'app/features/auth/dashboard/middleware.ts',
    // createAuth hardcodes /api/auth/*, so its handler stays at the app root.
    'app/api/auth/[...path]/route.ts',
    'modules/auth/auth.server.ts',
    'modules/auth/password.server.ts',
    'test/auth/auth.test.ts',
  ]) assert.ok(existsSync(join(GALLERY, rel)), rel);
  assert.match(await read('db/schema.server.ts'), /passwordHash/, 'users carry the auth column');
});

test('the server-actions card demonstrates every HTTP-verb config export', async () => {
  // The reserved sibling exports (#488) are config, not module exports, so the
  // coverage manifest cannot gate them. Without this, `method` / `cache` /
  // `tags` / `invalidates` can silently drop out of the gallery.
  const readSrc = await read('modules/server-actions/queries/read-clock.server.ts');
  assert.match(readSrc, /^'use server';/, 'the cached read is an RPC action');
  assert.match(readSrc, /export const method = 'GET'/, 'declares the GET verb');
  assert.match(readSrc, /export const cache = \d+/, 'declares a cache window');
  assert.match(readSrc, /export const tags = /, 'tags the cached entry');

  const mutation = await read('modules/server-actions/actions/bump-clock.server.ts');
  assert.match(mutation, /export const invalidates = /, 'the mutation evicts the tag');
  assert.doesNotMatch(mutation, /export const method/, 'a mutation is POST by default');
  assert.match(mutation, /ActionResult</, 'the mutation returns the envelope');

  // A configured file with more than one callable function is a check error.
  for (const [label, src] of [['read', readSrc], ['mutation', mutation]]) {
    assert.equal([...src.matchAll(/^export async function /gm)].length, 1, `${label} keeps one function per configured file`);
  }
  // A copied `{ public: true }` on a per-user read is a cross-user leak, so the
  // gallery names the flag in prose but never in code an agent would paste.
  for (const src of [readSrc, mutation]) {
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.doesNotMatch(code, /public:\s*true/);
  }

  const card = await read('app/features/server-actions/page.ts');
  assert.match(card, /<clock-reader>/, 'the card mounts the demo');
  assert.match(card, /import '#modules\/server-actions\/components\/clock-reader\.ts'/, 'the card imports the demo module');
  assert.match(card, /public: true/, 'the card states the shared-cache safety rule');
});
