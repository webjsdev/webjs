/**
 * Run the cross-runtime light-DOM slot SSR projection proof (#1021) under
 * WHICHEVER runtime executes the suite. Picked up by the root `node --test`
 * runner (so `npm test` exercises the Node path); CI also runs
 * `bun test/bun/slot-ssr-parity.mjs` for the Bun path. The proof is a plain
 * assert script (`slot-ssr-parity.mjs`, not `*.test.mjs`, so the runner does
 * not double-run it); importing it runs it and throws on any failure.
 */
import { test } from 'node:test';

test('light-DOM slot SSR projection renders identically on this runtime (#1021)', async () => {
  await import('./slot-ssr-parity.mjs');
});
