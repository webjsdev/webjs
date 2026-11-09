/**
 * Run the cross-runtime shadowRootOptions proof under WHICHEVER runtime
 * executes the suite. `npm test` covers the Node path; CI reaches the Bun path
 * through `node scripts/run-bun-tests.js`, which auto-discovers
 * `test/bun/*.test.mjs` and re-runs them under `bun`. Importing the plain
 * assert script runs it and throws on any failure.
 */
import { test } from 'node:test';

test('static shadowRootOptions renders identically on this runtime', async () => {
  await import('./shadow-root-options.mjs');
});
