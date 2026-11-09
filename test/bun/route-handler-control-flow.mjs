/**
 * Cross-runtime proof for Next.js route-handler parity: redirect() /
 * permanentRedirect() / notFound() thrown in a route.ts answer 307 / 308 /
 * 404, and HEAD / OPTIONS are implemented automatically, through the real
 * listener on whichever runtime runs this file.
 *
 *   node test/bun/route-handler-control-flow.mjs   # the node:http shell
 *   bun  test/bun/route-handler-control-flow.mjs   # the Bun.serve shell
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();
const { startServer } = await import(pathToFileURL(resolve(__dirname, '../../packages/server/index.js')).toString());
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'wj-route-cf-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };

let close;
let failure = null;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'rcf', type: 'module' }));
  w('app/api/go/route.ts',
    `import { redirect, permanentRedirect, notFound } from ${JSON.stringify(CORE)};\n` +
    `export function GET(req: Request) {\n` +
    `  const k = new URL(req.url).searchParams.get('k');\n` +
    `  if (k === 'p') permanentRedirect('/new');\n` +
    `  if (k === 'nf') notFound();\n` +
    `  if (k === 'ok') return Response.json({ ok: true }, { headers: { 'x-get': '1' } });\n` +
    `  redirect('/login');\n` +
    `}\n` +
    `export function POST() { return new Response('p'); }\n`);

  let server;
  ({ server, close } = await startServer({ appDir: dir, dev: false, port: 0, logger: quiet }));
  const port = typeof server.port === 'number' ? server.port : server.address().port;
  const base = `http://localhost:${port}/api/go`;

  let r = await fetch(base, { redirect: 'manual' });
  assert.equal(r.status, 307, `redirect() is 307 on ${runtime}`);
  assert.equal(r.headers.get('location'), '/login');
  r = await fetch(`${base}?k=p`, { redirect: 'manual' });
  assert.equal(r.status, 308, `permanentRedirect() is 308 on ${runtime}`);
  r = await fetch(`${base}?k=nf`);
  assert.equal(r.status, 404, `notFound() is 404 on ${runtime}`);
  await r.text();
  r = await fetch(`${base}?k=ok`, { method: 'HEAD' });
  assert.equal(r.status, 200, `auto HEAD on ${runtime}`);
  assert.equal(r.headers.get('x-get'), '1');
  assert.equal(await r.text(), '');
  r = await fetch(base, { method: 'OPTIONS' });
  assert.equal(r.status, 204, `auto OPTIONS on ${runtime}`);
  assert.equal(r.headers.get('allow'), 'GET, HEAD, OPTIONS, POST');
  console.log(`ok route-handler control flow on ${runtime}`);
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
