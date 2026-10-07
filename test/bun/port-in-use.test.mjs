/**
 * Run the cross-runtime taken-port check (#1527) under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner, so `npm test`
 * exercises it on Node; CI runs `bun test/bun/port-in-use.mjs` separately for
 * the `Bun.serve` shell. The behaviour script is a plain assert file
 * (`port-in-use.mjs`, not `*.test.mjs`, so the runner does not double-run it).
 */
import { test } from 'node:test';

test('a second webjs dev/start on a taken port fails fast with the holder named on this runtime (#1527)', async () => {
  await import('./port-in-use.mjs');
});
