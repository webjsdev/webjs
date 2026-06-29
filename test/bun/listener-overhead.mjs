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
 *     the original bytes under whichever runtime runs (the buffered fast path on
 *     Bun, the streaming path on node). The assertion is a ROUND-TRIP (decode ==
 *     original), NOT a cross-runtime byte equality: Bun's bundled zlib is not
 *     Node's build, so the gzip/deflate bytes can differ across runtimes (brotli
 *     matches), which is fine since each response is self-describing via
 *     content-encoding, and
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
let failed = null;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'overhead', type: 'module', webjs: {} }));
  w('app/layout.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default ({ children }: { children: unknown }) => html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;`);
  w('app/page.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default () => html\`<main>\${'${MARKER}'.repeat(300)}</main>\`;`);
  // Echo the framework-trusted client IP so we can prove the stamp reached it.
  w('app/api/ip/route.ts', `import { clientIp } from ${JSON.stringify(SERVER)};\nexport async function GET(req: Request) {\n  return new Response(clientIp(req), { headers: { 'content-type': 'text/plain' } });\n}`);
  // A page `action` (the no-JS form write path) that echoes clientIp into the
  // redirect Location. The action receives a REBUILT request (parseFormBody),
  // so this proves the trusted IP survives the rebuild and a spoofed header
  // does not win (#756 review must-fix).
  w('app/ipcheck/page.ts', `import { html, redirect } from ${JSON.stringify(CORE)};\nimport { clientIp } from ${JSON.stringify(SERVER)};\nexport const action = async ({ request }: { request: Request }) => { throw redirect('/?seenip=' + encodeURIComponent(clientIp(request))); };\nexport default () => html\`<main>ipcheck</main>\`;`);

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

  // (3) The spoof must not survive the page-action request rebuild (#756 review).
  const actRes = await fetch(`${base}/ipcheck`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-webjs-remote-ip': '6.6.6.6' },
    body: 'x=1',
  });
  const loc = actRes.headers.get('location') || '';
  assert.ok(/seenip=/.test(loc), `[${runtime}] the action redirected with the seen ip (loc=${loc})`);
  assert.ok(!/seenip=6\.6\.6\.6/.test(loc), `[${runtime}] a spoofed header must NOT survive the page-action rebuild`);
  assert.ok(!/seenip=_anon_/.test(loc), `[${runtime}] the trusted IP survived the rebuild (not anon)`);

  await close();
  close = null;
  console.log(`OK  listener-overhead #756 passed on ${runtime} (buffered compress decodes + trusted IP stamped, ip=${ip})`);
} catch (err) {
  // Report failures EXPLICITLY rather than letting them propagate as an
  // unhandled top-level-await rejection: Bun exits 0 without flushing the error
  // for a TLA rejection inside a `try/finally`, which would silently swallow a
  // real regression (and make `scripts/run-bun-tests.js` see a false pass). A
  // hard `process.exit(1)` after printing the message keeps the assertion a real
  // guard under BOTH runtimes.
  failed = err;
} finally {
  try { if (close) await close(); } catch {}
  rmSync(dir, { recursive: true, force: true });
}
if (failed) {
  console.error(`FAIL listener-overhead #756 on ${runtime}: ${failed?.stack || failed?.message || failed}`);
  process.exit(1);
}
