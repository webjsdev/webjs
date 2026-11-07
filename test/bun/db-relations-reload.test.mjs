/**
 * Run the cross-runtime schema-reload proof (#1664) under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner; the Bun path
 * runs as `bun test/bun/db-relations-reload.mjs` and through the
 * `scripts/run-bun-tests.js` matrix. Importing the script runs it and throws on
 * any failure.
 */
import { test } from 'node:test';

test('a schema edit reaches db.query without a restart on this runtime (#1664)', async () => {
  await import('./db-relations-reload.mjs');
});
