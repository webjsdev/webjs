/**
 * Run the cross-runtime dev resilience check (#1521) under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner, so `npm test`
 * exercises it on Node; CI runs `bun test/bun/dev-watch-error.mjs` separately
 * for the `Bun.serve` shell. The behaviour script is a plain assert file
 * (`dev-watch-error.mjs`, not `*.test.mjs`, so the runner does not double-run
 * it); importing it spawns the real CLI and throws on any failure.
 */
import { test } from 'node:test';

test('webjs dev survives an unreadable watched file and restarts a crashed server on this runtime (#1521)', async () => {
  await import('./dev-watch-error.mjs');
});
