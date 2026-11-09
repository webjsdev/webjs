/**
 * A missing secret names the variable and where it goes. An agent building
 * sign-in on the scaffold read "requires secret option or SESSION_SECRET env
 * var" while the example env file marked a different variable required, and
 * had to work out which one session() wanted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { session } from '../../src/session.js';
import { createAuth } from '../../src/auth.js';

test('session() without a secret says to set SESSION_SECRET in .env', () => {
  const saved = process.env.SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  try {
    assert.throws(() => session(), /SESSION_SECRET in \.env/);
  } finally {
    if (saved !== undefined) process.env.SESSION_SECRET = saved;
  }
});

test('createAuth() without a secret says to set AUTH_SECRET in .env', () => {
  assert.throws(() => createAuth({ providers: [] }), /AUTH_SECRET in \.env/);
});
