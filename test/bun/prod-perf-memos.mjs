/**
 * Cross-runtime proof for the production render memos (#1644). WebJs runs on
 * Node 24+ OR Bun, and the per-build memos sit on the SSR hot path of both
 * shells, so the served bytes must stay identical across renders and across
 * runtimes. Run from the repo root:
 *
 *   node test/bun/prod-perf-memos.mjs   # node:http shell
 *   bun  test/bun/prod-perf-memos.mjs   # Bun.serve shell
 *
 * Asserts, under WHICHEVER runtime runs it, against a PROD (`dev: false`)
 * server, which is where the memos are live (dev never fingerprints and
 * re-derives everything per rebuild):
 * (1) two renders of the same page are byte-identical apart from the CSP
 *     nonce, so a memo serving the second render changed nothing observable;
 * (2) the importmap JSON is the same string across the two renders (the tag
 *     body memo) while the nonce attribute differs (assembled per call),
 * (2b) a `WEBJS_PUBLIC_*` variable set AFTER the first render is not in the
 *     second (the env shim is a per-build snapshot), and
 * (3) a `static lazy` component rendered by the page is registered with the
 *     lazy loader rather than imported by the boot, and the Node shell's 103
 *     Early Hints still name the interactive component (Bun.serve has no
 *     informational response API, so on Bun the boot script alone is checked).
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connect } from 'node:net';
import { startServer } from '@webjsdev/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = pathToFileURL(resolve(__dirname, '../../packages/core/index.js')).toString();
const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

/**
 * The raw HTTP/1.1 exchange for a GET, INCLUDING any 103 informational
 * response that precedes the final one (fetch swallows those). Resolves the
 * whole lowercased text up to the end of the final header block.
 * @param {number} port @param {string} path
 * @returns {Promise<string>}
 */
function rawExchange(port, path) {
  return new Promise((resolvePromise, reject) => {
    const sock = connect(port, 'localhost', () => {
      sock.write(`GET ${path} HTTP/1.1\r\nHost: localhost:${port}\r\nConnection: close\r\n\r\n`);
    });
    let buf = '';
    sock.setTimeout(4000, () => { sock.destroy(); reject(new Error('rawExchange timeout')); });
    sock.on('data', (d) => { buf += d.toString('latin1'); });
    sock.on('error', reject);
    sock.on('end', () => resolvePromise(buf.toLowerCase()));
  });
}

const dir = mkdtempSync(join(tmpdir(), 'webjs-1644-'));
const w = (rel, body) => { const abs = join(dir, rel); mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, body); };

