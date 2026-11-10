/** Run the cross-runtime revalidatePath refresh-header proof on this runtime. */
import { test } from 'node:test';

test('revalidatePath in an RPC action answers x-webjs-refresh on this runtime', async () => {
  await import('./revalidate-path-refresh.mjs');
});
