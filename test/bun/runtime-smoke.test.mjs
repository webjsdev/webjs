/**
 * Run the cross-runtime smoke (#508) under WHICHEVER runtime executes the test
 * suite. Picked up by the root `node --test` runner, so `npm test` exercises the
 * Node path; CI runs `bun test/bun/smoke.mjs` separately for the Bun path. The
 * smoke is a plain assert script (`smoke.mjs`, not `*.test.mjs`, so the runner
 * does not double-run it); importing it executes it and throws on any failure.
 */
import { test } from 'node:test';

test('webjs boots, strips TypeScript, and round-trips a server action on this runtime (#508)', async () => {
  await import('./smoke.mjs');
});
