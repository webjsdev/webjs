/** Run the cross-runtime action-redirect proof on this runtime. */
import { test } from 'node:test';

test('redirect() in an action answers as in Next.js on this runtime', async () => {
  await import('./action-redirect-rpc.mjs');
});
