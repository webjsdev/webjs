/**
 * Run the bound form action proof under WHICHEVER runtime executes the suite.
 * Importing the assert script runs it and throws on any failure.
 */
import { test } from 'node:test';

test('a form bound with action.bind dispatches on this runtime', async () => {
  await import('./bound-form-action.mjs');
});
