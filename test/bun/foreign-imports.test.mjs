/** Run the cross-runtime foreign-framework import proof on this runtime. */
import { test } from 'node:test';

test('next/react/lit imports are refused with the WebJs fix on this runtime', async () => {
  await import('./foreign-imports.mjs');
});
