/**
 * Cross-runtime proof for the OAuth `redirectTo` round trip (#1495).
 *
 *   node test/bun/oauth-redirect-to.mjs
 *   bun  test/bun/oauth-redirect-to.mjs
 *
 * The flow leans on runtime-sensitive pieces: `Headers.getSetCookie()` for the
 * several cookies one response sets, Web Crypto HMAC signing of the target
 * cookie, and `Request.formData()` for the POST body. This drives the real
 * `createAuth().handlers` (a faked IdP over `globalThis.fetch`) and asserts a
 * local target survives the round trip while an off-site one and a tampered
 * cookie both land on `/`.
 *
 * A plain assert script (not node:test) so the SAME file runs on both runtimes.
 * It imports the server by relative path, so it always proves THIS tree's source.
 */
import assert from 'node:assert/strict';
import { createAuth, GitHub } from '../../packages/server/index.js';

globalThis.fetch = async (url) => {
  const s = String(url);
  if (s.includes('github.com/login/oauth/access_token')) return Response.json({ access_token: 'AT' });
  if (s.includes('api.github.com/user')) return Response.json({ id: 1, login: 'o', name: 'O', email: 'o@x.co' });
  throw new Error('unexpected fetch ' + s);
};

const auth = createAuth({
  secret: 'bun-proof-secret-at-least-32-characters!!',
  providers: [GitHub({ clientId: 'cid', clientSecret: 'cs' })],
});

async function roundTrip(redirectTo, tamper = (c) => c) {
  const start = await auth.handlers.POST(new Request('http://localhost/api/auth/signin/github', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ redirectTo }),
  }));
  assert.equal(start.status, 302);
  const pairs = start.headers.getSetCookie().map((c) => c.split(';')[0]).filter((p) => !p.endsWith('='));
  const state = decodeURIComponent(pairs.find((p) => p.startsWith('webjs.auth.state=')).split('=')[1]).split('.')[0];
  const done = await auth.handlers.GET(new Request(
    `http://localhost/api/auth/callback/github?code=C&state=${state}`,
    { headers: { cookie: tamper(pairs.join('; ')) } },
  ));
  assert.equal(done.status, 302);
  return done;
}

let failed = false;
try {
  const ok = await roundTrip('/dashboard/x');
  assert.equal(ok.headers.get('location'), '/dashboard/x', 'a local target survives the round trip');
  assert.ok(ok.headers.getSetCookie().some((c) => c.startsWith('webjs.auth.redirect=;')), 'the redirect cookie is cleared');

  assert.equal((await roundTrip('//evil.example/')).headers.get('location'), '/', 'protocol-relative dropped');
  assert.equal((await roundTrip('https://evil.example/')).headers.get('location'), '/', 'absolute dropped');

  const tampered = await roundTrip('/dashboard', (c) => c.replace(/webjs\.auth\.redirect=[^;]*/, (m) => {
    const v = decodeURIComponent(m.slice('webjs.auth.redirect='.length));
    return 'webjs.auth.redirect=' + encodeURIComponent('/elsewhere' + v.slice(v.lastIndexOf('.')));
  }));
  assert.equal(tampered.headers.get('location'), '/', 'a tampered cookie fails its signature');
  console.log(`oauth-redirect-to: OK on ${typeof Bun !== 'undefined' ? 'bun' : 'node'}`);
} catch (err) {
  failed = true;
  console.error(err);
} finally {
  process.exit(failed ? 1 : 0);
}
