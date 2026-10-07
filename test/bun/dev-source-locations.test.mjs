/**
 * Run the cross-runtime dev source locations check (#1499) under WHICHEVER
 * runtime runs the suite. `npm test` exercises the Node load hook; CI runs
 * `bun test/bun/dev-source-locations.mjs` for the `Bun.plugin` one. The
 * behaviour script is a plain assert file (not `*.test.mjs`, so the runner does
 * not double-run it); importing it spawns the real CLI and throws on failure.
 */
import { test } from 'node:test';

test('dev source locations annotate SSR and served modules on this runtime (#1499)', { timeout: 120_000 }, async () => {
  await import('./dev-source-locations.mjs');
});
