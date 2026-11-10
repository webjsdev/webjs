/**
 * Run the cross-runtime browser module version check (#1689) under WHICHEVER
 * runtime executes the test suite. Picked up by the root `node --test` runner;
 * CI runs `bun test/bun/dev-hot-served-versions.mjs` separately. The behaviour
 * script is a plain assert file (not `*.test.mjs`, so the runner does not
 * double-run it); importing it spawns the real CLI and throws on any failure.
 */
import { test } from 'node:test';

test('webjs dev versions the served import of an edited browser module (#1689)', { timeout: 120_000 }, async () => {
  await import('./dev-hot-served-versions.mjs');
});
