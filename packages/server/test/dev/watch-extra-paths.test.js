import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { readDevWatchPathsFromApp } from '../../src/dev.js';

// #894: the recursive fs.watch on the appDir cannot see content the app reads
// from OUTSIDE its tree (the website renders posts from a repo-root `blog/`
// sibling of the app), so editing that content never live-reloads.
// `webjs.dev.watch` declares extra roots the watcher also follows.

async function appWith(webjs) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-devwatch-'));
  const pkg = webjs === undefined ? {} : { webjs };
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
  return dir;
}

test('reads webjs.dev.watch and resolves entries to absolute paths (escaping the appDir)', async () => {
  const dir = await appWith({ dev: { watch: ['../blog', '../shared-data'] } });
  const got = await readDevWatchPathsFromApp(dir);
  assert.deepEqual(got, [resolve(dir, '../blog'), resolve(dir, '../shared-data')]);
});

test('an app with no config watches only its appDir (empty extra list)', async () => {
  assert.deepEqual(await readDevWatchPathsFromApp(await appWith(undefined)), []);
  assert.deepEqual(await readDevWatchPathsFromApp(await appWith({ dev: {} })), []);
  assert.deepEqual(await readDevWatchPathsFromApp(await appWith({ dev: { watch: [] } })), []);
});

test('drops non-string / blank entries and de-dupes', async () => {
  const dir = await appWith({ dev: { watch: ['../blog', '', '   ', 42, '../blog', null] } });
  assert.deepEqual(await readDevWatchPathsFromApp(dir), [resolve(dir, '../blog')]);
});

test('skips the appDir itself and any ancestor/descendant overlap (already watched)', async () => {
  const dir = await appWith({ dev: { watch: ['.', '..', './sub', '../blog'] } });
  // '.' is the appDir, '..' is an ancestor, './sub' is a descendant: all elided.
  // Only the sibling '../blog' survives.
  assert.deepEqual(await readDevWatchPathsFromApp(dir), [resolve(dir, '../blog')]);
});

test('an unreadable / missing package.json yields no extra paths (never throws)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-devwatch-nopkg-'));
  assert.deepEqual(await readDevWatchPathsFromApp(dir), []);
});

test('a garbage webjs.dev.watch value is ignored, not crashed on', async () => {
  const dir = await appWith({ dev: { watch: 'blog' } }); // string, not array
  assert.deepEqual(await readDevWatchPathsFromApp(dir), []);
});

// Sanity that a real declared sibling that EXISTS is returned (the caller then
// filters by existence; here we just prove the path resolution is real).
test('a declared sibling dir that exists resolves correctly', async () => {
  const dir = await appWith({ dev: { watch: ['../content'] } });
  await mkdir(resolve(dir, '../content'), { recursive: true });
  const got = await readDevWatchPathsFromApp(dir);
  assert.deepEqual(got, [resolve(dir, '../content')]);
});
