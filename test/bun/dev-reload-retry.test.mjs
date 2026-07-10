/**
 * Run the cross-runtime dev reload-retry check (#893) under WHICHEVER runtime
 * runs the suite. `npm test` exercises the node:http shell; CI runs
 * `bun test/bun/dev-reload-retry.mjs` for the `Bun.serve` shell. The behaviour
 * script is a plain assert file (`dev-reload-retry.mjs`, not `*.test.mjs`, so
 * the runner does not double-run it); importing it spawns the real CLI and
 * throws on any failure.
 */
import { test } from 'node:test';

test('dev SSE carries the retry reconnect hint on this runtime (#893)', async () => {
  await import('./dev-reload-retry.mjs');
});
