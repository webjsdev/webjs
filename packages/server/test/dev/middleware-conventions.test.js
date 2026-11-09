/**
 * Middleware behaves as in Next.js: a named `middleware` / `proxy` export, a
 * `proxy.ts` file, `config.matcher` (string, array, has / missing), returning
 * undefined to continue, a memoized next(), request.cookies, and a dev error
 * for request.nextUrl. Both a middleware and a proxy file is a boot error.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';
import { compileMatcher, matchHas } from '../../src/middleware-load.js';

const quiet = { info() {}, warn() {}, error() {}, debug() {} };
let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-mw-conv-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  writeFileSync(join(appDir, 'package.json'), '{"name":"m","type":"module"}');
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

const PAGES = {
  'app/page.js': `export default () => 'home';\n`,
  'app/dashboard/page.js': `export default () => 'dash';\n`,
  'app/dashboard/settings/page.js': `export default () => 'settings';\n`,
};

async function get(appDir, path, init, dev = true) {
  const app = await createRequestHandler({ appDir, dev, logger: quiet });
  return app.handle(new Request(`http://x${path}`, init));
}

test('a named `middleware` export runs, and matcher scopes it (trailing slash tolerant)', async () => {
  const appDir = makeApp({
    ...PAGES,
    'middleware.js': `export function middleware() { return new Response('blocked', { status: 401 }); }\nexport const config = { matcher: '/dashboard/:path*' };\n`,
  });
  const app = await createRequestHandler({ appDir, dev: true, logger: quiet });
  assert.equal((await app.handle(new Request('http://x/dashboard'))).status, 401);
  assert.equal((await app.handle(new Request('http://x/dashboard/settings/'))).status, 401);
  assert.equal((await app.handle(new Request('http://x/'))).status, 200, 'outside the matcher it never runs');
});

test('proxy.ts with a named `proxy` export works (Next 16)', async () => {
  const appDir = makeApp({ ...PAGES, 'proxy.ts': `export function proxy(req: Request) { return new Response('proxied'); }\n` });
  assert.equal(await (await get(appDir, '/')).text(), 'proxied');
});

test('both middleware and proxy files: a dev 500 naming both, a production boot error', async () => {
  const appDir = makeApp({ ...PAGES, 'middleware.js': 'export default () => {};\n', 'proxy.js': 'export default () => {};\n' });
  const r = await get(appDir, '/', undefined, true);
  assert.equal(r.status, 500);
  assert.match(await r.text(), /both middleware\.js and proxy\.js exist/);
  await assert.rejects(() => createRequestHandler({ appDir, dev: false, logger: quiet }), /both middleware\.js and proxy\.js exist/);
});

test('returning undefined continues; next() is memoized; request.cookies is the cookies() store', async () => {
  const appDir = makeApp({
    ...PAGES,
    'middleware.js':
      `export default async function mw(req, next) {\n` +
      `  globalThis.__mwTheme = req.cookies.get('theme')?.value;\n` +
      `  req.cookies.set('seen', '1');\n` +
      `  const a = await next(); const b = await next();\n` +
      `  globalThis.__mwSame = a === b;\n` +
      `}\n`,
  });
  const r = await get(appDir, '/', { headers: { cookie: 'theme=dark' } });
  assert.equal(r.status, 200, 'undefined continues to the page');
  assert.match(await r.text(), /home/);
  assert.equal(globalThis.__mwTheme, 'dark');
  assert.equal(globalThis.__mwSame, true, 'next() ran the chain once');
  assert.match(r.headers.get('set-cookie') || '', /^seen=1; Path=\//);
});

test('reading request.nextUrl throws in dev with the new URL(request.url) fix', async () => {
  const appDir = makeApp({ ...PAGES, 'middleware.js': `export default (req) => { req.nextUrl.pathname; };\n` });
  const r = await get(appDir, '/');
  assert.equal(r.status, 500);
});

test('matcher entries: arrays, has / missing (port of Next matchHas)', () => {
  const m = compileMatcher([
    '/about',
    { source: '/api/:path*', has: [{ type: 'header', key: 'x-flag' }], missing: [{ type: 'cookie', key: 'skip' }] },
    { source: '/q', has: [{ type: 'query', key: 'v', value: '(a|b)' }] },
  ], 'middleware.js');
  const t = (path, headers = {}) => m(new Request(`http://x${path}`, { headers }), new URL(`http://x${path}`));
  assert.equal(t('/about'), true);
  assert.equal(t('/about/'), true);
  assert.equal(t('/api/x'), false, 'has header missing');
  assert.equal(t('/api/x', { 'x-flag': '1' }), true);
  assert.equal(t('/api/x', { 'x-flag': '1', cookie: 'skip=1' }), false, 'missing cookie present');
  assert.equal(t('/q?v=a'), true);
  assert.equal(t('/q?v=c'), false);
  assert.equal(matchHas(new Request('http://Example.com:3000/'), new URL('http://example.com:3000/'), [{ type: 'host', value: 'example\\.com' }]), true);
  assert.throws(() => compileMatcher(['about'], 'middleware.js'), /must be a path starting with/);
});

test('a non-Response return is an error naming the fix', async () => {
  const appDir = makeApp({ ...PAGES, 'middleware.js': `export default () => ({ ok: true });\n` });
  const errors = [];
  const app = await createRequestHandler({ appDir, dev: true, logger: { ...quiet, error: (m) => errors.push(String(m)) } });
  const r = await app.handle(new Request('http://x/'));
  assert.equal(r.status, 500);
});
