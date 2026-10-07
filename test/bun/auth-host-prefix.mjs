/**
 * Cross-runtime proof that createAuth's cookies carry the `__Host-` prefix in
 * production (#1538).
 *
 *   node test/bun/auth-host-prefix.mjs
 *   bun  test/bun/auth-host-prefix.mjs
 *
 * Runtime-sensitive pieces: `Headers.getSetCookie()` for the several cookies
 * one response sets, Web Crypto HMAC/JWT signing, and `process.env.NODE_ENV`
 * read at call time. Production sets and reads only `__Host-webjs.auth`, so a
 * valid token tossed under the plain name (a sibling subdomain's
 * `Domain=` cookie) reads as signed out; development keeps the plain name.
 *
 * A plain assert script (not node:test) so the SAME file runs on both runtimes.
 */
import assert from 'node:assert/strict';
import { createAuth, Credentials } from '../../packages/server/index.js';

const auth = createAuth({
  secret: 'bun-proof-secret-at-least-32-characters!!',
  providers: [Credentials({ authorize: async () => ({ id: '1', name: 'A', email: 'a@b.co' }) })],
});

async function pair() {
  const res = await auth.signIn('credentials', { email: 'a@b.co', password: 'x' });
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).find((p) => p.includes('webjs.auth='));
}
const read = (cookie, origin) => auth.auth(new Request(origin + '/', { headers: { cookie } }));

process.env.NODE_ENV = 'production';
const prod = await pair();
assert.ok(prod.startsWith('__Host-webjs.auth='), prod.split('=')[0]);
assert.equal((await read(prod, 'https://a.example.app'))?.user?.id, '1');
assert.equal(await read(prod.replace(/^__Host-/, ''), 'https://a.example.app'), null, 'a tossed plain cookie is not a session');
const cleared = (await auth.signOut()).headers.getSetCookie().find((c) => c.startsWith('__Host-webjs.auth='));
assert.match(cleared, /Max-Age=0/);
assert.match(cleared, /; Secure/);

process.env.NODE_ENV = 'development';
const dev = await pair();
assert.ok(dev.startsWith('webjs.auth='));
assert.equal((await read(dev, 'http://localhost'))?.user?.id, '1');

console.log('auth host-prefix: ok');
