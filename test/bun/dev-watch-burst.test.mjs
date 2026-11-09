/**
 * Run the cross-runtime same-millisecond burst check (#1689) under WHICHEVER
 * runtime executes the test suite. Picked up by the root `node --test` runner;
 * CI runs `bun test/bun/dev-watch-burst.mjs` separately. The behaviour script is
 * a plain assert file (not `*.test.mjs`, so the runner does not double-run it);
 * importing it spawns the real CLI and throws on any failure.
 */
import { test } from 'node:test';

test('webjs dev carries every file of a same-millisecond burst to the tab (#1689)', { timeout: 120_000 }, async () => {
  await import('./dev-watch-burst.mjs');
});
