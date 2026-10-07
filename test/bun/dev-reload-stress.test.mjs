/**
 * Run the dev-server reload stress (#1575) under WHICHEVER runtime executes the
 * suite: `npm test` covers Node's restart-based reload, and CI runs
 * `bun test/bun/dev-reload-stress.mjs` for the `bun --hot` path the fix is
 * about. The behaviour lives in the plain assert script so both runtimes run
 * the same file.
 */
import { test } from 'node:test';

test('webjs dev settles on the current files under agent-style edits on this runtime (#1575)', { timeout: 240_000 }, async () => {
  await import('./dev-reload-stress.mjs');
});
