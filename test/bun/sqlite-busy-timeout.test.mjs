/**
 * Run the cross-runtime SQLite busy_timeout proof (#673) under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner (so `npm test`
 * exercises the Node / node:sqlite path); the CI `bun` job also runs
 * `bun test/bun/sqlite-busy-timeout.mjs` for the Bun / bun:sqlite path. The proof
 * is a plain assert script (`sqlite-busy-timeout.mjs`, not `*.test.mjs`, so the
 * runner does not double-run it); importing it runs it and throws on any failure.
 */
import { test } from 'node:test';

test('SQLite connection sets busy_timeout to avoid "database is locked" on this runtime (#673)', async () => {
  await import('./sqlite-busy-timeout.mjs');
});
