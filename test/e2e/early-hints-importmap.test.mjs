/**
 * End-to-end test: a page served by the Node listener runs its JavaScript in
 * Chromium, Firefox and WebKit, 103 Early Hints included.
 *
 * The Node shell sends `103 Early Hints` ahead of the page. Those hints used
 * to be `rel=modulepreload`, and Firefox treats a modulepreload as the start
 * of module loading: it then refuses the page's import map ("Import maps are
 * not allowed after a module load or preload has started"), every bare
 * `@webjsdev/core` import fails, and no component upgrades. Chromium and
 * WebKit ignore a modulepreload in a 103, so only Firefox broke. The hints are
 * now plain `rel=preload; as=script` (see `earlyHintLinks` in
 * packages/server/src/ssr/shipped-modules.js), which never starts module
 * loading on any engine.
 *
 * The staged app is served in process by `startServer` (the node:http shell,
 * prod mode, which is where the hints are sent), and each engine must upgrade
 * the page's component. An engine Playwright has no browser for is skipped
 * rather than failed. About 10 seconds.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/early-hints-importmap.test.mjs
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

function write(file, body) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}

function stageApp() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-early-hints-e2e-'));
  write(join(dir, 'package.json'), JSON.stringify({ name: 'early-hints-app', private: true, type: 'module', imports: { '#*': './*' } }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  for (const p of ['core', 'server']) symlinkSync(join(ROOT, 'packages', p), join(dir, 'node_modules/@webjsdev', p));
  write(join(dir, 'components/hint-probe.ts'), `import { WebComponent, html } from '@webjsdev/core';

class HintProbe extends WebComponent({ n: Number }) {
  constructor() { super(); this.n = 0; }
  firstUpdated() { this.setAttribute('data-upgraded', 'yes'); }
  render() { return html\`<button @click=\${() => { this.n++; }}>\${this.n}</button>\`; }
}
HintProbe.register('hint-probe');
`);
  write(join(dir, 'app/page.ts'), `import { html } from '@webjsdev/core';
import '#components/hint-probe.ts';
export default function Home() { return html\`<main><h1>early hints</h1><hint-probe></hint-probe></main>\`; }
`);
  return dir;
}

/** The raw HTTP/1.1 exchange, including any 103 that precedes the final response. */
function rawExchange(port, path) {
  return new Promise((res, rej) => {
    const sock = connect(port, 'localhost', () => {
      sock.write(`GET ${path} HTTP/1.1\r\nHost: localhost:${port}\r\nConnection: close\r\n\r\n`);
    });
    let buf = '';
    sock.setTimeout(5000, () => { sock.destroy(); rej(new Error('rawExchange timeout')); });
    sock.on('data', (d) => { buf += d.toString('latin1'); });
    sock.on('error', rej);
    sock.on('end', () => res(buf));
  });
}

describe('E2E: a Node-served page runs its JavaScript with 103 Early Hints, in every engine', {
  skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests',
}, () => {
  let dir, close, port, playwright;

  before(async () => {
    playwright = await import('playwright');
    dir = stageApp();
    const { startServer } = await import('@webjsdev/server');
    let server;
    ({ server, close } = await startServer({ appDir: dir, dev: false, compress: false, port: 0, logger: quiet }));
    port = server.address().port;
    for (let i = 0; i < 60; i++) {
      if ((await fetch(`http://localhost:${port}/__webjs/ready`)).status === 200) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  after(async () => {
    if (close) await close();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('the Node shell sends 103 Early Hints for the boot module, as a plain preload', async () => {
    const raw = await rawExchange(port, '/');
    assert.match(raw, /^HTTP\/1\.1 103/i, 'a 103 precedes the page');
    const hints = raw.slice(0, raw.search(/HTTP\/1\.1 200/i));
    assert.match(hints, /\/components\/hint-probe\.ts[^>]*>; rel=preload; as=script; crossorigin=anonymous/);
    assert.doesNotMatch(hints, /modulepreload/i, 'no module preload can start before the import map');
  });

  for (const engine of ['chromium', 'firefox', 'webkit']) {
    test(`${engine} upgrades the component (the import map was honoured)`, async (t) => {
      let browser;
      try {
        browser = await playwright[engine].launch();
      } catch (e) {
        t.skip(`no ${engine} for Playwright here: ${String(e.message).split('\n')[0]}`);
        return;
      }
      try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        page.on('console', (m) => { if (m.type() === 'error' || /import map/i.test(m.text())) errors.push(m.text()); });
        await page.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
        await page.waitForFunction(() => document.querySelector('hint-probe')?.getAttribute('data-upgraded') === 'yes', null, { timeout: 8000 })
          .catch(() => {});
        const upgraded = await page.evaluate(() => document.querySelector('hint-probe')?.getAttribute('data-upgraded'));
        assert.equal(upgraded, 'yes', `${engine} ran the component (errors: ${errors.join(' | ')})`);
        await page.click('hint-probe button');
        await page.waitForFunction(() => document.querySelector('hint-probe button')?.textContent === '1', null, { timeout: 3000 });
      } finally {
        await browser.close();
      }
    });
  }
});
