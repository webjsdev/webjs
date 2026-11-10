/**
 * Run the cross-runtime static-properties proof under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner (Node path);
 * the CI `bun` job runs `bun test/bun/static-properties.mjs` as its own step
 * for the Bun path. The proof is a plain assert script (not `*.test.mjs`), so
 * importing it runs it.
 */
import { test } from 'node:test';

test('static properties render and merge on this runtime', async () => {
  await import('./static-properties.mjs');
});
