/**
 * Run the cross-runtime replaced-file reload check (#1529) under WHICHEVER
 * runtime executes the suite. Picked up by the root `node --test` runner, so
 * `npm test` exercises it on Node; CI runs `bun test/bun/dev-watch-replaced.mjs`
 * separately. The behaviour script is a plain assert file, so the runner does
 * not double-run it; importing it spawns the real CLI and throws on failure.
 */
import { test } from 'node:test';

test('webjs dev hears every edit to a file that was replaced on this runtime (#1529)', async () => {
  await import('./dev-watch-replaced.mjs');
});
