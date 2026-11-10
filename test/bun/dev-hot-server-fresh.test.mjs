/**
 * Run the cross-runtime in-place server freshness check (#1689) under
 * WHICHEVER runtime executes the test suite. Picked up by the root
 * `node --test` runner, so `npm test` exercises the Node resolve hook; CI runs
 * `bun test/bun/dev-hot-server-fresh.mjs` separately for `bun --hot`. The
 * behaviour script is a plain assert file (`dev-hot-server-fresh.mjs`, not
 * `*.test.mjs`, so the runner does not double-run it); importing it spawns the
 * real CLI, edits a module, and throws on any failure.
 */
import { test } from 'node:test';

test('webjs dev applies a server module edit in place on this runtime (#1689)', { timeout: 120_000 }, async () => {
  await import('./dev-hot-server-fresh.mjs');
});
