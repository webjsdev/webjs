/**
 * Run the cross-runtime one-pass SSR renderer proof (#1646) under WHICHEVER
 * runtime executes the suite. Picked up by the root `node --test` runner (so
 * `npm test` exercises the Node path); CI also runs
 * `bun test/bun/ssr-one-pass-parity.mjs` for the Bun path. The proof is a
 * plain assert script (`ssr-one-pass-parity.mjs`, not `*.test.mjs`, so the
 * runner does not double-run it); importing it runs it and throws on any
 * failure.
 */
import { test } from 'node:test';

test('the one-pass SSR renderer emits the golden corpus byte-for-byte on this runtime (#1646)', async () => {
  await import('./ssr-one-pass-parity.mjs');
});
