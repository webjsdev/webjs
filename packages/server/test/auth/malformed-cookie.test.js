/**
 * Regression: a malformed auth cookie must read as "no session", never crash
 * the request (#209 hardening). `unsign` (and `decodeJwt`) call `atob`, which
 * throws on non-base64 input; an attacker or a corrupted cookie must not be
 * able to turn that into an uncaught exception (a 500 / DoS). Both the
 * database-strategy session cookie and the JWT cookie are covered.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAuth, Credentials } from '../../src/auth.js';
import { setStore, memoryStore } from '../../src/cache.js';

const SECRET = 'x'.repeat(32);
const MALFORMED = [
  'webjs.auth=sid.@@@notbase64@@@',
  'webjs.auth=nodotatall',
  'webjs.auth=a.b.c.d.e',
  'webjs.auth=.onlydot',
  'webjs.auth=value.',
  'webjs.auth=' + 'A'.repeat(50),
];

test('database strategy: a malformed signed cookie returns null, never throws', async () => {
  setStore(memoryStore());
  const auth = createAuth({
    secret: SECRET,
    session: { strategy: 'database' },
    providers: [Credentials({ authorize: async () => ({ id: '1' }) })],
  });
  for (const cookie of MALFORMED) {
    const req = new Request('http://x/', { headers: { cookie } });
    const session = await auth.auth(req); // must not throw
    assert.equal(session, null, `malformed cookie ${JSON.stringify(cookie)} must read as no session`);
  }
});

test('jwt strategy: a malformed token cookie returns null, never throws', async () => {
  const auth = createAuth({
    secret: SECRET,
    providers: [Credentials({ authorize: async () => ({ id: '1' }) })],
  });
  for (const cookie of MALFORMED) {
    const req = new Request('http://x/', { headers: { cookie } });
    assert.equal(await auth.auth(req), null, `malformed JWT cookie ${JSON.stringify(cookie)} must read as no session`);
  }
});

test('a genuinely-signed database session still round-trips (the guard did not break the happy path)', async () => {
  setStore(memoryStore());
  const auth = createAuth({
    secret: SECRET,
    session: { strategy: 'database' },
    providers: [Credentials({ authorize: async () => ({ id: '42', name: 'Ada' }) })],
  });
  const resp = await auth.signIn('credentials', {});
  const setCookie = resp.headers.get('set-cookie');
  const m = /webjs\.auth=([^;]+)/.exec(setCookie);
  assert.ok(m, 'sign-in issues a signed session cookie');
  const session = await auth.auth(new Request('http://x/', { headers: { cookie: `webjs.auth=${m[1]}` } }));
  assert.equal(session?.user?.id, '42', 'a valid signed cookie still resolves the session');
});
