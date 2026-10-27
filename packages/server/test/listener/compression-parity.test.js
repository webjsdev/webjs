/**
 * Compression-negotiation parity on the node:http shell (#511 review follow-up):
 * the node `sendWebResponse` must match the Bun `maybeCompress` guards, namely
 *   - never double-compress a body that is already `content-encoding`d,
 *   - merge into an existing `Vary` instead of clobbering it,
 *   - never compress a `text/event-stream` body (it must flush incrementally).
 * Boots a real `startServer` with `compress: true` (compression is off in dev by
 * default, so it must be forced on to exercise the path) and probes over a real
 * socket.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { startServer } from '../../index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

let dir, server, close, base;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'webjs-compress-parity-'));
  const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'c', type: 'module', webjs: {} }));
  w('app/layout.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default ({ children }: { children: unknown }) => html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;\n`);
  w('app/page.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default function Page() { return html\`<main><h1>compressible page body here, long enough to bother</h1></main>\`; }\n`);
  // A route that returns a body ALREADY gzip-encoded (content-encoding: gzip).
  w('app/api/preenc/route.ts', `import { gzipSync } from 'node:zlib';\nexport async function GET() {\n  const payload = JSON.stringify({ hello: 'world', n: 42 });\n  return new Response(gzipSync(payload), { headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' } });\n}\n`);
  // A route that sets its own Vary header on a compressible body.
  // 2000 bytes: above the shared MIN_COMPRESS_BYTES floor (#1644), so the
  // body is compressed and the Vary merge is observable.
  // A body over BROTLI_MIN_BYTES, where brotli is still preferred (#1646).
  w('app/api/big/route.ts', `export async function GET() {\n  return new Response('lorem ipsum dolor sit amet '.repeat(2000), { headers: { 'content-type': 'text/plain' } });\n}\n`);
  w('app/api/vary/route.ts', `export async function GET() {\n  return new Response('x'.repeat(2000), { headers: { 'content-type': 'text/plain', vary: 'Cookie' } });\n}\n`);
  // A user SSE stream (text/event-stream) that must never be compressed.
  w('app/api/sse/route.ts', `export async function GET() {\n  const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: hi\\n\\n')); c.close(); } });\n  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });\n}\n`);

  ({ server, close } = await startServer({ appDir: dir, dev: true, compress: true, port: 0, logger: quiet }));
  // The node shell exposes the port via server.address(); the Bun shell via
  // server.port. Support both so this runs on either runtime (it then exercises
  // each shell's own compression negotiation).
  const port = typeof server.port === 'number' ? server.port : server.address().port;
  base = `http://localhost:${port}`;
});

after(async () => {
  if (close) await close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

test('a normal compressible body IS gzipped when accepted', async () => {
  const r = await fetch(`${base}/`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(r.headers.get('content-encoding'), 'gzip', 'html body is gzip-encoded');
  // undici auto-decompresses; the decoded body must be the page.
  assert.ok((await r.text()).includes('compressible page body'), 'decodes back to the page');
});

test('brotli is served when accepted, above the small-body floor (parity on both shells, #517, #1646)', async () => {
  // Both the node:http shell (node:zlib) and the Bun.serve shell (node:zlib,
  // which is native on Bun) negotiate through one seam. This test runs under
  // whichever runtime executes it, so it asserts BOTH shells. A SMALL buffered
  // body (the page) prefers gzip when brotli and gzip are both accepted, since
  // gzip 6 is 2 to 3x cheaper than brotli 4 there for a few percent more
  // bytes; a body over BROTLI_MIN_BYTES gets brotli, and a client that accepts
  // only brotli gets brotli at any size.
  const r = await fetch(`${base}/`, { headers: { 'accept-encoding': 'br, gzip' } });
  assert.equal(r.headers.get('content-encoding'), 'gzip', 'a small page is gzip-encoded when both are accepted');
  assert.ok((await r.text()).includes('compressible page body'), 'the gzip body decodes back to the page');
  const vary = r.headers.get('vary') || '';
  assert.ok(/accept-encoding/i.test(vary), 'Accept-Encoding is in Vary on the response');
  const brOnly = await fetch(`${base}/`, { headers: { 'accept-encoding': 'br' } });
  assert.equal(brOnly.headers.get('content-encoding'), 'br', 'brotli alone is still honoured on a small page');
  assert.ok((await brOnly.text()).includes('compressible page body'), 'the brotli body decodes back to the page');
  const big = await fetch(`${base}/api/big`, { headers: { 'accept-encoding': 'br, gzip' } });
  assert.equal(big.headers.get('content-encoding'), 'br', 'a large body is brotli-encoded when both are accepted');
  assert.equal((await big.text()).length, 'lorem ipsum dolor sit amet '.length * 2000, 'the brotli body decodes whole');
});

test('a pre-encoded (content-encoding: gzip) body is NOT double-compressed', async () => {
  // Use a manual request that does NOT auto-decompress, so we can inspect the raw
  // bytes: gunzip ONCE must yield the JSON. A double-compress would need two
  // gunzips and the first would yield gzip bytes, not JSON.
  const r = await fetch(`${base}/api/preenc`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(r.headers.get('content-encoding'), 'gzip', 'the original single gzip encoding is preserved');
  const raw = Buffer.from(await r.arrayBuffer());
  // undici auto-decompresses ONE gzip layer (content-encoding: gzip). With the
  // guard the wire is a single gzip, so `raw` is now plain JSON. WITHOUT the
  // guard the server double-compresses (wire = gzip(gzip(json))), undici peels
  // one layer, and `raw` would STILL be gzip. So the discriminating assertion is
  // that `raw` is NOT gzip-framed: a tautological "gunzip if it looks gzip" would
  // launder the bug away (the double-gzip case passes too), so do NOT do that.
  assert.ok(!looksGzip(raw), 'undici fully decoded in one pass: the server did not double-compress');
  assert.deepEqual(JSON.parse(raw.toString()), { hello: 'world', n: 42 }, 'the single-gunzip body is the JSON');
});

test('an existing Vary header is merged, not clobbered, on compression', async () => {
  const r = await fetch(`${base}/api/vary`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(r.headers.get('content-encoding'), 'gzip', 'the text body is compressed');
  const vary = r.headers.get('vary') || '';
  assert.ok(/cookie/i.test(vary), `the pre-existing Vary: Cookie is preserved; got ${JSON.stringify(vary)}`);
  assert.ok(/accept-encoding/i.test(vary), 'Accept-Encoding is added to Vary');
});

test('a user text/event-stream body is NEVER compressed', async () => {
  const r = await fetch(`${base}/api/sse`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(r.headers.get('content-encoding'), null, 'an SSE body is not content-encoded');
  assert.ok((await r.text()).includes('data: hi'), 'the SSE frame is delivered as-is');
});

/** Cheap gzip-magic-byte sniff (0x1f 0x8b). */
function looksGzip(buf) {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}
