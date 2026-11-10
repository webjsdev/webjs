/**
 * Run the cross-runtime decorator-detection proof under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner (so
 * `npm test` exercises the Node path); CI also runs
 * `bun test/bun/decorator-detection.mjs` for the Bun path. Importing the plain
 * assert script runs it and throws on any failure.
 */
import { test } from 'node:test';

test('a Lit decorator is refused loudly with the WebJs fix on this runtime', async () => {
  await import('./decorator-detection.mjs');
});
