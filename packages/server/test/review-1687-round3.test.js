/**
 * The server-side findings of the owner's third review of PR #1687, each
 * pinned by a test (the array-item cleanup ones are browser tests in
 * packages/core/test/rendering/browser/array-part-cleanup.test.js).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAuth, Credentials } from '../src/auth.js';
import { withRequest, currentCookieStore } from '../src/context.js';
import { encodeFlash, decodeFlash } from '../src/action-flash.js';
import { declaredParamDefaults } from '../src/action-params.js';

const SECRET = 'review-1687-round3-secret-at-least-32-bytes';
const ORIGIN = 'https://app.example';

test('a flash signed in dev verifies even when .webjs cannot be written', async () => {
  const saved = { cwd: process.cwd(), W: process.env.WEBJS_SECRET, A: process.env.AUTH_SECRET, S: process.env.SESSION_SECRET, N: process.env.NODE_ENV };
  const dir = mkdtempSync(join(tmpdir(), 'webjs-flash-dev-'));
  // A file where the .webjs directory should be: the dev secret can never be persisted.
  writeFileSync(join(dir, '.webjs'), 'not a directory');
  delete process.env.WEBJS_SECRET; delete process.env.AUTH_SECRET; delete process.env.SESSION_SECRET;
  process.env.NODE_ENV = 'development';
  process.chdir(dir);
  try {
    const value = await encodeFlash({ id: 'h/fn', result: { success: false, n: 1 }, shown: false });
    const back = await decodeFlash(value);
    assert.ok(back, 'the flash signed on the 303 verifies on the next request');
  } finally {
    process.chdir(saved.cwd);
    rmSync(dir, { recursive: true, force: true });
    for (const [k, v] of [['WEBJS_SECRET', saved.W], ['AUTH_SECRET', saved.A], ['SESSION_SECRET', saved.S], ['NODE_ENV', saved.N]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test('a session the jwt callback ends on read has its cookie cleared', async () => {
  const auth = createAuth({
    secret: SECRET,
    providers: [Credentials({ authorize: async () => ({ id: '1', email: 'a@b.c' }) })],
    callbacks: { jwt: ({ trigger, token }) => (trigger === 'signIn' ? token : null) },
  });
  const res = await auth.handlers.POST(new Request(`${ORIGIN}/api/auth/signin/credentials`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN }, body: 'email=a%40b.c',
  }));
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  await withRequest(new Request(`${ORIGIN}/`, { headers: { cookie } }), async () => {
    assert.equal(await auth.auth(), null);
    const pending = [...(currentCookieStore()?.pending.values() || [])];
    const name = cookie.split('=')[0];
    assert.ok(pending.some((c) => c.startsWith(`${name}=;`) && /Max-Age=0/i.test(c)), `the session cookie is cleared: ${JSON.stringify(pending)}`);
  });
});

test('a default written inside a comment is not a default', () => {
  assert.deepEqual(declaredParamDefaults(async function a(prevState, formData /* = new FormData() */) { return [prevState, formData]; }), [false, false]);
});
