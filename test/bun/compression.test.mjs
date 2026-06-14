/**
 * Run the cross-runtime compression proof (#517) under WHICHEVER runtime executes
 * the suite. The root `node --test` runner picks this up (so `npm test` exercises
 * the node:http shell); CI runs `bun test/bun/compression.mjs` for the Bun.serve
 * shell. The proof is a plain assert script (`compression.mjs`, not `*.test.mjs`),
 * so the runner does not double-run it and Bun's runner cannot mis-attribute its
 * intentional mid-stream error.
 */
import { test } from 'node:test';

test('webjs serves brotli and survives a mid-stream error on this runtime (#517)', async () => {
  await import('./compression.mjs');
});
