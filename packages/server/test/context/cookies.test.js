/**
 * cookies() has Next.js's shape: get(name) -> { name, value }, getAll, has,
 * size, iteration, set / delete writing a Set-Cookie onto the request's
 * response (applied by the request handler, including on a redirect whose
 * headers are immutable), reads seeing writes, and await support.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { withRequest, cookies } from '../../src/context.js';
import { stringifyCookie, parseCookieHeader, applyPendingCookies, CookieStore } from '../../src/cookie-store.js';
import { createRequestHandler } from '../../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = pathToFileURL(resolve(__dirname, '../../index.js')).toString();
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

test('reads: get / getAll / has / size / iteration, and awaitable', async () => {
  await withRequest(new Request('http://x/', { headers: { cookie: 'theme=dark; n=a%20b' } }), async () => {
    const c = cookies();
    assert.deepEqual(c.get('theme'), { name: 'theme', value: 'dark' });
    assert.equal(c.get({ name: 'n' })?.value, 'a b', 'percent-decoded');
    assert.equal(c.get('missing'), undefined);
    assert.equal(c.getAll('theme').length, 1);
    assert.equal(c.size, 2);
    assert.deepEqual([...c].map(([k]) => k), ['theme', 'n']);
    const awaited = await cookies();
    assert.equal(awaited.get('theme')?.value, 'dark');
  });
});

test('set / delete are visible to later reads in the same request', async () => {
  await withRequest(new Request('http://x/', { headers: { cookie: 'a=1' } }), async () => {
    cookies().set('b', '2', { httpOnly: true, maxAge: 60 });
    assert.equal(cookies().get('b')?.value, '2');
    cookies().delete('a');
    assert.equal(cookies().has('a'), false);
  });
});

test('stringifyCookie matches Next: path defaults to /, maxAge in seconds sets Expires', () => {
  const store = new CookieStore(null);
  store.set('s', 'v w', { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 3600 });
  const v = store.pending.get('s');
  assert.match(v, /^s=v%20w; Path=\/; Expires=[^;]+GMT; Max-Age=3600; Secure; HttpOnly; SameSite=lax$/);
  store.set({ name: 'o', value: 'x', path: '/admin', domain: 'example.com' });
  assert.equal(store.pending.get('o'), 'o=x; Path=/admin; Domain=example.com');
  store.delete('s');
  assert.equal(store.pending.get('s'), 's=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'the last write to a name wins');
  assert.equal(stringifyCookie({ name: 'k', value: '' }), 'k=');
  assert.deepEqual([...parseCookieHeader('a=1; a=2; b')], [['a', '1'], ['b', 'true']]);
});

test('delete(name, { path, domain }) clears the cookie on that path and domain', () => {
  const store = new CookieStore('s=1; t=2');
  store.delete('s', { path: '/admin', domain: 'example.com' });
  assert.equal(store.pending.get('s'), 's=; Path=/admin; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Domain=example.com');
  assert.equal(store.has('s'), false);
  // The object form says the same thing.
  store.delete({ name: 't', path: '/admin' });
  assert.equal(store.pending.get('t'), 't=; Path=/admin; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
});

test('cookies().delete passes its options through the request-scoped view', async () => {
  await withRequest(new Request('http://x/', { headers: { cookie: 's=1' } }), async () => {
    const view = cookies().delete('s', { path: '/p' });
    assert.equal(typeof view.get, 'function', 'chainable, as set() is');
    assert.equal(cookies().has('s'), false);
  });
});

test('applyPendingCookies adds to an immutable redirect response', () => {
  const store = new CookieStore(null);
  store.set('x', '1');
  const res = applyPendingCookies(Response.redirect('http://x/next', 303), store);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), 'http://x/next');
  assert.match(res.headers.get('set-cookie'), /^x=1; Path=\//);
});

test('the request handler applies a set made in a route handler and in a server action', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-cookies-'));
  const w = (rel, body) => { mkdirSync(dirname(join(dir, rel)), { recursive: true }); writeFileSync(join(dir, rel), body); };
  try {
    w('package.json', '{"name":"c","type":"module"}');
    w('app/api/theme/route.js',
      `import { cookies } from ${JSON.stringify(SERVER)};\n` +
      `export async function POST() { (await cookies()).set('theme', 'dark', { maxAge: 60 }); return Response.redirect('http://x/', 303); }\n` +
      `export function GET() { return { theme: cookies().get('theme')?.value ?? null }; }\n`);
    const h = await createRequestHandler({ appDir: dir, dev: false, logger: quiet });
    const r = await h.handle(new Request('http://x/api/theme', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' } }));
    assert.equal(r.status, 303);
    assert.match(r.headers.get('set-cookie') || '', /^theme=dark; Path=\/; Expires=.*Max-Age=60/);
    const g = await h.handle(new Request('http://x/api/theme', { headers: { cookie: 'theme=dark' } }));
    assert.deepEqual(await g.json(), { theme: 'dark' });
    assert.equal(g.headers.get('set-cookie'), null, 'a read writes nothing');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
