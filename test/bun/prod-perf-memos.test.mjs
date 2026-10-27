/**
 * Run the cross-runtime production render memo proof (#1644) under WHICHEVER
 * runtime executes the suite. Picked up by the root `node --test` runner (so
 * `npm test` exercises the node:http shell); CI also runs
 * `bun test/bun/prod-perf-memos.mjs` for the Bun.serve shell. The proof is a
 * plain assert script (not `*.test.mjs`, so the runner does not double-run
 * it); importing it runs it and throws on any failure.
 */
import { test } from 'node:test';

test('production render memos serve identical bytes on this runtime (#1644)', async () => {
  await import('./prod-perf-memos.mjs');
});
