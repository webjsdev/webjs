/**
 * Cross-runtime check of the dev watcher's polling fallback (#1689): when a
 * directory is out of file watches (ENOSPC), `watchTree` polls it instead of
 * dropping it, on Node and on Bun, whose `fs.watch` and `fs.statSync` are its
 * own implementations. Run under both:
 *
 *   node test/bun/dev-watch-poll.mjs
 *   bun  test/bun/dev-watch-poll.mjs
 *
 * The limit is simulated through `watchTree`'s injected `watchFn` for one
 * directory while the rest use the runtime's real `fs.watch`. A plain assert
 * script (not node:test) so the SAME file runs on both runtimes.
 */
import assert from 'node:assert/strict';
import { watch, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { watchTree } from '../../packages/server/src/dev/watch-tree.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (pred()) return true; await sleep(10); }
  return pred();
}

const root = mkdtempSync(join(tmpdir(), 'webjs-watch-poll-'));
mkdirSync(join(root, 'app'));
mkdirSync(join(root, 'lib'));
const failDir = join(root, 'lib');
const events = [];
const fallbacks = [];
const close = watchTree(root, {
  ignore: () => false,
  onEvent: (p) => events.push(p),
  onError: () => {},
  onFallback: (name, err) => fallbacks.push([name, err.code]),
  watchFn: (path, a, b) => {
    if (path === failDir || path.startsWith(failDir + sep)) {
      throw Object.assign(new Error('ENOSPC: System limit for number of file watchers reached'), { code: 'ENOSPC', syscall: 'watch', path });
    }
    return b === undefined ? watch(path, a) : watch(path, a, b);
  },
  pollMs: 60,
});
try {
  await sleep(50);
  assert.deepEqual(fallbacks, [['lib', 'ENOSPC']], `the directory out of watches fell back to polling on ${runtime}`);
  writeFileSync(join(root, 'lib/util.ts'), 'x');
  assert.ok(await until(() => events.includes(join('lib', 'util.ts'))), `a polled edit arrived on ${runtime} (got ${JSON.stringify(events)})`);
  writeFileSync(join(root, 'app/page.ts'), 'x');
  assert.ok(await until(() => events.includes(join('app', 'page.ts'))), `the watched directory still reports on ${runtime}`);
  console.log(`OK  the dev watcher polls a directory that is out of file watches on ${runtime} (#1689)`);
} finally {
  close();
  rmSync(root, { recursive: true, force: true });
}
