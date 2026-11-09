/**
 * Run the cross-runtime dev watcher polling fallback check (#1689) under
 * WHICHEVER runtime executes the test suite; CI runs
 * `bun test/bun/dev-watch-poll.mjs` separately. The behaviour script is a plain
 * assert file (not `*.test.mjs`, so the runner does not double-run it).
 */
import { test } from 'node:test';

test('the dev watcher polls a directory that is out of file watches on this runtime (#1689)', { timeout: 60_000 }, async () => {
  await import('./dev-watch-poll.mjs');
});
