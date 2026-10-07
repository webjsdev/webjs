/**
 * Run the cross-runtime plugin-served dev reload check (#1550) under WHICHEVER
 * runtime executes the test suite. CI also runs
 * `bun test/bun/dev-reload-plugin-served.mjs` for the Bun path the fix is for.
 */
import { test } from 'node:test';

test('webjs dev reloads plugin-served modules with source locations on (#1550)', async () => {
  await import('./dev-reload-plugin-served.mjs');
});
