/**
 * Run the Bun dev late re-run check (#1689) under WHICHEVER runtime executes
 * the test suite (a logged no-op on Node, which has no bun --hot re-run); CI
 * runs `bun test/bun/dev-late-rerun.mjs` separately. The behaviour script is a
 * plain assert file (not `*.test.mjs`, so the runner does not double-run it).
 */
import { test } from 'node:test';

test('a bun --hot re-run that lands after the poke fallback notifies again (#1689)', { timeout: 120_000 }, async () => {
  await import('./dev-late-rerun.mjs');
});
