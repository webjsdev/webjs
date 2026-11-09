/**
 * Run the cross-runtime server-only component proof (#1686) under WHICHEVER
 * runtime executes the suite. Picked up by the root `node --test` runner;
 * `node scripts/run-bun-tests.js` re-runs it under `bun`. Importing the plain
 * assert script runs it and throws on any failure.
 */
import { test } from 'node:test';

test('a component in a .server file renders on the server and ships nothing on this runtime (#1686)', async () => {
  await import('./server-component.mjs');
});
