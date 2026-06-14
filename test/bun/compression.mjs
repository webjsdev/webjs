/**
 * Cross-runtime compression proof (#517): boot a real webjs app through
 * `startServer` with compression ON and assert, under WHICHEVER runtime runs it:
 *
 *   node test/bun/compression.mjs   # the node:http shell (sendWebResponse)
 *   bun  test/bun/compression.mjs   # the Bun.serve shell (maybeCompress)
 *
 * (1) a compressible body is served BROTLI when `Accept-Encoding: br` (the parity
 * the PR adds: the Bun shell used to serve gzip-only via CompressionStream), and
 * (2) a response body that ERRORS mid-stream does NOT hang the compressed
 * response (the #509-class `Readable.fromWeb` hang the review caught): the Bun
 * shell feeds the body through a reader-loop generator + `pipeline`, so a source
 * error tears the chain down instead of leaving the compressor open forever.
 *
 * A plain assert script (not node:test), so the SAME file runs on both runtimes
 * AND so Bun's test runner cannot mis-attribute the intentional mid-stream error
 * (the reason the full disk-store suite is denylisted from the Bun matrix). Run
 * from the repo root so the bare `@webjsdev/server` specifier resolves.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from '@webjsdev/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'webjs-compress-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };

let close;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'compress', type: 'module', webjs: {} }));
  w('app/layout.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default ({ children }: { children: unknown }) => html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;`);
  w('app/page.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default () => html\`<main>\${'compressible content '.repeat(200)}</main>\`;`);
  // A route whose body errors AFTER the first chunk (a truncated upload / a
  // streamed action that throws mid-flight). Compressible (text/html), so it
  // goes through the compressor.
  w('app/api/boom/route.ts', `export async function GET() {\n  let n = 0;\n  const body = new ReadableStream({ pull(c) { if (n++ === 0) c.enqueue(new TextEncoder().encode('start '.repeat(50))); else c.error(new Error('boom mid-stream')); } });\n  return new Response(body, { headers: { 'content-type': 'text/html' } });\n}`);

  let server;
  ({ server, close } = await startServer({ appDir: dir, dev: true, compress: true, port: 0, logger: quiet }));
  const port = typeof server.port === 'number' ? server.port : server.address().port;
  const base = `http://localhost:${port}`;

  // 1. Brotli is served when accepted (the headline parity).
  const br = await fetch(`${base}/`, { headers: { 'accept-encoding': 'br' } });
  assert.equal(br.status, 200, 'page is 200');
  assert.equal(br.headers.get('content-encoding'), 'br', 'a compressible body is brotli-encoded on this shell');
  assert.ok((await br.text()).includes('compressible content'), 'the brotli body decodes back to the page');

  // gzip fallback when brotli is not accepted.
  const gz = await fetch(`${base}/`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(gz.headers.get('content-encoding'), 'gzip', 'gzip is served when brotli is not accepted');
  assert.ok((await gz.text()).includes('compressible content'), 'the gzip body decodes');

  // 2. A mid-stream body error must NOT hang the compressed response. We bound it
  // with a timeout; a hang (the #509 class) would never settle.
  const boom = (async () => {
    const r = await fetch(`${base}/api/boom`, { headers: { 'accept-encoding': 'br' } });
    await r.text(); // consume; truncated brotli -> decode error, OR a clean truncation
    return 'settled';
  })();
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('the compressed erroring stream HUNG (never settled)')), 6000));
  await Promise.race([boom, timeout]).then(
    () => {},
    (e) => {
      // A fetch/decode error is the CORRECT outcome (the body errored); only a
      // timeout is a failure.
      if (/HUNG/.test(e.message)) throw e;
    },
  );

  await close();
  close = null;
  console.log(`OK  webjs compression passed on ${runtime} (brotli served + no hang on a mid-stream error)`);
} finally {
  try { if (close) await close(); } catch {}
  rmSync(dir, { recursive: true, force: true });
}
