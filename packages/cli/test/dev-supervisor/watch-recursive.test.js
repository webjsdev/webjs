/**
 * The recursive watcher behind `webjs dev`'s restart supervisor and the
 * server's live reload (#1529). On Node 24 (Linux) `fs.watch(dir, { recursive:
 * true })` went deaf to a file once it had been REPLACED (`sed -i`, an
 * editor's save through a temp file, any atomic write): every later edit to it
 * was silent, so a deep-import edit never restarted the server and the browser
 * never reloaded. `watchRecursive` watches each directory instead on Linux
 * under Node. These tests run against the real filesystem; the replace-twice
 * test is the one that reds on Node 24 with the native recursive watcher.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, rmSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { watchRecursive, needsDirWalker } from '../../lib/watch-recursive.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (pred()) return true; await sleep(20); }
  return pred();
}

function tree(t) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-watch-recursive-'));
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'sub', 'f.js'), 'v0\n');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function start(dir, opts) {
  const events = [];
  const errors = [];
  const w = watchRecursive(dir, (_type, name) => events.push(name), opts);
  w.on('error', (e) => errors.push(e));
  return { w, events, errors };
}

test('the cli and server copies stay byte-identical', () => {
  const cli = readFileSync(resolve(__dirname, '../../lib/watch-recursive.js'), 'utf8');
  const server = readFileSync(resolve(__dirname, '../../../server/src/dev/watch-recursive.js'), 'utf8');
  assert.equal(cli, server, 'edit both copies of watch-recursive.js together');
});

test('the walker is used on Linux under Node only', () => {
  assert.equal(needsDirWalker({ platform: 'linux', isBun: false }), true);
  assert.equal(needsDirWalker({ platform: 'linux', isBun: true }), false);
  assert.equal(needsDirWalker({ platform: 'darwin', isBun: false }), false);
  assert.equal(needsDirWalker({ platform: 'win32', isBun: false }), false);
});

test('a file replaced again and again is still heard every time (#1529)', async (t) => {
  const dir = tree(t);
  const { w, events } = start(dir);
  t.after(() => w.close());
  await sleep(100);
  const f = join(dir, 'sub', 'f.js');
  const rel = join('sub', 'f.js');
  const edits = [
    ['sed -i', () => execFileSync('sed', ['-i', 's/v/x/', f])],
    ['sed -i again', () => execFileSync('sed', ['-i', 's/x/y/', f])],
    ['plain write after a replace', () => writeFileSync(f, 'v2\n')],
    ['rename over', () => { writeFileSync(f + '.tmp', 'v3\n'); renameSync(f + '.tmp', f); }],
    ['rename over again', () => { writeFileSync(f + '.tmp', 'v4\n'); renameSync(f + '.tmp', f); }],
    ['delete and recreate', async () => { rmSync(f); await sleep(50); writeFileSync(f, 'v5\n'); }],
    ['plain write after recreate', () => writeFileSync(f, 'v6\n')],
  ];
  for (const [name, edit] of edits) {
    events.length = 0;
    await edit();
    assert.ok(await until(() => events.includes(rel)), `${name}: no event for ${rel} (got ${JSON.stringify(events)})`);
  }
});

test('a subdirectory created or renamed in after start is followed, a removed one is dropped', async (t) => {
  const dir = tree(t);
  const { w, events } = start(dir);
  t.after(() => w.close());
  await sleep(50);
  mkdirSync(join(dir, 'sub', 'deep'));
  assert.ok(await until(() => events.includes(join('sub', 'deep'))));
  await sleep(50);
  writeFileSync(join(dir, 'sub', 'deep', 'a.js'), 'x');
  assert.ok(await until(() => events.includes(join('sub', 'deep', 'a.js'))), JSON.stringify(events));
  // A directory renamed into place reports under its NEW name.
  renameSync(join(dir, 'sub', 'deep'), join(dir, 'sub', 'moved'));
  await sleep(100);
  events.length = 0;
  writeFileSync(join(dir, 'sub', 'moved', 'b.js'), 'x');
  assert.ok(await until(() => events.includes(join('sub', 'moved', 'b.js'))), JSON.stringify(events));
  rmSync(join(dir, 'sub', 'moved'), { recursive: true });
  await sleep(100);
  events.length = 0;
  writeFileSync(join(dir, 'sub', 'f.js'), 'still here');
  assert.ok(await until(() => events.includes(join('sub', 'f.js'))), 'the parent keeps reporting after a child dir is removed');
});

test('an ignored subdirectory is never walked or reported', async (t) => {
  const dir = tree(t);
  mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true });
  const { w, events } = start(dir, { ignore: (rel) => /(^|[\\/])node_modules([\\/]|$)/.test(rel) });
  t.after(() => w.close());
  await sleep(50);
  writeFileSync(join(dir, 'node_modules', 'pkg', 'i.js'), 'x');
  writeFileSync(join(dir, 'sub', 'f.js'), 'x');
  assert.ok(await until(() => events.includes(join('sub', 'f.js'))));
  await sleep(100);
  assert.ok(!events.some((e) => e.includes('node_modules')), JSON.stringify(events));
});

test('a symlinked directory loop is watched once, not forever', async (t) => {
  const dir = tree(t);
  symlinkSync(dir, join(dir, 'sub', 'loop'));
  const { w, events } = start(dir);
  t.after(() => w.close());
  await sleep(50);
  writeFileSync(join(dir, 'sub', 'f.js'), 'x');
  assert.ok(await until(() => events.includes(join('sub', 'f.js'))));
});

test('a watch failure is emitted as an error, after the caller can listen, and never thrown', async (t) => {
  const dir = tree(t);
  mkdirSync(join(dir, 'a'));
  const failing = (path, ...rest) => {
    if (path.endsWith(`${'/'}a`) || path.endsWith('\\a')) {
      throw Object.assign(new Error('EACCES: permission denied, watch'), { code: 'EACCES', syscall: 'watch', path });
    }
    return /** @type {any} */ (globalThis).__realWatch(path, ...rest);
  };
  const { watch } = await import('node:fs');
  /** @type {any} */ (globalThis).__realWatch = watch;
  const { w, events, errors } = start(dir, { watchFn: /** @type {any} */ (failing), walker: true });
  t.after(() => w.close());
  assert.equal(errors.length, 0, 'held until the next tick');
  await sleep(10);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'EACCES');
  writeFileSync(join(dir, 'sub', 'f.js'), 'x');
  assert.ok(await until(() => events.includes(join('sub', 'f.js'))), 'the rest keeps being watched');
});

test('off the walker, the native recursive watcher is used unchanged', () => {
  const calls = [];
  const fake = (...args) => { calls.push(args); return { on() {}, close() {} }; };
  const cb = () => {};
  watchRecursive('/x', cb, { watchFn: /** @type {any} */ (fake), walker: false });
  assert.deepEqual(calls, [['/x', { recursive: true }, cb]]);
});
