/**
 * Run the cross-runtime search metadata proof (#1564) under whichever runtime
 * executes the suite; CI runs `bun test/bun/seo-metadata.mjs` for the Bun shell.
 */
import { test } from 'node:test';

test('search and share metadata reach crawlers on this runtime (#1564)', async () => {
  await import('./seo-metadata.mjs');
});
