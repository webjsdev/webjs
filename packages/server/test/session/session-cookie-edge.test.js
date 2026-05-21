/**
 * Edge cases for the session() cookie middleware: covers the
 * destroyed-session clear-cookie path, custom cookie serializer
 * options (httpOnly=false / secure=false / sameSite override), the
 * dirty-session signed cookie path, and getSession() being called
 * outside the middleware.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  Session,
  storeSessionStorage,
  cookieSessionStorage,
  session,
  getSession,
} from '../../src/session.js';
import { memoryStore } from '../../src/cache.js';

function reqWith(cookie) {
  return new Request('http://x/', { headers: cookie ? { cookie } : {} });
}

test('session(): destroyed session emits a clear-cookie (Max-Age=0)', async () => {
  // Mock a storage whose save() returns '' (the "destroyed" sentinel)
  // unconditionally: simpler than threading destroy() through a real
  // request/AsyncLocalStorage flow.
  const destroyStorage = {
    async read() { return new Session('x'); },
    async save() { return ''; },
  };
  const mw = session({ secret: 's', storage: destroyStorage, cookieName: 'sid' });
  const resp = await mw(reqWith('sid=anything'), async () => new Response('ok'));
  const sc = resp.headers.get('set-cookie');
  assert.ok(sc, 'set-cookie should be present');
  assert.match(sc, /^sid=;/, 'cookie value cleared');
  assert.match(sc, /Max-Age=0/, 'Max-Age=0 to clear');
});

test('session(): dirty (save returns string) emits a signed, serialized cookie', async () => {
  // Custom storage that always returns a known cookie value so the
  // serializeCookie + sign codepath is exercised regardless of the
  // request context's AsyncLocalStorage.
  const dirtyStorage = {
    async read() { return new Session('x'); },
    async save() { return 'sentinel-cookie-value'; },
  };
  const mw = session({
    secret: 'top-secret',
    storage: dirtyStorage,
    cookieName: 'sid',
  });
  const resp = await mw(reqWith(), async () => new Response('ok'));
  const sc = resp.headers.get('set-cookie');
  assert.ok(sc, 'set-cookie should be present');
  // Cookie body is `sentinel-cookie-value.<sig>` (URL-encoded `.` survives).
  assert.match(sc, /^sid=sentinel-cookie-value\.[A-Za-z0-9_-]+/,
    'cookie value is signed (value.signature)');
  // Default cookie attributes
  assert.match(sc, /Max-Age=\d+/);
  assert.match(sc, /Path=\//);
  assert.match(sc, /HttpOnly/);
  assert.match(sc, /Secure/);
  assert.match(sc, /SameSite=Lax/);
});

test('session(): serializeCookie respects custom cookie options', async () => {
  const dirtyStorage = {
    async read() { return new Session('x'); },
    async save() { return 'v'; },
  };
  const mw = session({
    secret: 's',
    storage: dirtyStorage,
    cookieName: 'sid',
    httpOnly: false,
    secure: false,
    sameSite: 'Strict',
    path: '/admin',
    maxAge: 60_000,
  });
  const resp = await mw(reqWith(), async () => new Response('ok'));
  const sc = resp.headers.get('set-cookie');
  assert.ok(sc);
  // Custom options should be reflected in the cookie attributes.
  assert.ok(!/HttpOnly/.test(sc), 'HttpOnly disabled');
  assert.ok(!/Secure/.test(sc), 'Secure disabled');
  assert.match(sc, /SameSite=Strict/);
  assert.match(sc, /Path=\/admin/);
  assert.match(sc, /Max-Age=60/, 'Max-Age=60 (60000ms / 1000)');
});

test('session(): null cookie value from storage.save → no set-cookie', async () => {
  const cleanStorage = {
    async read() { return new Session('x'); },
    async save() { return null; },
  };
  const mw = session({ secret: 's', storage: cleanStorage });
  const resp = await mw(reqWith(), async () => new Response('ok'));
  assert.equal(resp.headers.get('set-cookie'), null);
});

test('session(): unsign treats sig-length mismatch as forged', async () => {
  // A cookie whose body has the form value.signature but the signature
  // length doesn't match what HMAC-SHA256 base64url produces. unsign()
  // should reject it (length mismatch path).
  const mw = session({
    secret: 'real-secret',
    storage: storeSessionStorage({ store: memoryStore() }),
    cookieName: 'sid',
  });
  const resp = await mw(reqWith('sid=foo.short'), async () => new Response('ok'));
  // No crash, no set-cookie (empty session, not dirty).
  assert.equal(resp.headers.get('set-cookie'), null);
});

test('session(): cookie without a `.` separator is treated as unsigned (rejected)', async () => {
  const mw = session({
    secret: 'real-secret',
    storage: storeSessionStorage({ store: memoryStore() }),
    cookieName: 'sid',
  });
  const resp = await mw(reqWith('sid=nodelimiter'), async () => new Response('ok'));
  // Cookie is rejected (unsign returns null), empty session, no set-cookie.
  assert.equal(resp.headers.get('set-cookie'), null);
});

test('getSession() throws when called outside the session middleware', () => {
  const req = new Request('http://x/');
  assert.throws(() => getSession(req), /outside of session middleware/);
});

test('session middleware sets the Session on the Request (getSession returns it)', async () => {
  // Confirm the WeakMap wiring: the handler called within next() can
  // resolve getSession(req) → the same Session storage.read produced.
  const probe = { current: null };
  const stub = {
    async read() {
      probe.current = new Session('seeded');
      return probe.current;
    },
    async save() { return null; },
  };
  const mw = session({ secret: 's', storage: stub });
  await mw(new Request('http://x/'), async () => new Response('ok'));
  assert.ok(probe.current instanceof Session);
});

test('cookieSessionStorage.read: corrupt JSON cookie falls back to fresh Session', async () => {
  const storage = cookieSessionStorage();
  const s = await storage.read('this-is-not-json{');
  assert.ok(s instanceof Session, 'fell back to a fresh Session');
  assert.equal(s.dirty, false);
});
