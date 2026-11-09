/** Run the cross-runtime env-file loading proof on this runtime. */
import { test } from 'node:test';

test('env files load in Next.js order on this runtime', async () => {
  await import('./env-files.mjs');
});
