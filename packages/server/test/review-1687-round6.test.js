/**
 * The findings of the owner's sixth review of PR #1687, each pinned by a test
 * that fails without its fix.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAuth, Credentials } from '../src/auth.js';

const SECRET = 'review-1687-round6-secret-at-least-32-bytes';
const ORIGIN = 'https://app.example';

test('a same-origin URL whose path starts with // is not a protocol-relative redirect', async () => {
  const auth = createAuth({ secret: SECRET, providers: [Credentials({ authorize: async () => ({ id: '1' }) })] });
  const req = new Request(`${ORIGIN}/account`);
  const where = async (redirectTo) => (await auth.signOut({ redirectTo, req })).headers.get('location');
  assert.equal(await where(`${ORIGIN}//evil.com/x`), '/', '//evil.com is another host');
  assert.equal(await where(`${ORIGIN}/\\\\evil.com`), '/', 'and so is /\\\\evil.com');
  // What the previous fix protects: a same-origin URL still keeps its path.
  assert.equal(await where(`${ORIGIN}/bye?x=1#h`), '/bye?x=1#h');

  const routed = await auth.handlers.POST(new Request(`${ORIGIN}/api/auth/signin/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN },
    body: `redirectTo=${encodeURIComponent(`${ORIGIN}//evil.com`)}`,
  }));
  assert.equal(routed.headers.get('location'), '/', 'the credentials route takes the same check');
});

test("the signIn callback's returned URL goes through callbacks.redirect and is header-safe", async () => {
  const providers = [Credentials({ authorize: async () => ({ id: '1' }) })];
  const signIn = async (callbacks) => {
    const auth = createAuth({ secret: SECRET, providers, callbacks });
    return auth.handlers.POST(new Request(`${ORIGIN}/api/auth/signin/credentials`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN },
      body: 'email=a',
    }));
  };
  // An identity-provider URL the redirect callback allows is used, as in Auth.js.
  const allowed = await signIn({
    signIn: () => 'https://idp.example/verify',
    redirect: ({ url, baseUrl }) => (url.startsWith('https://idp.example/') ? url : baseUrl),
  });
  assert.equal(allowed.headers.get('location'), 'https://idp.example/verify');
  // A non-Latin-1 local path is encoded rather than thrown while building headers.
  const local = await signIn({ signIn: () => '/welcome/日本' });
  assert.equal(local.headers.get('location'), '/welcome/%E6%97%A5%E6%9C%AC');
  // What the previous rule protects: another origin, with the default, is still denied.
  const off = await signIn({ signIn: () => 'https://evil.example/' });
  assert.match(off.headers.get('location') || '', /error=AccessDenied/);
});
