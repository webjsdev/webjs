/**
 * OAuth sign-in honours `redirectTo` (#1495).
 *
 * The redirect leg (`/api/auth/signin/<provider>`, POST form / JSON body or GET
 * query) validates `redirectTo` as a same-origin local path and stores it in a
 * short-lived signed cookie beside the state cookie; the callback lands there
 * and clears it. Anything that is not a local path (absolute, protocol-relative,
 * a backslash variant) is dropped and the callback lands on the default `/`. A
 * tampered cookie fails its signature and is ignored the same way.
 *
 * Covered twice: directly against `createAuth().handlers` (every validator
 * case), and end to end through the real `handle()` pipeline of a fixture app,
 * which is how an app actually mounts the auth route.
 */
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createAuth, GitHub } from '../../src/auth.js';
import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_URL = JSON.stringify(pathToFileURL(resolve(__dirname, '../../src/auth.js')).toString());

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Fake GitHub token + profile endpoints so the callback completes. */
function fakeGitHub() {
  globalThis.fetch = async (url) => {
    const s = String(url);
    if (s.includes('github.com/login/oauth/access_token')) {
      return Response.json({ access_token: 'AT' });
    }
    if (s.includes('api.github.com/user')) {
      return Response.json({ id: 7, login: 'octo', name: 'Octo', email: 'o@x.co', avatar_url: 'a.png' });
    }
    throw new Error('unexpected fetch ' + s);
  };
}

/** @param {Response} r */
function setCookies(r) { return r.headers.getSetCookie(); }

/**
 * Turn the redirect leg's Set-Cookie list into the Cookie header the browser
 * would send back, plus the raw state value the IdP would echo.
 * @param {Response} start
 */
function carry(start) {
  const pairs = setCookies(start)
    .map((c) => c.split(';')[0])
    .filter((p) => !p.endsWith('=')); // a cleared cookie is not sent back
  const statePair = pairs.find((p) => p.startsWith('webjs.auth.state='));
  const state = decodeURIComponent(statePair.split('=')[1]).split('.')[0];
  return { cookie: pairs.join('; '), state };
}

function makeAuth() {
  return createAuth({ secret: 'test-secret-at-least-32-characters-long!!', providers: [GitHub({ clientId: 'cid', clientSecret: 'cs' })] });
}

/** Run a full round trip and return the callback response. */
async function roundTrip(auth, startReq, mutateCookie = (c) => c) {
  const start = await auth.handlers[startReq.method](startReq);
  assert.equal(start.status, 302);
  const { cookie, state } = carry(start);
  return {
    start,
    done: await auth.handlers.GET(new Request(
      `http://localhost/api/auth/callback/github?code=C&state=${state}`,
      { headers: { cookie: mutateCookie(cookie) } },
    )),
  };
}

function postForm(redirectTo) {
  return new Request('http://localhost/api/auth/signin/github', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ redirectTo }),
  });
}

test('POST form redirectTo=/dashboard/x lands there after the callback', async () => {
  fakeGitHub();
  const { start, done } = await roundTrip(makeAuth(), postForm('/dashboard/x?tab=1'));
  assert.ok(setCookies(start).some((c) => c.startsWith('webjs.auth.redirect=') && !c.startsWith('webjs.auth.redirect=;')));
  assert.equal(done.status, 302);
  assert.equal(done.headers.get('location'), '/dashboard/x?tab=1');
  const out = setCookies(done);
  assert.ok(out.some((c) => c.startsWith('webjs.auth=')), 'session written');
  assert.ok(out.some((c) => c.startsWith('webjs.auth.redirect=;') && c.includes('Max-Age=0')), 'redirect cookie cleared');
});

test('GET ?redirectTo= and a JSON body both carry the target', async () => {
  fakeGitHub();
  const viaGet = await roundTrip(makeAuth(), new Request('http://localhost/api/auth/signin/github?redirectTo=%2Fprojects%2F42'));
  assert.equal(viaGet.done.headers.get('location'), '/projects/42');

  const viaJson = await roundTrip(makeAuth(), new Request('http://localhost/api/auth/signin/github', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ redirectTo: '/settings' }),
  }));
  assert.equal(viaJson.done.headers.get('location'), '/settings');
});

test('signIn(provider, data, { redirectTo }) carries the target for app-driven sign-in', async () => {
  fakeGitHub();
  const auth = makeAuth();
  const start = await auth.signIn('github', undefined, { redirectTo: '/after', req: new Request('http://localhost/x') });
  const { cookie, state } = carry(start);
  const done = await auth.handlers.GET(new Request(`http://localhost/api/auth/callback/github?code=C&state=${state}`, { headers: { cookie } }));
  assert.equal(done.headers.get('location'), '/after');
});

