/** Run the cross-runtime error-boundary sanitization proof on this runtime. */
import { test } from 'node:test';

test('production error boundaries see a generic message and a digest on this runtime', async () => {
  await import('./error-boundary-sanitize.mjs');
});
