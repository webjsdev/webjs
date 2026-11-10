/**
 * Run the cross-runtime unquoted-attribute proof (#1686) under WHICHEVER
 * runtime executes the suite. Picked up by the root `node --test` runner; CI
 * also runs `bun test/bun/ssr-unquoted-attr.mjs` for the Bun path. Importing
 * the plain assert script runs it and throws on any failure.
 */
import { test } from 'node:test';

test('SSR quotes an unquoted value holding a hole and refuses a forged template on this runtime (#1686)', async () => {
  await import('./ssr-unquoted-attr.mjs');
});
