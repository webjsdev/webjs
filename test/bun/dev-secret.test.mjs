/**
 * Run the cross-runtime generated-dev-secret proof (#1686) under WHICHEVER
 * runtime executes the suite. Picked up by the root `node --test` runner;
 * `node scripts/run-bun-tests.js` re-runs it under `bun`. Importing the plain
 * assert script runs it and throws on any failure.
 */
import { test } from 'node:test';

test('session() with no secret in dev signs with a generated .webjs/dev-secret on this runtime (#1686)', async () => {
  await import('./dev-secret.mjs');
});
