/**
 * Run the cross-runtime dev status proof (#1664) under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner; the Bun path
 * runs as `bun test/bun/dev-status.mjs` and through the
 * `scripts/run-bun-tests.js` matrix. Importing the script runs it and throws on
 * any failure.
 */
import { test } from 'node:test';

test('the dev status endpoint behaves identically on this runtime (#1664)', async () => {
  await import('./dev-status.mjs');
});
