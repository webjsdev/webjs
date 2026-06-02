/**
 * Session integrity property test (issue #187, subsystem hardening).
 *
 * INVARIANT: the `session()` middleware signs the cookie with the secret, so
 * a value set in one request round-trips on the next, and ANY tamper with
 * the cookie (a modified payload, a bit-flipped signature, a malformed
 * format) is rejected: `unsign` returns null and the request gets a fresh
 * empty session rather than silently trusting forged data. The existing
 * session.test.js covers the unsigned storage round-trip; this pins the
 * signed-cookie integrity the middleware adds, which is what stops a client
 * from forging their own session (e.g. promoting themselves to admin).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { session, getSession } from '../../src/session.js';

const SECRET = 'test-secret-please-ignore';
const mw = session({ secret: SECRET, cookieName: 'sid' });

/** Run one request through the middleware; `handler(s)` mutates the session. */
async function pass(cookie, handler) {
  const headers = cookie ? { cookie: `sid=${cookie}` } : {};
  const req = new Request('http://x/', { headers });
  const resp = await mw(req, async () => { handler(getSession(req)); return new Response('ok'); });
  // Extract the signed cookie value from Set-Cookie, if any.
  const setCookie = resp.headers.get('set-cookie') || '';
  const m = /sid=([^;]*)/.exec(setCookie);
  return { setCookie: m ? decodeURIComponent(m[1]) : null, read: (req2) => req2 };
}

test('a value set in one request round-trips on the next', async () => {
  const { setCookie } = await pass(null, (s) => s.set('userId', 'alice'));
  assert.ok(setCookie, 'a signed cookie is issued');
  let seen;
  await pass(setCookie, (s) => { seen = s.get('userId'); });
  assert.equal(seen, 'alice', 'the signed cookie round-trips the value');
});

test('a tampered payload is rejected (fresh empty session)', async () => {
  const { setCookie } = await pass(null, (s) => s.set('role', 'user'));
  const dot = setCookie.lastIndexOf('.');
  const payload = setCookie.slice(0, dot);
  const sig = setCookie.slice(dot);
  // Forge the payload (e.g. escalate role) while keeping the old signature.
  const forged = payload.replace('"user"', '"admin"') + sig;
  assert.notEqual(forged, setCookie, 'the forged payload differs');
  let seen = 'unset';
  await pass(forged, (s) => { seen = s.get('role'); });
  assert.equal(seen, undefined, 'a forged payload must yield an empty session, not the forged value');
});

test('a bit-flipped signature is rejected', async () => {
  const { setCookie } = await pass(null, (s) => s.set('k', 'v'));
  const dot = setCookie.lastIndexOf('.');
  const sig = setCookie.slice(dot + 1);
  const flippedChar = sig[0] === 'A' ? 'B' : 'A';
  const tampered = setCookie.slice(0, dot + 1) + flippedChar + sig.slice(1);
  assert.notEqual(tampered, setCookie, 'the signature changed');
  let seen = 'unset';
  await pass(tampered, (s) => { seen = s.get('k'); });
  assert.equal(seen, undefined, 'a bad signature must yield an empty session');
});

test('a malformed cookie (no signature) is rejected', async () => {
  let seen = 'unset';
  await pass('{"id":"x","userId":"mallory"}', (s) => { seen = s.get('userId'); });
  assert.equal(seen, undefined, 'an unsigned/malformed cookie must not be trusted');
});