for (const bad of [
  'https://evil.example/x',
  '//evil.example/x',
  '/\\evil.example/x',
  '\\\\evil.example',
  '/ok\\..\\x',
  'dashboard',
  '/tab\tinjected',
  '',
]) {
  test(`unsafe redirectTo ${JSON.stringify(bad)} is dropped and lands on /`, async () => {
    fakeGitHub();
    const { start, done } = await roundTrip(makeAuth(), postForm(bad));
    assert.ok(setCookies(start).some((c) => c.startsWith('webjs.auth.redirect=;')), 'no target stored, any stale one cleared');
    assert.equal(done.headers.get('location'), '/');
  });
}

test('a tampered redirect cookie fails its signature and lands on /', async () => {
  fakeGitHub();
  const { done } = await roundTrip(makeAuth(), postForm('/dashboard'), (cookie) =>
    cookie.replace(/webjs\.auth\.redirect=([^;]*)/, (_m, v) => {
      const signed = decodeURIComponent(v);
      const sig = signed.slice(signed.lastIndexOf('.'));
      return 'webjs.auth.redirect=' + encodeURIComponent('/attacker-chosen' + sig);
    }));
  assert.equal(done.headers.get('location'), '/');
});

test('a forged unsigned redirect cookie is ignored', async () => {
  fakeGitHub();
  const { done } = await roundTrip(makeAuth(), new Request('http://localhost/api/auth/signin/github'), (cookie) =>
    cookie + '; webjs.auth.redirect=' + encodeURIComponent('/forged'));
  assert.equal(done.headers.get('location'), '/');
});

test('a denied sign-in still goes to pages.error and clears the redirect cookie', async () => {
  fakeGitHub();
  const auth = createAuth({
    secret: 'test-secret-at-least-32-characters-long!!',
    providers: [GitHub({ clientId: 'cid', clientSecret: 'cs' })],
    pages: { error: '/auth-error' },
    callbacks: { signIn: async () => false },
  });
  const { done } = await roundTrip(auth, postForm('/dashboard'));
  assert.equal(done.headers.get('location'), '/auth-error');
  assert.ok(setCookies(done).some((c) => c.startsWith('webjs.auth.redirect=;')));
});

test('credentials sign-in drops an off-site redirectTo from the form body', async () => {
  const auth = createAuth({
    secret: 'test-secret-at-least-32-characters-long!!',
    providers: [{ id: 'credentials', name: 'Credentials', type: 'credentials', authorize: async () => ({ id: '1' }) }],
  });
  const off = await auth.handlers.POST(new Request('http://localhost/api/auth/signin/credentials', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ redirectTo: '//evil.example' }),
  }));
  assert.equal(off.headers.get('location'), '/');
  const local = await auth.handlers.POST(new Request('http://localhost/api/auth/signin/credentials', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ redirectTo: '/inbox' }),
  }));
  assert.equal(local.headers.get('location'), '/inbox');
});

/* ---------------- end to end through the real handle() pipeline ---------------- */

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-oauth-redirect-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function oauthApp() {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  const files = {
    'lib/auth.server.js':
      `import { createAuth, GitHub } from ${AUTH_URL};\n` +
      `export const { auth, handlers } = createAuth({\n` +
      `  secret: 'test-secret-at-least-32-characters-long!!',\n` +
      `  providers: [GitHub({ clientId: 'cid', clientSecret: 'cs' })],\n` +
      `});\n`,
    'app/api/auth/[...path]/route.js':
      `import { handlers } from '../../../../lib/auth.server.js';\n` +
      `export const GET = handlers.GET;\n` +
      `export const POST = handlers.POST;\n`,
  };
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

async function harnessRoundTrip(redirectTo) {
  fakeGitHub();
  const app = await createRequestHandler({ appDir: oauthApp(), dev: true });
  const start = await app.handle(new Request('http://localhost/api/auth/signin/github', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://localhost', 'sec-fetch-site': 'same-origin' },
    body: new URLSearchParams({ redirectTo }),
  }));
  assert.equal(start.status, 302, 'the signin POST redirects to the IdP');
  assert.match(start.headers.get('location'), /^https:\/\/github\.com\/login\/oauth\/authorize/);
  const { cookie, state } = carry(start);
  return app.handle(new Request(`http://localhost/api/auth/callback/github?code=C&state=${state}`, { headers: { cookie } }));
}

test('handle(): POST signin with redirectTo=/dashboard/x lands on /dashboard/x', async () => {
  const done = await harnessRoundTrip('/dashboard/x');
  assert.equal(done.status, 302);
  assert.equal(done.headers.get('location'), '/dashboard/x');
});

test('handle(): an absolute or protocol-relative redirectTo lands on the default', async () => {
  assert.equal((await harnessRoundTrip('https://evil.example/')).headers.get('location'), '/');
  assert.equal((await harnessRoundTrip('//evil.example/')).headers.get('location'), '/');
});
