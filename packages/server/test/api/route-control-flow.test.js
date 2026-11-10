/**
 * Next.js route-handler parity: redirect() / permanentRedirect() / notFound()
 * / forbidden() / unauthorized() thrown inside a route.ts answer 307 / 308 /
 * 404 / 403 / 401, and HEAD + OPTIONS are implemented automatically (a port
 * of Next's autoImplementMethods).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { handleApi } from '../../src/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();

let dir;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'webjs-route-cf-'));
  await writeFile(join(dir, 'cf.js'), `
    import { redirect, permanentRedirect, notFound, forbidden, unauthorized } from ${JSON.stringify(CORE)};
    export async function GET(req) {
      const k = new URL(req.url).searchParams.get('k');
      if (k === 'redirect') redirect('/login');
      if (k === 'redirect301') redirect('/moved', 301);
      if (k === 'permanent') permanentRedirect('/new-home');
      if (k === 'notfound') notFound();
      if (k === 'forbidden') forbidden();
      if (k === 'unauthorized') unauthorized();
      if (k === 'boom') throw new Error('real error');
      return Response.json({ ok: true }, { headers: { 'x-from-get': '1' } });
    }
    export async function POST() { return new Response('posted'); }
  `);
  await writeFile(join(dir, 'own-head.js'), `
    export function GET() { return new Response('get body'); }
    export function HEAD() { return new Response(null, { status: 204, headers: { 'x-own': 'head' } }); }
    export function OPTIONS() { return new Response('custom', { status: 200 }); }
  `);
  await writeFile(join(dir, 'post-only.js'), `export function POST() { return new Response('p'); }`);
  await writeFile(join(dir, 'stream.js'), `
    export function GET() {
      return new Response(new ReadableStream({
        pull(c) { c.enqueue(new TextEncoder().encode('tick')); },
        cancel() { globalThis.__webjsHeadCancelled = true; },
      }));
    }
  `);
});
after(async () => { await rm(dir, { recursive: true, force: true }); });

const route = (f) => ({ file: join(dir, f) });
const get = (k, method = 'GET') => handleApi(route('cf.js'), {}, new Request(`http://x/api/cf?k=${k}`, { method }), false);

test('redirect() in a route handler answers 307 with Location', async () => {
  const r = await get('redirect');
  assert.equal(r.status, 307);
  assert.equal(r.headers.get('location'), '/login');
});

test('an explicit redirect status is honoured, permanentRedirect answers 308', async () => {
  assert.equal((await get('redirect301')).status, 301);
  const p = await get('permanent');
  assert.equal(p.status, 308);
  assert.equal(p.headers.get('location'), '/new-home');
});

test('notFound / forbidden / unauthorized answer 404 / 403 / 401 with no body', async () => {
  for (const [k, status] of [['notfound', 404], ['forbidden', 403], ['unauthorized', 401]]) {
    const r = await get(k);
    assert.equal(r.status, status, k);
    assert.equal(await r.text(), '', `${k} has an empty body`);
  }
});

test('a real error still propagates (the caller answers 500)', async () => {
  await assert.rejects(() => get('boom'), /real error/);
});

test('HEAD is implemented from GET: same status and headers, no body', async () => {
  const r = await get('', 'HEAD');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-from-get'), '1');
  assert.equal(r.body, null);
});

test('a synthesized HEAD cancels the body GET produced, so a stream stops', async () => {
  globalThis.__webjsHeadCancelled = false;
  const r = await handleApi(route('stream.js'), {}, new Request('http://x/api/stream', { method: 'HEAD' }), false);
  assert.equal(r.status, 200);
  assert.equal(r.body, null);
  await new Promise((done) => setTimeout(done, 10));
  assert.equal(globalThis.__webjsHeadCancelled, true, 'the unread GET stream is cancelled');
});

test('OPTIONS is implemented: 204 with a sorted Allow including HEAD and OPTIONS', async () => {
  const r = await get('', 'OPTIONS');
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('allow'), 'GET, HEAD, OPTIONS, POST');
});

test('an exported HEAD / OPTIONS wins over the automatic one', async () => {
  const h = await handleApi(route('own-head.js'), {}, new Request('http://x/', { method: 'HEAD' }), false);
  assert.equal(h.headers.get('x-own'), 'head');
  const o = await handleApi(route('own-head.js'), {}, new Request('http://x/', { method: 'OPTIONS' }), false);
  assert.equal(await o.text(), 'custom');
});

test('HEAD is not synthesized without GET (405); OPTIONS still answers', async () => {
  const h = await handleApi(route('post-only.js'), {}, new Request('http://x/', { method: 'HEAD' }), false);
  assert.equal(h.status, 405);
  assert.equal(h.headers.get('allow'), 'OPTIONS, POST');
  const o = await handleApi(route('post-only.js'), {}, new Request('http://x/', { method: 'OPTIONS' }), false);
  assert.equal(o.status, 204);
  assert.equal(o.headers.get('allow'), 'OPTIONS, POST');
});
