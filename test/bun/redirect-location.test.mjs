/**
 * Run the redirect-location proof under WHICHEVER runtime executes the suite:
 * the root `node --test` runner for Node, `node scripts/run-bun-tests.js` for
 * Bun. The proof is the plain assert script `redirect-location.mjs`.
 */
import { test } from 'node:test';

test('a non-Latin redirect target is answered at every site on this runtime', async () => {
  await import('./redirect-location.mjs');
});
