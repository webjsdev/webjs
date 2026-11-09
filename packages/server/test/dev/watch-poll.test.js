/**
 * #1689: when the OS runs out of file watches (ENOSPC once the inotify limit is
 * reached, EMFILE for file descriptors), the dev watcher polls the directory
 * that failed instead of dropping it for the rest of the session.
 *
 * `watchTree` takes an injected `watchFn`, so the limit is simulated for one
 * directory while the others use the real `fs.watch`, and the poll interval is
 * shortened. These run against the real filesystem.
 *
 * COUNTERFACTUAL: without the fallback the failing directory is only reported
 * to `onError`, and the write below never arrives as an event.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watch, mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

import { watchTree } from '../../src/dev/watch-tree.js';
import { pollTree, isWatchLimitError } from '../../src/dev/watch-poll.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const POLL_MS = 60;

async function until(pred, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (pred()) return true; await sleep(10); }
  return pred();
}

function app() {
  const root = mkdtempSync(join(tmpdir(), 'webjs-watch-poll-'));
  mkdirSync(join(root, 'app'));
  mkdirSync(join(root, 'lib/deep'), { recursive: true });
  return root;
}

/** A `watchFn` that is out of watches for any path under `failDir`. */
function limitedWatch(failDir, code = 'ENOSPC') {
  return (path, a, b) => {
    if (path === failDir || path.startsWith(failDir + sep)) {
      throw Object.assign(new Error(`${code}: System limit for number of file watchers reached, watch '${path}'`), { code, syscall: 'watch', path });
    }
    return b === undefined ? watch(path, a) : watch(path, a, b);
  };
}

for (const code of ['ENOSPC', 'EMFILE']) {
  test(`a directory out of watches (${code}) is polled, reported once, and its edits still arrive`, async () => {
    const root = app();
    const events = [];
    const fallbacks = [];
    const errors = [];
    const close = watchTree(root, {
      ignore: () => false,
      onEvent: (p) => events.push(p),
      onError: (e) => errors.push(e),
      onFallback: (name, err) => fallbacks.push([name, err.code]),
      watchFn: limitedWatch(join(root, 'lib'), code),
      pollMs: POLL_MS,
    });
    try {
      await sleep(30);
      assert.deepEqual(fallbacks, [['lib', code]], 'onFallback names the directory, once');
      assert.deepEqual(errors, [], 'a watch limit is not reported as a per-path error');

      writeFileSync(join(root, 'lib/deep/util.ts'), 'x');
      assert.ok(await until(() => events.includes(join('lib', 'deep', 'util.ts')), POLL_MS * 2 + 200),
        `the polled directory reported the new file within two intervals (got ${JSON.stringify(events)})`);
      writeFileSync(join(root, 'lib/deep/util.ts'), 'longer');
      const n = events.length;
      assert.ok(await until(() => events.length > n), 'a change is reported');
      unlinkSync(join(root, 'lib/deep/util.ts'));
      const m = events.length;
      assert.ok(await until(() => events.length > m), 'a removal is reported');

      // The directory that still has watches keeps using them.
      writeFileSync(join(root, 'app/page.ts'), 'x');
      assert.ok(await until(() => events.includes(join('app', 'page.ts'))), 'the watched directory still reports');
      assert.equal(fallbacks.length, 1, 'still one fallback');
    } finally {
      close();
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('a root out of watches polls its direct entries and still follows a new directory', async () => {
  const root = app();
  const events = [];
  const fallbacks = [];
  const close = watchTree(root, {
    ignore: () => false,
    onEvent: (p) => events.push(p),
    onError: () => {},
    onFallback: (name) => fallbacks.push(name),
    watchFn: (path, a, b) => {
      if (path === root) throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC', syscall: 'watch', path });
      return b === undefined ? watch(path, a) : watch(path, a, b);
    },
    pollMs: POLL_MS,
  });
  try {
    await sleep(30);
    assert.deepEqual(fallbacks, [''], 'the root fallback is named as the empty path');
    writeFileSync(join(root, 'NOTES.md'), 'x');
    assert.ok(await until(() => events.includes('NOTES.md')), 'a root file is reported by the poll');
    mkdirSync(join(root, 'modules'));
    assert.ok(await until(() => events.includes('modules')), 'a new top-level dir is reported');
    await sleep(30);
    writeFileSync(join(root, 'modules/x.ts'), 'x');
    assert.ok(await until(() => events.includes(join('modules', 'x.ts'))), 'and is then watched for real');
  } finally {
    close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('any other watch error stays a per-path error, with no fallback', async () => {
  const root = app();
  const fallbacks = [];
  const errors = [];
  const close = watchTree(root, {
    ignore: () => false,
    onEvent: () => {},
    onError: (e) => errors.push(e.code),
    onFallback: (name) => fallbacks.push(name),
    watchFn: limitedWatch(join(root, 'lib'), 'EACCES'),
    pollMs: POLL_MS,
  });
  try {
    await sleep(30);
    assert.deepEqual(fallbacks, []);
    assert.ok(errors.includes('EACCES'));
  } finally {
    close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('pollTree reports adds, changes and removals once each, honours ignore, and stops on close', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-poll-tree-'));
  const events = [];
  const stop = pollTree(dir, { ignore: (rel) => rel.endsWith('.log'), onEvent: (p) => events.push(p), intervalMs: POLL_MS });
  try {
    writeFileSync(join(dir, 'a.ts'), 'x');
    writeFileSync(join(dir, 'dev.log'), 'x');
    assert.ok(await until(() => events.includes('a.ts')));
    await sleep(POLL_MS * 2);
    assert.deepEqual(events, ['a.ts'], 'reported once, the ignored file never');
    stop();
    writeFileSync(join(dir, 'b.ts'), 'x');
    await sleep(POLL_MS * 3);
    assert.deepEqual(events, ['a.ts'], 'nothing after close');
  } finally {
    stop();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('isWatchLimitError accepts ENOSPC and EMFILE only', () => {
  assert.equal(isWatchLimitError({ code: 'ENOSPC' }), true);
  assert.equal(isWatchLimitError({ code: 'EMFILE' }), true);
  assert.equal(isWatchLimitError({ code: 'EACCES' }), false);
  assert.equal(isWatchLimitError(null), false);
});
