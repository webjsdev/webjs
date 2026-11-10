/**
 * Run the cross-runtime lit directive proof under WHICHEVER runtime executes
 * the suite. Picked up by the root `node --test` runner (so `npm test`
 * exercises the Node path); CI also runs `bun test/bun/lit-directives.mjs` for
 * the Bun path. Importing the plain assert script runs it and throws on any
 * failure.
 */
import { test } from 'node:test';

test('lit directive surface renders identically on this runtime', async () => {
  await import('./lit-directives.mjs');
});
