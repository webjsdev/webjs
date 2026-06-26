/**
 * Run the cross-runtime transparent-install proof under whichever runtime runs
 * the suite. The root `node --test` runner picks this up (so `npm test`
 * exercises the Node path); CI runs `bun test/bun/transparent-install.mjs` for
 * the Bun path. The proof is a plain assert script (`transparent-install.mjs`,
 * not `*.test.mjs`) so the runner does not double-run it.
 */
import { test } from 'node:test';

test('Bun transparent auto-install decision + install helper work on this runtime', async () => {
  await import('./transparent-install.mjs');
});
