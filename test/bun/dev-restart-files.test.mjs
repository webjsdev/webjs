/**
 * Run the cross-runtime dev restart-files check (#1689) under WHICHEVER runtime
 * executes the test suite; CI runs `bun test/bun/dev-restart-files.mjs`
 * separately. The behaviour script is a plain assert file (not `*.test.mjs`, so
 * the runner does not double-run it).
 */
import { test } from 'node:test';

test('.env and package.json edits restart webjs dev once, with the new .env, on this runtime (#1689)', { timeout: 120_000 }, async () => {
  await import('./dev-restart-files.mjs');
});
