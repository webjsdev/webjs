/**
 * Run the service-worker root-asset parity proof (#830) under WHICHEVER runtime
 * executes the suite. The root `node --test` runner picks this up (so `npm test`
 * exercises the node path); CI runs `bun test/bun/sw-root-assets.mjs` for Bun.
 * The proof is a plain assert script (`sw-root-assets.mjs`, not `*.test.mjs`) so
 * the runner does not double-run it.
 */
import { test } from 'node:test';

test('service-worker root assets serve at the site root on this runtime (#830)', async () => {
  await import('./sw-root-assets.mjs');
});
