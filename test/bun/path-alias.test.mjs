/**
 * Run the cross-runtime `#` path-alias proof (#555) under WHICHEVER runtime
 * executes the suite. Picked up by the root `node --test` runner (Node path);
 * the CI `bun` job also runs `bun test/bun/path-alias.mjs` for the Bun path. The
 * proof is a plain assert script (not `*.test.mjs`), so importing it runs it.
 */
import { test } from 'node:test';

test('# path alias resolves natively on this runtime (#555)', async () => {
  await import('./path-alias.mjs');
});
