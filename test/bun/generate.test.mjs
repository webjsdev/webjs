/**
 * Run the cross-runtime `webjs generate` check (#1692) under WHICHEVER runtime
 * executes the test suite; CI runs `bun test/bun/generate.mjs` separately. The
 * behaviour script is a plain assert file (not `*.test.mjs`, so the runner
 * does not double-run it).
 */
import { test } from 'node:test';

test('generated model and authentication code passes its tests on this runtime (#1692)', { timeout: 300_000 }, async () => {
  await import('./generate.mjs');
});
