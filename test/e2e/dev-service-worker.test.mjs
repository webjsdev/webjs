/**
 * E2E (#1689): under `webjs dev` a registered `/sw.js` switches itself off.
 *
 * A caching service worker on a dev origin serves `.js` and `.css`
 * stale-while-revalidate, so a tab that once registered one stays an edit
 * behind. The dev server answers `/sw.js` with a kill switch whatever the app
 * ships: it clears the caches, unregisters, and claims the tab, so a later
 * component edit reaches the page fresh.
 *
 * Runs against the dev-morph fixture (a counter component, a page, a layout)
 * under the supervised Node `webjs dev`, in real Chromium.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const FIXTURE = resolve(__dirname, 'fixtures', 'dev-morph-app');

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
    srv.on('error', rej);
  });
}

function stageApp() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-sw-e2e-'));
  cpSync(FIXTURE, dir, { recursive: true });
  // A caching worker of the shape the scaffold ships: it would answer every
  // module request from its cache if it were ever served in dev.
  writeFileSync(join(dir, 'public/sw.js'), `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.open('stale').then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; }))));
});
`);
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  for (const pkg of ['core', 'server']) {
    symlinkSync(join(ROOT, 'packages', pkg), join(dir, 'node_modules/@webjsdev', pkg));
  }
  return dir;
}

function startDev(dir, port) {
  const cli = resolve(ROOT, 'packages', 'cli', 'bin', 'webjs.js');
  return new Promise((res, rej) => {
    const child = spawn(process.execPath, [cli, 'dev', '--port', String(port)], {
      cwd: dir,
      env: { ...process.env, NODE_ENV: 'development' },
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
    child.on('exit', (code) => {
      if (!started) rej(new Error(`dev server exited with ${code} before ready\n${log}`));
    });
    setTimeout(() => { if (!started) rej(new Error(`dev server start timeout\n${log}`)); }, 20000);
  });
}

describe('E2E: under webjs dev a registered /sw.js switches itself off (#1689)', {
  skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests',
}, () => {
  let browser, child, dir, base;

  before(async () => {
    const puppeteer = (await import('puppeteer-core')).default;
    const chromium = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
    dir = stageApp();
    const port = await freePort();
    child = await startDev(dir, port);
    base = `http://localhost:${port}`;
    browser = await puppeteer.launch({
      executablePath: chromium,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  after(async () => {
    if (browser) await browser.close();
    if (child) { try { child.kill('SIGTERM'); } catch { /* already gone */ } }
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('the registration ends unregistered, and a later component edit reaches the page', async () => {
    const page = await browser.newPage();
    const consoleLines = [];
    page.on('console', (m) => consoleLines.push(m.text()));
    try {
      await page.goto(base + '/', { waitUntil: 'networkidle2' });
      await page.waitForFunction(() => !!customElements.get('morph-counter'), { timeout: 10000 });

      await page.evaluate(() => navigator.serviceWorker.register('/sw.js'));
      await page.waitForFunction(
        async () => (await navigator.serviceWorker.getRegistrations()).length === 0,
        { timeout: 10000, polling: 100 },
      );
      assert.equal(await page.evaluate(async () => (await caches.keys()).length), 0, 'no cache is left behind');

      // A fresh load is not controlled by any worker, and the edit lands.
      await page.goto(base + '/', { waitUntil: 'networkidle2' });
      assert.equal(await page.evaluate(() => !!navigator.serviceWorker.controller), false, 'no worker controls the page');
      writeFileSync(join(dir, 'components/counter.ts'), `
import { WebComponent, html, prop } from '@webjsdev/core';
class MorphCounter extends WebComponent({ count: prop(Number) }) {
  constructor() { super(); this.count = 0; }
  render() {
    return html\`<button id="bump" @click=\${() => { this.count += 2; }}>fresh \${this.count}</button>\`;
  }
}
MorphCounter.register('morph-counter');
`);
      await page.waitForFunction(
        () => document.querySelector('#bump')?.textContent.trim() === 'fresh 0',
        { timeout: 10000 },
      );
      assert.ok(
        consoleLines.some((l) => l.includes('[webjs] hot-swapped <morph-counter>')),
        `the edit arrived as a hot swap in the same document (saw: ${consoleLines.join(' | ')})`,
      );
    } finally {
      await page.close();
    }
  });
});
