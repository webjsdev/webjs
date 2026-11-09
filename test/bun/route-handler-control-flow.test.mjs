/**
 * Run the cross-runtime route-handler control-flow proof under whichever
 * runtime executes the suite (the Bun matrix runs it under `bun test`).
 */
import { test } from 'node:test';

test('route.ts redirect / notFound / auto HEAD + OPTIONS on this runtime', async () => {
  await import('./route-handler-control-flow.mjs');
});
