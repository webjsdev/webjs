/** Run the cross-runtime CSS-import proof on this runtime. */
import { test } from 'node:test';

test('import of a .css file is refused with the <link> fix on this runtime', async () => {
  await import('./css-import.mjs');
});
