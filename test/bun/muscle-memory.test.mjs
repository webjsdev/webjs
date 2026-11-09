/**
 * Run the muscle-memory corpus proof under WHICHEVER runtime executes the suite.
 * Picked up by the root `node --test` runner for the Node path; CI reaches the
 * Bun path through `node scripts/run-bun-tests.js`, which discovers
 * `test/bun/*.test.mjs` and re-runs them under `bun`. The proof itself is the
 * plain assert script `muscle-memory.mjs`; importing it runs it.
 */
import { test } from 'node:test';

test('the muscle-memory corpus renders and refuses the same way on this runtime', async () => {
  await import('./muscle-memory.mjs');
});
