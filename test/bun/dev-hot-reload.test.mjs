/**
 * Run the cross-runtime dev hot-reload check (#514) under WHICHEVER runtime
 * executes the test suite. Picked up by the root `node --test` runner, so
 * `npm test` exercises the `node --watch` supervisor; CI runs
 * `bun test/bun/dev-hot-reload.mjs` separately for the `bun --hot` supervisor
 * (the path that #514 actually fixes). The behaviour script is a plain assert
 * file (`dev-hot-reload.mjs`, not `*.test.mjs`, so the runner does not
 * double-run it); importing it spawns the real CLI, edits a module, and throws
 * on any failure.
 */
import { test } from 'node:test';

test('webjs dev hot-reloads a re-imported module edit on this runtime (#514)', async () => {
  await import('./dev-hot-reload.mjs');
});
