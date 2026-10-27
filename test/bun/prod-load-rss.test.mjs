/**
 * Run the cross-runtime prod load / settled-RSS guard (#1644) under WHICHEVER
 * runtime executes the suite. Picked up by the root `node --test` runner (so
 * `npm test` exercises the node:http shell); CI also runs
 * `bun test/bun/prod-load-rss.mjs` for the Bun.serve shell. The proof is a
 * plain assert script (not `*.test.mjs`, so the runner does not double-run
 * it); importing it runs it and throws on any failure. It drives 20,000
 * requests and then polls for up to a minute, so it is on the Bun runner's
 * denylist for `bun test`'s per-test timeout and runs there as the plain
 * script instead.
 */
import { test } from 'node:test';

test('a production server releases memory after a load burst on this runtime (#1644)', { timeout: 240_000 }, async () => {
  await import('./prod-load-rss.mjs');
});