let close;
let failed = null;
try {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'memos', type: 'module', webjs: { csp: true } }));
  w('app/layout.ts', `import { html } from ${JSON.stringify(CORE)};\nexport default ({ children }: { children: unknown }) => html\`<header>memo proof</header>\${children}\`;`);
  w('app/page.ts', `import { html } from ${JSON.stringify(CORE)};\nimport '../components/hot-button.ts';\nimport '../components/lazy-panel.ts';\nexport default () => html\`<main><hot-button></hot-button><lazy-panel></lazy-panel><p>\${'x'.repeat(1200)}</p></main>\`;`);
  // An interactive component, so the page ships a boot script and the Node
  // shell sends 103 Early Hints for its module.
  w('components/hot-button.ts', `import { WebComponent, html } from ${JSON.stringify(CORE)};\nclass HotButton extends WebComponent({ n: Number }) {\n  constructor() { super(); this.n = 0; }\n  render() { return html\`<button @click=\${() => { this.n++; }}>\${this.n}</button>\`; }\n}\nHotButton.register('hot-button');`);
  // A lazy component: registered with the lazy loader by the boot, never
  // imported up front, so it must not be early-hinted either.
  w('components/lazy-panel.ts', `import { WebComponent, html } from ${JSON.stringify(CORE)};\nclass LazyPanel extends WebComponent({ open: Boolean }) {\n  static lazy = true;\n  constructor() { super(); this.open = false; }\n  render() { return html\`<section @click=\${() => { this.open = !this.open; }}>lazy</section>\`; }\n}\nLazyPanel.register('lazy-panel');`);

  let server;
  ({ server, close } = await startServer({ appDir: dir, dev: false, compress: false, port: 0, logger: quiet }));
  const port = typeof server.port === 'number' ? server.port : server.address().port;
  const base = `http://localhost:${port}`;

  // Warm: the first request runs the analysis and the first vendor attempt.
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${base}/__webjs/ready`);
    if (r.status === 200) break;
    await new Promise((res) => setTimeout(res, 100));
  }

  const one = await (await fetch(`${base}/`)).text();
  // Set AFTER the first render: the env shim is a per-build snapshot, so this
  // must not be picked up until the next build.
  process.env.WEBJS_PUBLIC_LATE = 'late-value';
  const two = await (await fetch(`${base}/`)).text();
  delete process.env.WEBJS_PUBLIC_LATE;

  // (1) byte-identical modulo the nonce (CSP is on, so every render mints one).
  const nonceOf = (html) => /<meta name="csp-nonce" content="([^"]+)">/.exec(html)?.[1];
  const n1 = nonceOf(one);
  const n2 = nonceOf(two);
  assert.ok(n1 && n2, `[${runtime}] both renders carry a CSP nonce`);
  assert.notEqual(n1, n2, `[${runtime}] the nonce is minted per request`);
  assert.equal(one.split(n1).join('NONCE'), two.split(n2).join('NONCE'), `[${runtime}] two renders are byte-identical apart from the nonce`);
  assert.ok(one.includes('memo proof') && one.includes('<hot-button'), `[${runtime}] the page rendered`);

  // (2) the importmap JSON body is one string across renders; the attribute
  // block (nonce) differs.
  const mapOf = (html) => /<script type="importmap"([^>]*)>(.*?)<\/script>/s.exec(html);
  const m1 = mapOf(one);
  const m2 = mapOf(two);
  assert.ok(m1 && m2, `[${runtime}] both renders carry an importmap`);
  assert.equal(m1[2], m2[2], `[${runtime}] the importmap JSON is memoized per build`);
  assert.ok(m1[1].includes(`nonce="${n1}"`) && m2[1].includes(`nonce="${n2}"`), `[${runtime}] the importmap tag carries each render's own nonce`);

  assert.ok(one.includes('"NODE_ENV":"production"'), `[${runtime}] the shim carries NODE_ENV`);
  assert.ok(!two.includes('WEBJS_PUBLIC_LATE'), `[${runtime}] a WEBJS_PUBLIC_* set after the first render is not reflected until the next build`);

  // The lazy component is registered with the lazy loader, not imported.
  assert.ok(/import "\/components\/hot-button\.ts[^"]*";/.test(one), `[${runtime}] the boot imports the interactive component`);
  assert.ok(!/import "\/components\/lazy-panel\.ts/.test(one), `[${runtime}] the boot does not import the lazy component`);
  assert.ok(one.includes('lazy-panel'), `[${runtime}] the lazy component is registered with the lazy loader`);
  if (!process.versions.bun) {
    const raw = await rawExchange(port, '/');
    assert.ok(raw.includes('http/1.1 103'), `[${runtime}] the node shell sends 103 Early Hints`);
    const hints = raw.slice(0, raw.indexOf('http/1.1 200'));
    assert.ok(hints.includes('/components/hot-button.ts'), `[${runtime}] the interactive component is early-hinted`);
    assert.ok(!hints.includes('/components/lazy-panel.ts'), `[${runtime}] the lazy component is NOT early-hinted (the hints share the boot's assembly)`);
  }

  console.log(`OK  prod-perf-memos #1644 passed on ${runtime} (identical renders modulo nonce, memoized importmap body)`);
} catch (err) {
  failed = err;
} finally {
  try { if (close) await close(); } catch {}
  rmSync(dir, { recursive: true, force: true });
}
if (failed) {
  console.error(`FAIL prod-perf-memos #1644 on ${runtime}: ${failed?.stack || failed?.message || failed}`);
  if (import.meta.main) process.exit(1);
  else throw failed;
}
