/**
 * Run the cross-runtime binding-prefix dispatch proof (#784) under WHICHEVER
 * runtime executes the suite. Picked up by the root `node --test` runner (so
 * `npm test` exercises the Node path); CI also runs `bun test/bun/binding-prefixes.mjs`
 * for the Bun path. The proof is a plain assert script (`binding-prefixes.mjs`,
 * not `*.test.mjs`, so the runner does not double-run it); importing it runs it
 * and throws on any failure.
 */
import { test } from 'node:test';

test('template binding-prefix dispatch renders identically on this runtime (#784)', async () => {
  await import('./binding-prefixes.mjs');
});
