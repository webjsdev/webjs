/**
 * Run the cross-runtime FileStore streaming proof (#509) under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner (so `npm test`
 * exercises the Node path); CI also runs `bun test/bun/file-storage.mjs` for the
 * Bun path. The proof is a plain assert script (`file-storage.mjs`, not
 * `*.test.mjs`, so the runner does not double-run it); importing it runs it and
 * throws on any failure.
 */
import { test } from 'node:test';

test('FileStore put/get round-trips and cleans up a mid-stream failure on this runtime (#509)', async () => {
  await import('./file-storage.mjs');
});
