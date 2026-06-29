/**
 * Run the cross-runtime listener-overhead proof (#756) under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner (so `npm test`
 * exercises the node:http shell); CI also runs `bun test/bun/listener-overhead.mjs`
 * for the Bun.serve shell. The proof is a plain assert script
 * (`listener-overhead.mjs`, not `*.test.mjs`, so the runner does not double-run
 * it); importing it runs it and throws on any failure.
 */
import { test } from 'node:test';

test('Bun listener overhead reductions behave identically on this runtime (#756)', async () => {
  await import('./listener-overhead.mjs');
});
