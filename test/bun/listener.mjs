/**
 * Cross-runtime LISTENER parity test (#511): boot a real webjs app through
 * `startServer` (not just `createRequestHandler`) and exercise the full listening
 * path under WHICHEVER runtime executes this file. The SAME assertions must pass
 * on both shells, which is the parity proof:
 *
 *   node test/bun/listener.mjs   # exercises the node:http shell (startNodeListener)
 *   bun  test/bun/listener.mjs   # exercises the Bun.serve shell (startBunListener)
 *
 * Covers, on both shells: SSR over a real socket, a `route.ts` GET with the
 * framework-stamped `x-webjs-remote-ip`, gzip negotiation, the SSE live-reload
 * stream, a WebSocket `WS` export echo (proving the BunWsAdapter shim matches the
 * node `ws`-library contract), and a clean `close()`. A plain assert script (not
 * node:test) so the SAME file runs identically on both runtimes; it exits
 * non-zero on failure. Run from the repo root so the bare `@webjsdev/server`
 * specifier resolves to the workspace package, not a stale published copy.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startServer, hashFile } from '@webjsdev/server';
import { stringify } from '@webjsdev/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();
const SERVER = pathToFileURL(resolve(__dirname, '../../packages/server/index.js')).toString();
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
// A silent logger so the parity run does not spam request logs.
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

const dir = mkdtempSync(join(tmpdir(), 'webjs-listener-parity-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };

let server, close;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'parity', type: 'module', webjs: {} }));
  w('app/layout.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default ({ children }: { children: unknown }) => html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;\n`);
  w('app/page.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default function Page() { return html\`<main><h1>hello listener</h1></main>\`; }\n`);
  // Read the framework-trusted remote IP via `clientIp` (NOT the raw header):
  // the node shell stamps `x-webjs-remote-ip` on the request, but the Bun shell
  // stamps it OUT OF BAND via a WeakMap (#756, no per-request Request clone), so
  // the header is intentionally absent on Bun and `clientIp` is the canonical
  // cross-runtime accessor that reads whichever the runtime used.
  w('app/api/echo/route.ts', `import { clientIp } from ${JSON.stringify(SERVER)};\nexport async function GET(req: Request) {\n  const ip = clientIp(req);\n  return Response.json({ ok: true, ip: ip && ip !== '_anon_' ? 'stamped' : 'missing' });\n}\nexport function WS(ws: any, req: Request) {\n  ws.on('message', (m: any) => {\n    if (String(m) === 'whoami') ws.send('ip:' + clientIp(req));\n    else ws.send('echo:' + m);\n  });\n}\n`);
  // A server action, to exercise the Origin / Sec-Fetch-Site CSRF check (#659)
  // over the REAL socket on this runtime.
  const actionFile = join(dir, 'actions/ping.server.ts');
  w('actions/ping.server.ts', `'use server';\nexport async function ping() { return { pong: true }; }\n`);

  ({ server, close } = await startServer({ appDir: dir, dev: true, port: 0, logger: quiet }));
  const port = server.port ?? server.address().port;
  const base = `http://localhost:${port}`;

  // 1. SSR over a real socket.
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200, 'GET / should be 200');
  const pageHtml = await page.text();
  assert.ok(pageHtml.includes('hello listener'), `SSR HTML should render; got:\n${pageHtml.slice(0, 200)}`);
  // No CSRF cookie: the SSR response is cookieless, so it is CDN-cacheable.
  assert.ok(!page.headers.get('set-cookie'), `SSR response must set no cookie; got: ${page.headers.get('set-cookie')}`);

  // 1b. Action CSRF (Origin / Sec-Fetch-Site) over the REAL socket: the shell
  //     must preserve the request headers so the check sees them.
  const hash = await hashFile(actionFile);
  const actionUrl = `${base}/__webjs/action/${hash}/ping`;
  const body = await stringify([]);
  const ct = { 'content-type': 'application/vnd.webjs+json' };
  const sameOrigin = await fetch(actionUrl, { method: 'POST', headers: { ...ct, 'sec-fetch-site': 'same-origin' }, body });
  assert.equal(sameOrigin.status, 200, 'a same-origin action POST passes the CSRF check');
  const crossSite = await fetch(actionUrl, { method: 'POST', headers: { ...ct, 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' }, body });
  assert.equal(crossSite.status, 403, 'a cross-site action POST is rejected (403) over the socket');

  // 2. route.ts GET reads the framework-trusted remote IP via clientIp (header on
  //    node, out-of-band WeakMap on Bun, #756).
  const echo = await fetch(`${base}/api/echo`);
  assert.equal(echo.status, 200, 'route GET should be 200');
  const j = await echo.json();
  assert.equal(j.ok, true, 'route handler ran');
  assert.equal(j.ip, 'stamped', 'x-webjs-remote-ip is stamped from the socket on this runtime');

  // 3. gzip negotiation (compress defaults off in dev, so request it explicitly is
  //    a no-op in dev; assert the page still serves with an Accept-Encoding header).
  const gz = await fetch(`${base}/`, { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(gz.status, 200, 'gzip-accepting request still serves 200');
  assert.ok((await gz.text()).includes('hello listener'), 'gzip-accepting request body decodes');

  // 4. SSE live-reload stream emits the hello frame.
  const sse = await fetch(`${base}/__webjs/events`, { headers: { accept: 'text/event-stream' } });
  assert.equal(sse.status, 200, 'SSE endpoint is 200 in dev');
  assert.ok((sse.headers.get('content-type') || '').includes('text/event-stream'), 'SSE content type');
  const reader = sse.body.getReader();
  const { value } = await reader.read();
  const chunk = new TextDecoder().decode(value);
  assert.ok(chunk.includes('event: hello'), `SSE stream opens with the hello frame; got: ${JSON.stringify(chunk)}`);
  await reader.cancel();

  // 5. WebSocket over a real socket, on ONE connection (the BunWsAdapter shim must
  //    match the ws-library EventEmitter contract: `.on('message')` / `.send()`),
  //    covering two things in sequence:
  //      (a) the `WS` export echoes a message, and
  //      (b) WS upgrade IP-trust (#778): a `WS` handler's `clientIp(req)` returns
  //          the framework-trusted SOCKET IP, never a client-supplied (spoofable)
  //          `x-webjs-remote-ip` sent on the upgrade (the WS-seam analog of the
  //          #773 fetch-path fix). The upgrade is stamped out-of-band on BOTH
  //          runtimes (the WeakMap is authoritative and ignores the inbound
  //          header). The connection is local, so the trusted IP is a loopback
  //          address: assert it is present (non-anon) AND not the spoofed value.
  //          Without the fix, `clientIp` falls back to the spoofed inbound header
  //          on both runtimes, so the assertion goes red.
  //    One connection (not two) keeps this reliable on Bun, where a second WS
  //    after the first closed did not settle its promise.
  await new Promise((res, rej) => {
    const ws = new WebSocket(`ws://localhost:${port}/api/echo`, {
      headers: { 'x-webjs-remote-ip': '9.9.9.9' },
    });
    const timer = setTimeout(() => rej(new Error('WebSocket sequence timed out')), 5000);
    // Close the socket on EVERY exit path (success and failure), else a failed
    // assertion leaves the connection open and the later `close()` waits on it.
    const done = (err) => { clearTimeout(timer); try { ws.close(); } catch {} err ? rej(err) : res(); };
    ws.onopen = () => ws.send('ping');
    ws.onmessage = (e) => {
      try {
        const data = String(e.data);
        if (data.startsWith('echo:')) {
          assert.equal(data, 'echo:ping', 'the WS export echoes the message');
          ws.send('whoami');  // now probe the trusted IP on the same socket
          return;
        }
        const ip = data.replace(/^ip:/, '');
        assert.notEqual(ip, '9.9.9.9', 'a spoofed x-webjs-remote-ip on the WS upgrade must NOT reach clientIp');
        assert.ok(ip && ip !== '_anon_', `the trusted socket IP must reach clientIp in the WS handler; got ${JSON.stringify(ip)}`);
        done();
      } catch (err) { done(err); }
    };
    ws.onerror = (e) => done(new Error('WebSocket errored: ' + (e?.message || 'unknown')));
  });

  // 6. Clean shutdown.
  await close();
  close = null;

  console.log(`OK  webjs listener parity passed on ${runtime} (SSR + route + SSE + WebSocket over a real socket)`);
} catch (err) {
  // Fail LOUD and with a non-zero exit. Do NOT rely on an unhandled top-level
  // rejection to set the exit code: Bun does not propagate an async promise
  // rejection (a failed assertion inside a WS `onmessage`) through this
  // try/finally to a non-zero exit, so a real regression would otherwise pass
  // the Bun job silently. An explicit `process.exit(1)` makes both runtimes fail.
  console.error(`FAIL webjs listener parity on ${runtime}: ${err?.message || err}`);
  try {
    if (close) await Promise.race([close(), new Promise((r) => setTimeout(r, 3000))]);
  } catch {}
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
} finally {
  // Bound the shutdown so a hung `close()` on the success path cannot hang the
  // process at exit.
  try { if (close) await Promise.race([close(), new Promise((r) => setTimeout(r, 3000))]); } catch {}
  rmSync(dir, { recursive: true, force: true });
}
