/**
 * Run the cross-runtime route-modules-never-ship proof (#1686) under WHICHEVER
 * runtime executes the suite. Picked up by the root `node --test` runner (so
 * `npm test` exercises the Node path); CI reaches the Bun path through `node
 * scripts/run-bun-tests.js`, which auto-discovers `test/bun/*.test.mjs` and
 * re-runs them under `bun`. Importing the plain assert script runs it and
 * throws on any failure.
 */
import { test } from 'node:test';

test('route modules never ship to the browser on this runtime (#1686)', async () => {
  await import('./route-modules-server-only.mjs');
});
