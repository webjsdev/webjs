/**
 * Run the cross-runtime dev extra-watch check (#894) under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner, so `npm test`
 * exercises it on Node; CI runs `bun test/bun/dev-extra-watch.mjs` separately
 * for the `Bun.serve` shell. The behaviour script is a plain assert file
 * (`dev-extra-watch.mjs`, not `*.test.mjs`, so the runner does not double-run
 * it); importing it spawns the real CLI, edits an outside dir, and throws on
 * any failure.
 */
import { test } from 'node:test';

test('webjs dev live-reloads an edit to an outside webjs.dev.watch dir on this runtime (#894)', async () => {
  await import('./dev-extra-watch.mjs');
});
