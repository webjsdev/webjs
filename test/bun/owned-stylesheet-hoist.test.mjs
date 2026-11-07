/**
 * Run the cross-runtime owned-stylesheet hoist proof (#1669) under WHICHEVER
 * runtime executes the suite. Picked up by the root `node --test` runner (so
 * `npm test` exercises the Node path); CI reaches the Bun path through
 * `node scripts/run-bun-tests.js`, which auto-discovers `test/bun/*.test.mjs`
 * and re-runs them under `bun`. The proof is a plain assert script
 * (`owned-stylesheet-hoist.mjs`), so importing it runs it and throws on any
 * failure.
 */
import { test } from 'node:test';

test('a nested layout stylesheet hoists into the head identically on this runtime', async () => {
  await import('./owned-stylesheet-hoist.mjs');
});
