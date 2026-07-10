/**
 * Run the cross-runtime app-source deploy-signal check (#899) under whichever
 * runtime runs the suite. `npm test` covers Node; CI runs
 * `bun test/bun/app-source-signal.mjs` for Bun. The behaviour script is a plain
 * assert file (not `*.test.mjs`, so the runner does not double-run it).
 */
import { test } from 'node:test';

test('the app-source deploy signal derives identically on this runtime (#899)', async () => {
  await import('./app-source-signal.mjs');
});
