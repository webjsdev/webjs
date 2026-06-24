/**
 * Run the cross-runtime pin-rewrite proof (#685) under whichever runtime runs
 * the suite. The root `node --test` runner picks this up (so `npm test`
 * exercises the Node path); CI runs `bun test/bun/pin-rewrite.mjs` for the
 * Bun.Transpiler path. The proof is a plain assert script (`pin-rewrite.mjs`,
 * not `*.test.mjs`) so the runner does not double-run it.
 */
import { test } from 'node:test';

test('Bun zero-install version-pin rewrite works on this runtime (#685)', async () => {
  await import('./pin-rewrite.mjs');
});
