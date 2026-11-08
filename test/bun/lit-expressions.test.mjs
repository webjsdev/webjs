import { test } from 'node:test';

test('Lit expression semantics match on this runtime (#1682)', async () => {
  await import('./lit-expressions.mjs');
});
