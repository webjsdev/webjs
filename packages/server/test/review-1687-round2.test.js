/**
 * The nine findings of the owner's second review of PR #1687, each pinned by
 * a test that fails without its fix.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAuth, Credentials, GitHub } from '../src/auth.js';
import { declaredParamDefaults } from '../src/action-params.js';
import { loadEnvFiles } from '../src/env-files.js';
import { encodeFlash } from '../src/action-flash.js';
import { compileMatcher, matchHas } from '../src/middleware-load.js';
import { html as staticHtml, unsafeStatic } from '../../core/src/static-html.js';

const SECRET = 'review-1687-round2-secret-at-least-32-bytes';
const ORIGIN = 'https://app.example';

/** A credentials sign-in through the auth routes. */
function credentialsSignIn(auth) {
  return auth.handlers.POST(new Request(`${ORIGIN}/api/auth/signin/credentials`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN }, body: 'email=a%40b.c',
  }));
}

test('a jwt callback returning null at sign-in denies it and writes no session cookie', async () => {
  const auth = createAuth({
    secret: SECRET,
    providers: [Credentials({ authorize: async () => ({ id: '1', email: 'a@b.c' }) })],
    callbacks: { jwt: ({ trigger, token }) => (trigger === 'signIn' ? null : token) },
    pages: { error: '/login' },
  });
  const res = await credentialsSignIn(auth);
  assert.equal(res.headers.get('location'), '/login?error=AccessDenied');
  assert.ok(!res.headers.getSetCookie().some((c) => /session-token=[^;]/.test(c)), 'no session cookie');
});

test('a jwt callback returning null on a read ends the session instead of throwing', async () => {
  let reads = 0;
  const auth = createAuth({
    secret: SECRET,
    providers: [Credentials({ authorize: async () => ({ id: '1', email: 'a@b.c' }) })],
    callbacks: { jwt: ({ trigger, token }) => { if (trigger === 'signIn') return token; reads++; return null; } },
  });
  const res = await credentialsSignIn(auth);
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const session = await auth.auth(new Request(`${ORIGIN}/`, { headers: { cookie } }));
  assert.equal(session, null);
  assert.equal(reads, 1);
});

test('an action with an optional second parameter is not a (prevState, formData) action', () => {
  assert.deepEqual(declaredParamDefaults(async function createPost(input, opts = {}) { return [input, opts]; }), [false, true]);
  assert.deepEqual(declaredParamDefaults(async (prevState = { ok: false }, formData) => [prevState, formData]), [true, false]);
  assert.deepEqual(declaredParamDefaults(async ({ a = 1 }, formData) => [a, formData]), [false, false]);
  assert.deepEqual(declaredParamDefaults(async (a, b = (x) => x >= 1) => [a, b]), [false, true]);
  assert.equal(declaredParamDefaults(Math.max), null);
});

test('an OAuth profile with no id is refused, never linked under an empty id, and the flow cookies are cleared', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const s = String(url);
    if (s.includes('access_token')) return Response.json({ access_token: 'AT' });
    if (s.includes('api.github.com/user')) return Response.json({ login: 'no-id', name: 'No Id' });
    throw new Error('unexpected fetch ' + s);
  };
  try {
    const auth = createAuth({ secret: SECRET, providers: [GitHub({ clientId: 'cid', clientSecret: 'cs' })], pages: { error: '/login' } });
    const start = await auth.handlers.GET(new Request('http://localhost/api/auth/signin/github'));
    const pairs = start.headers.getSetCookie().map((c) => c.split(';')[0]).filter((p) => !p.endsWith('='));
    const statePair = pairs.find((p) => /auth\.state=/.test(p));
    const state = decodeURIComponent(statePair.split('=')[1]).split('.')[0];
    const done = await auth.handlers.GET(new Request(`http://localhost/api/auth/callback/github?code=c&state=${state}`, { headers: { cookie: pairs.join('; ') } }));
    assert.equal(done.headers.get('location'), '/login?error=OAuthProfileParseError');
    const cleared = done.headers.getSetCookie();
    assert.ok(cleared.some((c) => /auth\.state=;/.test(c)), 'state cookie cleared');
    assert.ok(cleared.some((c) => /auth\.redirect=;/.test(c)), 'redirect cookie cleared');
    assert.ok(!cleared.some((c) => /session-token=[^;]/.test(c)), 'no session');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('${toString} and $constructor in a .env value are variables, not Object.prototype members', () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-env-proto-'));
  try {
    writeFileSync(join(dir, '.env'), 'A=x${toString}y\nB=$constructor\n');
    const env = {};
    loadEnvFiles(dir, 'development', env);
    assert.equal(env.A, 'xy');
    assert.equal(env.B, '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the flash is signed with SESSION_SECRET when that is the only secret set', async () => {
  const saved = { W: process.env.WEBJS_SECRET, A: process.env.AUTH_SECRET, S: process.env.SESSION_SECRET, N: process.env.NODE_ENV };
  delete process.env.WEBJS_SECRET; delete process.env.AUTH_SECRET;
  process.env.SESSION_SECRET = 'only-the-session-secret-is-set-here';
  process.env.NODE_ENV = 'production';
  const warn = console.warn; const warned = [];
  console.warn = (...a) => warned.push(a.join(' '));
  try {
    await encodeFlash({ id: 'h/fn', result: { success: true }, shown: false });
    assert.ok(!warned.some((w) => /per-process key/.test(w)), 'no per-process key warning');
  } finally {
    console.warn = warn;
    for (const [k, v] of [['WEBJS_SECRET', saved.W], ['AUTH_SECRET', saved.A], ['SESSION_SECRET', saved.S], ['NODE_ENV', saved.N]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
});

test('static-html keeps a bounded number of shapes, and a repeated shape keeps its identity', () => {
  const shape = (v) => staticHtml`<p class=${unsafeStatic(v)}>x</p>`.strings;
  const first = shape('keep');
  assert.equal(shape('keep'), first, 'same shape, same strings');
  for (let i = 0; i < 1100; i++) shape(`v${i}`);
  assert.notEqual(shape('keep'), first, 'the oldest shape was evicted');
});

test('a bad has/missing pattern fails when the matcher compiles, and a good one still matches', () => {
  assert.throws(() => compileMatcher([{ source: '/a', has: [{ type: 'header', key: 'x', value: '(' }] }], 'middleware.ts'), /not a valid pattern/);
  const req = new Request('https://app.example/a', { headers: { 'x-role': 'admin' } });
  assert.equal(matchHas(req, new URL(req.url), [{ type: 'header', key: 'x-role', value: 'ad.*' }]), true);
  assert.equal(matchHas(req, new URL(req.url), [{ type: 'header', key: 'x-role', value: 'user' }]), false);
});
