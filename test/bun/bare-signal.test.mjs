/**
 * Run the cross-runtime bare-signal SSR proof under WHICHEVER runtime executes
 * the suite. Picked up by the root `node --test` runner; CI also runs
 * `bun test/bun/bare-signal.mjs` for the Bun path.
 */
import { test } from 'node:test';

test('a bare signal in a template hole renders its value at SSR on this runtime', async () => {
  await import('./bare-signal.mjs');
});
