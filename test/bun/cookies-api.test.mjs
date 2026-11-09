/** Run the cross-runtime cookies() proof on this runtime. */
import { test } from 'node:test';

test('cookies() reads and writes like Next.js on this runtime', async () => {
  await import('./cookies-api.mjs');
});
