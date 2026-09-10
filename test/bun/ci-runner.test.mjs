/**
 * node:test wrapper so the cross-runtime proof in `ci-runner.mjs` runs under
 * the Node matrix too (the proof file is named `.mjs`, not `.test.mjs`, so the
 * runner does not double-run it). The CI bun job runs the same file under
 * `bun` directly.
 */
import { test } from 'node:test';

test('the webjs ci runner spawns, captures, fails, and interrupts identically on this runtime (#1471)', async () => {
  await import('./ci-runner.mjs');
});
