/**
 * Integration tests for CSP nonce minting + Content-Security-Policy header
 * emission (issue #233). Exercised through createRequestHandler so they
 * cover the real response pipeline (mint -> request store -> SSR
 * `cspNonce()` -> header), not the helpers in isolation. Web-standard
 * Request/Response, no real HTTP server.
 *
 * The headline invariant: when CSP is enabled, the nonce on the
 * Content-Security-Policy header's `script-src` directive EQUALS the
 * `nonce=` attribute on every inline `<script>` / meta tag the SSR
 * pipeline emitted, it changes every request, and disabling CSP (the
 * default) restores the pre-#233 output (no header, no nonce).
 *
 * COUNTERFACTUAL: reverting the mint+store+emit wiring in dev.js (so the
 * nonce is never minted and `cspNonce()` returns '') makes the
 * nonce-match and per-request-change tests fail.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import { readCspConfig, mintNonce, buildCspHeader, cspHeaderName } from '../../src/csp.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_URL = pathToFileURL(
  resolve(__dirname, '../../../core/src/html.js')
).toString();

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-csp-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

function page(body) {
  return (
    `import { html } from ${JSON.stringify(HTML_URL)};\n` +
    `export default function P() { return html\`${body}\`; }\n`
  );
}

const pkg = (csp) =>
  JSON.stringify({ name: 'csp-app', type: 'module', webjs: { csp } });

/** Pull the script-src nonce out of a CSP header value. */
function headerNonce(csp) {
  const m = /nonce-([^']+)/.exec(csp || '');
  return m ? m[1] : null;
}

/** All distinct `nonce="..."` attribute values in an HTML body. */
function bodyNonces(html) {
  return [...new Set([...html.matchAll(/nonce="([^"]+)"/g)].map((m) => m[1]))];
}

/* ------------ helper-level unit checks ------------ */

test('readCspConfig: disabled by default and on false/garbage', () => {
  assert.equal(readCspConfig(undefined).enabled, false);
  assert.equal(readCspConfig({}).enabled, false);
  assert.equal(readCspConfig({ webjs: {} }).enabled, false);
  assert.equal(readCspConfig({ webjs: { csp: false } }).enabled, false);
  // A string is malformed: fail closed, not crash.
  assert.equal(readCspConfig({ webjs: { csp: 'yes' } }).enabled, false);
});

test('readCspConfig: true enables the strict default policy', () => {
  const c = readCspConfig({ webjs: { csp: true } });
  assert.equal(c.enabled, true);
  assert.match(c.directives['script-src'], /'nonce-__NONCE__'/);
  assert.match(c.directives['script-src'], /'strict-dynamic'/);
  assert.equal(c.directives['object-src'], "'none'");
});

test('mintNonce: CSPRNG, distinct every call, in the nonce charset', () => {
  const a = mintNonce();
  const b = mintNonce();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9+/=]+$/);
});

test('buildCspHeader: substitutes the nonce and joins directives', () => {
  const c = readCspConfig({ webjs: { csp: true } });
  const v = buildCspHeader(c, 'ABC123');
  assert.match(v, /script-src 'nonce-ABC123' 'strict-dynamic'/);
  assert.ok(!v.includes('__NONCE__'));
});

/* ------------ enabled: header nonce equals body nonce (no drift) ------------ */

test('enabled: the CSP header nonce equals the inline-script nonce', async () => {
  const appDir = makeApp({
    'package.json': pkg(true),
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/'));
  const csp = resp.headers.get('content-security-policy');
  assert.ok(csp, 'a Content-Security-Policy header is set when CSP is enabled');
  const hNonce = headerNonce(csp);
  assert.ok(hNonce, 'the script-src directive carries a nonce');

  const body = await resp.text();
  const bNonces = bodyNonces(body);
  assert.ok(bNonces.length > 0, 'the SSR body has nonce-stamped inline scripts');
  // The headline invariant: every nonce in the body is the SAME minted
  // value the header advertises. No drift.
  for (const n of bNonces) assert.equal(n, hNonce);
});

test('enabled: the nonce changes on every request (CSPRNG, per-request)', async () => {
  const appDir = makeApp({
    'package.json': pkg(true),
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const r1 = await app.handle(new Request('http://x/'));
  const r2 = await app.handle(new Request('http://x/'));
  const n1 = headerNonce(r1.headers.get('content-security-policy'));
  const n2 = headerNonce(r2.headers.get('content-security-policy'));
  assert.ok(n1 && n2);
  assert.notEqual(n1, n2);
  // And the body of each request matches its own header nonce.
  assert.ok((await r1.text()).includes(`nonce="${n1}"`));
  assert.ok((await r2.text()).includes(`nonce="${n2}"`));
});

/* ------------ disabled (default): unchanged ------------ */

test('disabled (default): no CSP header and no nonce on scripts', async () => {
  const appDir = makeApp({
    // No webjs.csp key at all.
    'package.json': JSON.stringify({ name: 'plain', type: 'module' }),
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/'));
  assert.equal(resp.headers.get('content-security-policy'), null);
  assert.equal(resp.headers.get('content-security-policy-report-only'), null);
  const body = await resp.text();
  assert.equal(bodyNonces(body).length, 0, 'no nonce attribute when CSP is off');
});

test('disabled: csp:false behaves like absent', async () => {
  const appDir = makeApp({
    'package.json': pkg(false),
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/'));
  assert.equal(resp.headers.get('content-security-policy'), null);
});

/* ------------ custom policy via config ------------ */

test('custom: a directive override via config is honored, nonce still injected', async () => {
  const appDir = makeApp({
    'package.json': pkg({ directives: { 'connect-src': "'self' https://api.example.com" } }),
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/'));
  const csp = resp.headers.get('content-security-policy');
  assert.match(csp, /connect-src 'self' https:\/\/api\.example\.com/);
  // The strict script-src default is still applied with the live nonce.
  const hNonce = headerNonce(csp);
  assert.ok(hNonce);
  assert.ok((await resp.text()).includes(`nonce="${hNonce}"`));
});

test('custom: reportOnly emits the report-only header instead', async () => {
  const appDir = makeApp({
    'package.json': pkg({ reportOnly: true }),
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/'));
  assert.equal(resp.headers.get('content-security-policy'), null);
  const ro = resp.headers.get('content-security-policy-report-only');
  assert.ok(ro);
  assert.ok(headerNonce(ro));
});

test('custom: a null directive value drops that default directive', async () => {
  const appDir = makeApp({
    'package.json': pkg({ directives: { 'frame-ancestors': null } }),
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/'));
  const csp = resp.headers.get('content-security-policy');
  assert.ok(!csp.includes('frame-ancestors'));
  assert.match(csp, /script-src/);
});

/* ------------ framework's own pages render under CSP, on AND off ------------ */

test('the framework pages render identically (modulo nonce) with CSP on and off', async () => {
  const files = (csp) => ({
    'package.json': pkg(csp),
    'app/layout.js':
      `import { html } from ${JSON.stringify(HTML_URL)};\n` +
      `export default function L({ children }) { return html\`<main>\${children}</main>\`; }\n`,
    'app/page.js': page('<h1>home</h1><p>body</p>'),
  });
  const offApp = await createRequestHandler({ appDir: makeApp(files(false)), dev: true });
  const onApp = await createRequestHandler({ appDir: makeApp(files(true)), dev: true });
  const off = await offApp.handle(new Request('http://x/'));
  const on = await onApp.handle(new Request('http://x/'));
  assert.equal(off.status, 200);
  assert.equal(on.status, 200);
  const offBody = await off.text();
  const onBody = await on.text();
  // Both render the page content; CSP-on only adds nonce attributes.
  assert.ok(offBody.includes('<h1>home</h1>'));
  assert.ok(onBody.includes('<h1>home</h1>'));
  // Stripping the nonce attributes makes the two bodies equal, proving CSP
  // changes nothing but the nonce stamping.
  const strip = (s) => s.replace(/ nonce="[^"]+"/g, '').replace(/<meta name="csp-nonce"[^>]*>/g, '');
  assert.equal(strip(onBody), strip(offBody));
});

/* ------------ app-set CSP wins (precedence) ------------ */

test('an app-set CSP header is not clobbered by the framework default', async () => {
  const appDir = makeApp({
    'package.json': pkg(true),
    'middleware.js':
      `export default async function (req, next) {\n` +
      `  const res = await next();\n` +
      `  res.headers.set('content-security-policy', \"default-src 'self'\");\n` +
      `  return res;\n` +
      `}\n`,
    'app/page.js': page('<h1>home</h1>'),
  });
  const app = await createRequestHandler({ appDir, dev: true });
  const resp = await app.handle(new Request('http://x/'));
  assert.equal(resp.headers.get('content-security-policy'), "default-src 'self'");
});
