/**
 * Cross-runtime proof of the Next.js-shaped cookies() through the real
 * listener: a set in a route handler reaches the wire as Set-Cookie (also on
 * an immutable redirect response), and get() returns { name, value }.
 *
 *   node test/bun/cookies-api.mjs
 *   bun  test/bun/cookies-api.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = pathToFileURL(resolve(__dirname, '../../packages/server/index.js')).toString();
const { startServer } = await import(SERVER);
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'wj-cookies-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };
let close;
let failure = null;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'ck', type: 'module' }));
  w('app/api/c/route.ts',
    `import { cookies } from ${JSON.stringify(SERVER)};\n` +
    `export async function POST(req: Request) { const c = await cookies(); c.set('a', '1', { httpOnly: true }); c.set('b', '2'); return Response.redirect(new URL('/api/c', req.url), 303); }\n` +
    `export function DELETE() { cookies().delete('s', { path: '/admin' }); return new Response(null, { status: 204 }); }\n` +
    `export function PUT() { cookies().delete('sid', { path: '/app', maxAge: 3600 }); return new Response(null, { status: 204 }); }\n` +
    `export function GET() { return { a: cookies().get('a') ?? null }; }\n`);
  let server;
  ({ server, close } = await startServer({ appDir: dir, dev: false, port: 0, logger: quiet }));
  const port = typeof server.port === 'number' ? server.port : server.address().port;
  const base = `http://localhost:${port}`;
  const r = await fetch(`${base}/api/c`, { method: 'POST', redirect: 'manual', headers: { 'sec-fetch-site': 'same-origin' } });
  await r.text();
  assert.equal(r.status, 303);
  const set = r.headers.getSetCookie();
  assert.deepEqual(set, ['a=1; Path=/; HttpOnly', 'b=2; Path=/'], `two Set-Cookie headers on ${runtime}`);
  const g = await fetch(`${base}/api/c`, { headers: { cookie: 'a=1' } });
  assert.deepEqual(await g.json(), { a: { name: 'a', value: '1' } }, `get() shape on ${runtime}`);
  // delete(name, { path }) clears the cookie on the path it was set on.
  const d = await fetch(`${base}/api/c`, { method: 'DELETE', headers: { 'sec-fetch-site': 'same-origin', cookie: 's=1' } });
  await d.text();
  assert.deepEqual(d.headers.getSetCookie(), ['s=; Path=/admin; Expires=Thu, 01 Jan 1970 00:00:00 GMT'], `delete with a path on ${runtime}`);
  // A maxAge passed with the options (shared with set()) does not keep the
  // deleted cookie alive.
  const m = await fetch(`${base}/api/c`, { method: 'PUT', headers: { 'sec-fetch-site': 'same-origin', cookie: 'sid=1' } });
  await m.text();
  assert.deepEqual(m.headers.getSetCookie(), ['sid=; Path=/app; Expires=Thu, 01 Jan 1970 00:00:00 GMT'], `delete with a maxAge on ${runtime}`);
  console.log(`ok cookies() api on ${runtime}`);
} catch (e) {
  failure = e;
} finally {
  if (close) await close();
  rmSync(dir, { recursive: true, force: true });
}
if (failure) {
  console.error(failure);
  process.exit(1);
}
