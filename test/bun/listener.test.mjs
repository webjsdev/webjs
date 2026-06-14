/**
 * Run the cross-runtime LISTENER parity check (#511) under WHICHEVER runtime
 * executes the test suite. Picked up by the root `node --test` runner, so
 * `npm test` exercises the node:http shell (`startNodeListener`); CI runs
 * `bun test/bun/listener.mjs` separately for the Bun.serve shell. The parity
 * script is a plain assert file (`listener.mjs`, not `*.test.mjs`, so the runner
 * does not double-run it); importing it boots a real server, exercises it, and
 * throws on any failure.
 */
import { test } from 'node:test';

test('webjs serves SSR + route + SSE + WebSocket over a real socket on this runtime (#511)', async () => {
  await import('./listener.mjs');
});
