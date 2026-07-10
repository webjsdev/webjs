/**
 * Run the cross-runtime deploy-build-id check (#899) under whichever runtime
 * runs the suite. `npm test` covers Node; CI runs `bun test/bun/build-id-deploy.mjs`
 * for Bun. The behaviour script is a plain assert file (not `*.test.mjs`, so the
 * runner does not double-run it); importing it throws on any failure.
 */
import { test } from 'node:test';

test('the deploy fingerprint folds into the published build id on this runtime (#899)', async () => {
  await import('./build-id-deploy.mjs');
});
