/**
 * Run the early-imported action identity proof under WHICHEVER runtime
 * executes the suite (the root `node --test` runner and the Bun matrix). The
 * proof is a plain assert script, so importing it runs it and throws on any
 * failure.
 */
import { test } from 'node:test';

test('an action imported before the handler binds to a form on this runtime', async () => {
  await import('./action-identity-import-order.mjs');
});
