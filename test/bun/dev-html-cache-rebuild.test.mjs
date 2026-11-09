/**
 * Run the cross-runtime dev HTML-cache eviction check (#1689) under WHICHEVER
 * runtime executes the test suite. Picked up by the root `node --test` runner;
 * CI runs `bun test/bun/dev-html-cache-rebuild.mjs` separately. The behaviour
 * script is a plain assert file (not `*.test.mjs`, so the runner does not
 * double-run it); importing it spawns the real CLI and throws on any failure.
 */
import { test } from 'node:test';

test('a dev rebuild evicts the server HTML cache on this runtime (#1689)', { timeout: 120_000 }, async () => {
  await import('./dev-html-cache-rebuild.mjs');
});
