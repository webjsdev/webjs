/**
 * Run the cross-runtime custom directive proof under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner; CI also runs
 * `bun test/bun/custom-directive.mjs` for the Bun path.
 */
import { test } from 'node:test';

test('a custom directive renders identically at SSR on this runtime', async () => {
  await import('./custom-directive.mjs');
});
