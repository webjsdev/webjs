/**
 * Run the cross-runtime unserved-file watch check under whichever runtime runs
 * the suite (`npm test` on Node; CI runs the .mjs under Bun too).
 */
import { test } from 'node:test';

test('webjs dev does not reload for dev.log, coverage/ or gitignored paths on this runtime', { timeout: 120_000 }, async () => {
  await import('./dev-ignore-unserved.mjs');
});
