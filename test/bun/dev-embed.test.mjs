/**
 * Run the cross-runtime dev embed bridge proof (#1498) under whichever runtime
 * executes the suite. `npm test` covers Node; `node scripts/run-bun-tests.js`
 * re-runs `test/bun/*.test.mjs` under Bun. The proof is the plain assert
 * script `dev-embed.mjs`; importing it runs it and throws on failure.
 */
import { test } from 'node:test';

test('dev embed bridge injects and allows framing identically on this runtime', async () => {
  await import('./dev-embed.mjs');
});
