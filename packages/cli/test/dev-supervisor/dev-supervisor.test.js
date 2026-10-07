/**
 * Unit tests for the `webjs dev` reload-supervisor planner (issue #514).
 *
 * The bug: on Bun, `webjs dev` re-exec'd under `node --watch` (a Node-only
 * flag) and relied on the dev re-import's `?t=` cache-bust query, which Bun
 * ignores (it keys its module cache by path), so an edit to a re-imported
 * module stayed STALE on Bun. The fix re-execs under `bun --hot` on Bun, whose
 * file-watching cache invalidation makes the dev re-import pick up the edit.
 *
 * `bun --hot` then turned out not to watch a file a `Bun.plugin` `onLoad`
 * served (#1550): every `'use server'` module, and with source locations on
 * every app module, so their edits were never reloaded. On Bun the supervisor
 * now also restarts the child, for exactly those paths.
 *
 * These tests prove the planner's branch logic: Bun yields `bun --hot` plus a
 * restart for plugin-served paths, Node yields a supervised child that
 * restarts on every change (never `node --watch`, #1521), `--no-hot` opts out
 * on either runtime, and neither branch emits the `--watch` flags.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { planDevSupervisor, sourceLocationsOn } from '../../lib/dev-supervisor.js';

const ARGV = ['/path/to/webjs.js', 'dev', '--port', '8080'];
const WATCH = {
  watchDirs: ['app', 'components', 'modules', 'lib', 'actions'],
  watchFiles: [
    'middleware.ts', 'middleware.js', 'middleware.mts', 'middleware.mjs',
    // The boot hooks run once per process, so an edit restarts it (#1575).
    'instrumentation.ts', 'instrumentation.js', 'instrumentation.mts', 'instrumentation.mjs',
    'env.ts', 'env.js', 'env.mts', 'env.mjs',
  ],
};

test('Bun runs the child under `bun --hot` and restarts it for plugin-served paths (#1550)', () => {
  const plan = planDevSupervisor({ isBun: true, argv: ARGV, noHot: false });
  assert.ok(plan.mode === 'supervise');
  assert.deepEqual(plan.args, ['--hot', ...ARGV]);
  assert.equal(plan.restartOnChange, true);
  assert.deepEqual({ watchDirs: plan.watchDirs, watchFiles: plan.watchFiles }, WATCH);
  // A 'use server' module is served by the seed plugin, which bun --hot never
  // watches; everything else bun --hot reloads in place.
  assert.equal(plan.restartFor('modules/todos/actions/add.server.ts'), true);
  assert.equal(plan.restartFor('app/page.ts'), false);
  assert.equal(plan.restartFor('components/card.js'), false);
  // The boot hooks never reload in place.
  assert.equal(plan.restartFor('instrumentation.ts'), true);
  assert.equal(plan.restartFor('env.ts'), true);
});

test('a Bun child that reloads in place narrows the restarts to the boot hooks (#1575)', () => {
  const plan = planDevSupervisor({ isBun: true, argv: ARGV, noHot: false, sourceLocations: true });
  assert.ok(plan.mode === 'supervise' && plan.inPlaceRestartFor);
  for (const p of ['modules/todos/actions/add.server.ts', 'app/page.ts', 'components/card.js']) {
    assert.equal(plan.inPlaceRestartFor(p), false, p);
  }
  for (const p of ['instrumentation.ts', 'instrumentation.mjs', 'env.ts', 'env.js']) assert.equal(plan.inPlaceRestartFor(p), true, p);
  // Only at the app root: a nested file of the same name is an ordinary module.
  assert.equal(plan.inPlaceRestartFor('lib/env.ts'), false);
});

test('with source locations on, every app module restarts the Bun child (#1550)', () => {
  const plan = planDevSupervisor({ isBun: true, argv: ARGV, noHot: false, sourceLocations: true });
  assert.ok(plan.mode === 'supervise');
  for (const p of ['app/page.ts', 'components/card.js', 'lib/x.mts', 'modules/a/b.server.ts']) assert.equal(plan.restartFor(p), true, p);
  assert.equal(plan.restartFor('app/styles.css'), false);
});

test('sourceLocationsOn: the env var wins, else the app config', () => {
  assert.equal(sourceLocationsOn({ WEBJS_SOURCE_LOCATIONS: '1' }, false), true);
  assert.equal(sourceLocationsOn({ WEBJS_SOURCE_LOCATIONS: 'true' }, false), true);
  assert.equal(sourceLocationsOn({ WEBJS_SOURCE_LOCATIONS: '0' }, true), false);
  assert.equal(sourceLocationsOn({}, true), true);
  assert.equal(sourceLocationsOn({}, 'yes'), false);
  assert.equal(sourceLocationsOn({}, undefined), false);
});

test('Bun branch NEVER emits the Node-only watch flags (the #514 mismatch)', () => {
  // The counterfactual: the old code passed `--watch` / `--watch-path` to Bun,
  // which Bun does not understand.
  const plan = planDevSupervisor({ isBun: true, argv: ARGV, noHot: false });
  assert.ok(plan.mode === 'supervise');
  for (const flag of ['--watch', '--watch-preserve-output', '--watch-path']) {
    assert.ok(!plan.args.includes(flag), `Bun args must not include ${flag}`);
  }
});

test('Node restarts the child on a change, and never runs it under `node --watch` (#1521)', () => {
  // `node --watch` crashed on the first watcher error it could not handle (an
  // EACCES on a temp file another user created) and never came back. The
  // supervisor owns the watching now, so the child's argv is the plain script.
  const plan = planDevSupervisor({ isBun: false, argv: ARGV, noHot: false });
  assert.deepEqual(plan, { mode: 'supervise', args: [...ARGV], restartOnChange: true, ...WATCH });
  for (const flag of ['--watch', '--watch-preserve-output', '--watch-path']) {
    assert.ok(!plan.args.includes(flag), `Node args must not include ${flag}`);
  }
});

test('`--no-hot` opts out of the supervisor on Bun (run in-process)', () => {
  const plan = planDevSupervisor({ isBun: true, argv: ARGV, noHot: true });
  assert.deepEqual(plan, { mode: 'inline' });
});

test('`--no-hot` opts out of the supervisor on Node (run in-process)', () => {
  const plan = planDevSupervisor({ isBun: false, argv: ARGV, noHot: true });
  assert.deepEqual(plan, { mode: 'inline' });
});

test('the watched middleware extensions match the ones the server loads', () => {
  // The server resolves a root middleware from four extensions. If this list
  // is narrower, an app can have a middleware that LOADS but never restarts
  // the dev server when edited, which is the quiet half of the bug where a
  // root `middleware.ts` was loaded by neither. Read from the server source
  // rather than restated, so the two cannot drift apart silently.
  // `dev.js` is a barrel over `dev/` now, so read the barrel AND every module
  // beneath it. Reading only the barrel would leave this guard unable to find
  // the declaration at all, which is a silent pass into a vacuous assertion
  // rather than the drift check it is meant to be.
  const serverSrc = join(dirname(fileURLToPath(import.meta.url)), '../../../server/src');
  const devDir = join(serverSrc, 'dev');
  const files = [join(serverSrc, 'dev.js')];
  if (existsSync(devDir)) {
    for (const e of readdirSync(devDir, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.js')) files.push(join(devDir, e.name));
    }
  }
  const src = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const m = src.match(/const ROOT_MIDDLEWARE_FILES = \[([^\]]+)\]/);
  assert.ok(m, 'the server declares its root-middleware candidates in one place');
  const serverExts = m[1].match(/'([^']+)'/g).map((q) => q.slice(1, -1));

  const plan = planDevSupervisor({ isBun: false, argv: ARGV, noHot: false });
  assert.ok(plan.mode === 'supervise');
  const watched = plan.watchFiles.filter((a) => a.startsWith('middleware.'));

  assert.deepEqual(
    [...watched].sort(),
    [...serverExts].sort(),
    'every extension the server loads must also be watched in dev',
  );
});

test('the supervisor narrows to the in-place restarts only after the child announces it (#1575)', async () => {
  const { inPlaceRestarts, HOT_IN_PLACE_MESSAGE } = await import('../../lib/dev-reload.js');
  const plan = planDevSupervisor({ isBun: true, argv: ARGV, noHot: false });
  assert.ok(plan.mode === 'supervise');
  const r = inPlaceRestarts(plan);
  const action = 'modules/todos/actions/add.server.ts';
  // An older server never announces, so it keeps the restart it needs.
  assert.equal(r.restartFor(action), true);
  r.onMessage({ webjs: 'something-else' });
  assert.equal(r.restartFor(action), true);
  r.onMessage({ webjs: HOT_IN_PLACE_MESSAGE });
  assert.equal(r.restartFor(action), false);
  assert.equal(r.restartFor('instrumentation.ts'), true);
  // A new child starts un-announced again.
  r.reset();
  assert.equal(r.restartFor(action), true);
});

test('the in-place IPC message matches the one @webjsdev/server sends (#1575)', async () => {
  const cli = await import('../../lib/dev-reload.js');
  const server = await import('../../../server/src/dev/hot-host.js');
  assert.equal(cli.HOT_IN_PLACE_MESSAGE, server.HOT_IN_PLACE_MESSAGE);
});

test('the Bun child runs with the transpiler cache off; Node gets no extra env', () => {
  // Bun's on-disk transpiler cache keys a large module by content and bakes in
  // the absolute paths the dev alias resolver returned, so another checkout of
  // the same file imports from the first one. The child must never write it.
  const bun = planDevSupervisor({ isBun: true, argv: ARGV, noHot: false });
  assert.deepEqual(bun.env, { BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0' });
  const node = planDevSupervisor({ isBun: false, argv: ARGV, noHot: false });
  assert.equal(node.env, undefined);
});
