/**
 * Run the cross-runtime Auth.js middleware proof (#1686) under WHICHEVER
 * runtime executes the suite. Picked up by the root `node --test` runner;
 * `node scripts/run-bun-tests.js` re-runs it under `bun`. Importing the plain
 * assert script runs it and throws on any failure.
 */
import { test } from 'node:test';

test('export { auth as middleware }, the sign-in origin check and the GET sign-out page on this runtime (#1686)', async () => {
  await import('./auth-middleware.mjs');
});
