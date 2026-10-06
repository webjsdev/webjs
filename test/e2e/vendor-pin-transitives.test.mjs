/**
 * End-to-end test: a pinned vendor package with transitive bare-specifier
 * dependencies loads in a real browser (#1518).
 *
 * The committed pin (`.webjs/vendor/importmap.json`) holds the whole flattened
 * graph, but the serve path pruned it to what app code imports directly, so a
 * transitive (`@codemirror/view` -> `style-mod`) was missing from the import map
 * and the browser failed to resolve it. The staged app pins three packages in
 * download mode (bundles served from `/__webjs/vendor/`, so no network): a
 * component imports `fx-top`, which imports `fx-mid`, which imports `fx-leaf`.
 * The component writes what the chain returns into the DOM, so the assertion
 * is that the module graph actually executed in the browser.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/vendor-pin-transitives.test.mjs
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, () => { const { port } = srv.address(); srv.close(() => res(port)); });
    srv.on('error', rej);
  });
}

function write(file, body) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
}

// A fake package, installed for the server (SSR imports the component) and
// pinned as a downloaded bundle for the browser.
const PKGS = {
  'fx-top': { deps: { 'fx-mid': '1.0.0' }, src: "import { mid } from 'fx-mid';\nexport const top = () => 'top>' + mid();\n" },
  'fx-mid': { deps: { 'fx-leaf': '1.0.0' }, src: "import { leaf } from 'fx-leaf';\nexport const mid = () => 'mid>' + leaf();\n" },
  'fx-leaf': { deps: {}, src: "export const leaf = () => 'leaf';\n" },
};

function stageApp() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-pin-trans-e2e-'));
  write(join(dir, 'package.json'), JSON.stringify({
    name: 'pin-trans-app', private: true, type: 'module', imports: { '#*': './*' },
    dependencies: { 'fx-top': '1.0.0' },
  }));
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  for (const p of ['core', 'server']) symlinkSync(join(ROOT, 'packages', p), join(dir, 'node_modules/@webjsdev', p));
  const imports = {};
  for (const [name, { deps, src }] of Object.entries(PKGS)) {
    write(join(dir, 'node_modules', name, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: 'module', main: 'index.js', dependencies: deps }));
    write(join(dir, 'node_modules', name, 'index.js'), src);
    write(join(dir, '.webjs/vendor', `${name}@1.0.0.js`), src);
    imports[name] = `/__webjs/vendor/${name}@1.0.0.js`;
  }
  write(join(dir, '.webjs/vendor/importmap.json'), JSON.stringify({ imports }, null, 2));
  write(join(dir, 'components/chain-el.ts'), `import { WebComponent, html } from '@webjsdev/core';
import { top } from 'fx-top';

class ChainEl extends WebComponent({}) {
  firstUpdated() { this.setAttribute('data-chain', top()); }
  render() { return html\`<button @click=\${() => this.setAttribute('data-clicked', '1')}>chain</button>\`; }
}
ChainEl.register('chain-el');
`);
  write(join(dir, 'app/layout.ts'), `import { html, type LayoutProps } from '@webjsdev/core';
import '#components/chain-el.ts';
export default function RootLayout({ children }: LayoutProps) {
  return html\`<main><chain-el></chain-el>\${children}</main>\`;
}
`);
  write(join(dir, 'app/page.ts'), `import { html } from '@webjsdev/core';
export default function Home() { return html\`<h1>home</h1>\`; }
`);
  return dir;
}

function startDev(dir, port) {
  const cli = resolve(ROOT, 'packages', 'cli', 'bin', 'webjs.js');
  return new Promise((res, rej) => {
    const child = spawn(process.execPath, [cli, 'dev', '--port', String(port)], {
      cwd: dir,
      env: { ...process.env, __WEBJS_DEV_CHILD: '1', NODE_ENV: 'development' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    let log = '';
    const onData = (chunk) => {
      log += chunk.toString();
      if (!started && log.includes('ready on')) { started = true; res(child); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', rej);
    child.on('exit', (code) => { if (!started) rej(new Error(`dev server exited with ${code} before ready\n${log}`)); });
    setTimeout(() => { if (!started) rej(new Error(`dev server start timeout\n${log}`)); }, 20000);
  });
}

describe('E2E: a pinned package with transitive deps loads in the browser (#1518)', {
  skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests',
}, () => {
  let browser, page, child, dir, base;
  const errors = [];

  before(async () => {
    const puppeteer = (await import('puppeteer-core')).default;
    dir = stageApp();
    const port = await freePort();
    child = await startDev(dir, port);
    base = `http://localhost:${port}`;
    browser = await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e && e.message)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  });

  after(async () => {
    if (browser) await browser.close();
    if (child) { try { child.kill('SIGTERM'); } catch { /* already gone */ } }
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('the served import map carries the transitives, and the chain runs', async () => {
    await page.goto(base + '/', { waitUntil: 'networkidle2' });
    const map = await page.evaluate(() => JSON.parse(document.querySelector('script[type="importmap"]').textContent));
    for (const name of Object.keys(PKGS)) assert.ok(map.imports[name], `${name} is in the import map`);
    await page.waitForFunction(() => document.querySelector('chain-el')?.getAttribute('data-chain'), { timeout: 10000 })
      .catch(() => {});
    assert.equal(await page.evaluate(() => document.querySelector('chain-el')?.getAttribute('data-chain')), 'top>mid>leaf',
      `the transitive chain executed in the browser (errors: ${errors.join(' | ')})`);
  });
});
