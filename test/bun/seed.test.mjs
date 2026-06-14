/**
 * Run the cross-runtime seeding check (#472, #529) under WHICHEVER runtime
 * executes the test suite. Picked up by the root `node --test` runner, so
 * `npm test` exercises the Node `module.registerHooks` install; CI runs
 * `bun test/bun/seed.mjs` separately for the `Bun.plugin` install. The behaviour
 * script is a plain assert file (`seed.mjs`, not `*.test.mjs`, so the runner does
 * not double-run it); importing it boots an app, renders, and throws on failure.
 */
import { test } from 'node:test';

test('SSR action seeding emits the seed block on this runtime (#472, #529)', async () => {
  await import('./seed.mjs');
});
