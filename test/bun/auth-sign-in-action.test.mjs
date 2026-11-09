/**
 * Run the Auth.js-style signIn proof under WHICHEVER runtime executes the
 * suite. Importing the assert script runs it and throws on any failure.
 */
import { test } from 'node:test';

test('signIn and signOut behave like Auth.js in a form action on this runtime', async () => {
  await import('./auth-sign-in-action.mjs');
});
