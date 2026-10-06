/**
 * End-to-end test for the quiet dev live-reload stream (#1507).
 *
 * A host that sleeps on network quiet (a pilots sandbox, a laptop) could never
 * sleep while a dev tab showed the app: the stream wrote a keepalive every 25
 * seconds and stayed open for a tab nobody was looking at. Now the stream is
 * silent between events and is held open only while some tab is visible. This
 * proves the user-facing half in a real browser against a real `webjs dev`:
 *
 *   1. live reload still works while the tab is visible;
 *   2. while the tab is hidden the stream is closed, so an edit does NOT reach
 *      the page (if the stream were still open, the in-place refresh would run
 *      in a hidden tab just the same);
 *   3. showing the tab again reconnects, and the hello's reload `seq` tells the
 *      relay an edit was missed, so the page catches up with a reload;
 *   4. a fresh relay whose stream missed an edit compares the hello with the
 *      state the page was rendered at (#1516) and reloads.
 *
 * Visibility is driven by overriding `document.visibilityState` and firing
 * `visibilitychange`, the exact signal the served client listens to.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/dev-idle-stream.test.mjs
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
const FIXTURE = resolve(__dirname, 'fixtures', 'embed-app');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The relay's 2000ms quiet window plus the swap, with room for a slow box. */
const RELOAD_SETTLE_MS = 4500;

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, () => { const { port } = srv.address(); srv.close(() => res(port)); });
    srv.on('error', rej);
  });
}

function stageApp() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-idle-e2e-'));
  cpSync(FIXTURE, dir, { recursive: true });
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

const aboutPage = (text) => `import { html } from '@webjsdev/core';

export const metadata = { title: 'Embed about' };

export default function About() {
  return html\`<h1 id="about">${text}</h1>\`;
}
`;

describe('E2E: the dev live-reload stream is quiet and pauses while hidden (#1507)', {
  skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests',
}, () => {
  let browser, page, child, dir, base;

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
    await page.goto(base + '/about', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => !!customElements.get('trouble-el'), { timeout: 10000 });
  });

  after(async () => {
    if (browser) await browser.close();
    if (child) { try { child.kill('SIGTERM'); } catch { /* already gone */ } }
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  const heading = () => page.evaluate(() => document.querySelector('#about')?.textContent);
  const setVisible = (visible) => page.evaluate((v) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'visible' : 'hidden') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);

  test('a visible tab live-reloads an edit', async () => {
    writeFileSync(join(dir, 'app/about/page.ts'), aboutPage('edited while visible'));
    await page.waitForFunction(() => document.querySelector('#about')?.textContent === 'edited while visible', { timeout: RELOAD_SETTLE_MS + 3000 });
  });

  test('a hidden tab holds no stream, so an edit does not reach it', async () => {
    await setVisible(false);
    await sleep(300);
    writeFileSync(join(dir, 'app/about/page.ts'), aboutPage('edited while hidden'));
    await sleep(RELOAD_SETTLE_MS);
    assert.equal(await heading(), 'edited while visible', 'nothing arrived while hidden');
  });

  test('showing the tab reconnects and catches up on the missed edit', async () => {
    await page.evaluate(() => { window.__beforeShow = 1; });
    await setVisible(true);
    await page.waitForFunction(() => document.querySelector('#about')?.textContent === 'edited while hidden', { timeout: RELOAD_SETTLE_MS + 3000 });
    assert.equal(await page.evaluate(() => window.__beforeShow), undefined, 'a missed edit is a full reload, the safe response');
  });

  // #1516: a host that holds the quiet stream across a suspend closes it at the
  // next wake, and the reload frame the wake itself caused goes to the dead
  // stream. Here the tab's stream is cut from the start (a fresh relay that has
  // never seen a hello), an edit lands, and the stream comes back: the page's
  // own render-time state says it is behind, so it reloads.
  test('a fresh relay whose stream missed an edit reloads once the stream returns', async () => {
    const p2 = await browser.newPage();
    try {
      // The per-tab relay, so its EventSource is a page request the test can cut.
      await p2.evaluateOnNewDocument(() => { delete window.SharedWorker; });
      await p2.setRequestInterception(true);
      let cut = true;
      p2.on('request', (r) => {
        if (cut && r.url().includes('/__webjs/events')) r.abort();
        else r.continue();
      });
      await p2.goto(base + '/about', { waitUntil: 'domcontentloaded' });
      await p2.waitForFunction(() => !!document.querySelector('#about'), { timeout: 10000 });
      const meta = await p2.evaluate(() => document.querySelector('meta[name="webjs-dev-reload"]')?.getAttribute('content'));
      assert.ok(meta && JSON.parse(meta).boot, 'the page carries the state it was rendered at');
      await p2.evaluate(() => { window.__beforeEdit = 1; });
      writeFileSync(join(dir, 'app/about/page.ts'), aboutPage('edited while the stream was gone'));
      await sleep(1000);
      cut = false;
      await p2.waitForFunction(() => document.querySelector('#about')?.textContent === 'edited while the stream was gone', { timeout: RELOAD_SETTLE_MS + 8000 });
      assert.equal(await p2.evaluate(() => window.__beforeEdit), undefined, 'a full reload');
    } finally {
      await p2.close();
    }
  });
});
