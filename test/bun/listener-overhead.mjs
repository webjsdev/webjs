/**
 * Cross-runtime proof for the Bun listener overhead reductions (#756). webjs runs
 * on Node 24+ OR Bun, and these touch the request / response hot path (the Bun
 * shell's out-of-band IP stamp and the buffered-compression fast path), so both
 * must stay behaviourally identical across runtimes. Run from the repo root:
 *
 *   node test/bun/listener-overhead.mjs   # node:http shell (header IP + streaming compress)
 *   bun  test/bun/listener-overhead.mjs   # Bun.serve shell (out-of-band IP + sync buffered compress)
 *
 * Asserts, under WHICHEVER runtime runs it:
 * (1) a buffered HTML page compressed with br / gzip / deflate decodes back to
 *     the original bytes (the buffered fast path on Bun, the streaming path on
 *     node, produce the same wire bytes), and
 * (2) the framework-trusted remote IP reaches `clientIp` (stamped out of band on
 *     Bun without a Request clone, via the header on node), and a client-spoofed
 *     `x-webjs-remote-ip` does NOT override it.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer } from '@webjsdev/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();
const SERVER = pathToFileURL(resolve(__dirname, '../../packages/server/index.js')).toString();
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'webjs-756-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };

const MARKER = 'buffered-fast-path-content ';
let close;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'overhead', type: 'module', webjs: {} }));
  w('app/layout.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default ({ children }: { children: unknown }) => html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;`);
  w('app/page.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default () => html\`<main>\${'${MARKER}'.repeat(300)}</main>\`;`);
  // Echo the framework-trusted client IP so we can prove the stamp reached it.
  w('app/api/ip/route.ts', `import { clientIp } from ${JSON.stringify(SERVER)};\nexport async function GET(req: Request) {\n  return new Response(clientIp(req), { headers: { 'content-type': 'text/plain' } });\n}`);

  let server;
  ({ server, close } = await startServer({ appDir: dir, dev: true, compress: true, port: 0, logger: quiet }));
  const port = typeof server.port === 'number' ? server.port : server.address().port;
  const base = `http://localhost:${port}`;

  // (1) A buffered page compresses + decodes correctly for every encoding.
  for (const enc of ['br', 'gzip', 'deflate']) {
    const r = await fetch(`${base}/`, { headers: { 'accept-encoding': enc } });
    assert.equal(r.status, 200, `[${runtime}] page 200 (${enc})`);
    assert.equal(r.headers.get('content-encoding'), enc, `[${runtime}] served ${enc}`);
    const body = await r.text(); // fetch transparently decompresses
    assert.ok(body.includes(MARKER.trim()), `[${runtime}] ${enc} body decodes to the original page`);
  }

  // (2) The trusted remote IP reaches clientIp; a spoofed header does not win.
  const ipRes = await fetch(`${base}/api/ip`, { headers: { 'x-webjs-remote-ip': '6.6.6.6' } });
  const ip = (await ipRes.text()).trim();
  assert.notEqual(ip, '6.6.6.6', `[${runtime}] a client-spoofed x-webjs-remote-ip must NOT be trusted`);
  assert.notEqual(ip, '_anon_', `[${runtime}] the framework-stamped socket IP reached clientIp`);
  assert.ok(ip.length > 0, `[${runtime}] a remote IP was resolved (${ip})`);

  await close();
  close = null;
  console.log(`OK  listener-overhead #756 passed on ${runtime} (buffered compress decodes + trusted IP stamped, ip=${ip})`);
} finally {
  try { if (close) await close(); } catch {}
  rmSync(dir, { recursive: true, force: true });
}
