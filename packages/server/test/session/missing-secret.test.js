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
  const saved = process.env.AUTH_SECRET;
  delete process.env.AUTH_SECRET;
  try {
    assert.throws(() => createAuth({ providers: [] }), /AUTH_SECRET in \.env/);
  } finally {
    if (saved !== undefined) process.env.AUTH_SECRET = saved;
  }
});

test('createAuth() reads AUTH_SECRET when no secret is passed, as Auth.js does', async () => {
  // Two agents wrote createAuth({ secret: process.env.AUTH_SECRET }) and hit a
  // string | undefined type error; Auth.js reads the variable itself.
  const saved = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'from-the-environment-0123456789';
  try {
    const { signIn } = createAuth({ providers: [{ id: 'credentials', type: 'credentials', authorize: async () => ({ id: '1' }) }] });
    const res = await signIn('credentials', {}, { redirectTo: '/x' });
    assert.equal(res.status, 302, 'signs a session with the environment secret');
    assert.match(res.headers.get('set-cookie') || '', /webjs\.auth=/);
  } finally {
    if (saved === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = saved;
  }
});
