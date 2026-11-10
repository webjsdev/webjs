/**
 * Run the cross-runtime route-report proof (#1686) under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner (Node path);
 * `node scripts/run-bun-tests.js` re-runs it under `bun`. The proof is a plain
 * assert script (not `*.test.mjs`), so importing it runs it.
 */
import { test } from 'node:test';

test('the route report is identical on this runtime (#1686)', async () => {
  await import('./route-report.mjs');
});
