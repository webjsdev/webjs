/**
 * End-to-end test for dev source locations (#1499).
 *
 * With `WEBJS_SOURCE_LOCATIONS=1` under `webjs dev`, elements from the app's
 * `html` templates carry `data-webjs-src="<file>:<line>"`. The headline claims
 * are browser-observable, so they are asserted in a real browser against a real
 * `webjs dev`:
 *
 *   - the SSR'd layout and page elements carry their file and line;
 *   - a component's elements still carry it AFTER hydration re-renders them;
 *   - rows that only ever render in the browser (after a click) carry it, which
 *     proves the served module was annotated, not just the SSR markup;
 *   - hydration logs no error or warning.
 *
 * The fixture (`fixtures/dev-source-locations-app`) is copied to a temp dir and
 * given symlinked `@webjsdev/*`, like `dev-overlay-nav.test.mjs`.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/dev-source-locations.test.mjs
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const FIXTURE = resolve(__dirname, 'fixtures', 'dev-source-locations-app');

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
  const dir = mkdtempSync(join(tmpdir(), 'webjs-srcloc-e2e-'));
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
      env: {
        ...process.env,
        __WEBJS_DEV_CHILD: '1',
        NODE_ENV: 'development',
        WEBJS_SOURCE_LOCATIONS: '1',
      },
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

const src = (page, sel) => page.$eval(sel, (el) => el.getAttribute('data-webjs-src'));

describe('E2E: dev source locations (#1499)', {
  skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests',
}, () => {
  let browser, page, child, dir, base;
  /** @type {string[]} */
  const consoleProblems = [];

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
    page = await browser.newPage();
    // A missing /favicon.ico is the browser's own probe, not the app's, so
    // failed loads are judged by URL below rather than by console text.
    page.on('response', (r) => {
      if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) consoleProblems.push(`${r.status()}: ${r.url()}`);
    });
    page.on('console', (m) => {
      if (m.text().startsWith('Failed to load resource')) return;
      if (m.type() === 'error' || m.type() === 'warn' || m.type() === 'warning') consoleProblems.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => consoleProblems.push(`pageerror: ${e.message}`));
  });

  after(async () => {
    if (browser) await browser.close();
    if (child) { try { child.kill('SIGTERM'); } catch { /* already gone */ } }
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('SSR layout and page elements carry their file and line', async () => {
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    assert.equal(await src(page, '#shell'), 'app/layout.ts:6');
    assert.equal(await src(page, '#intro'), 'app/page.ts:7');
    assert.equal(await src(page, 'todo-list'), 'app/page.ts:8');
  });

  test('a hydrated component keeps the annotation after its client render', async () => {
    await page.waitForFunction(() => !!customElements.get('todo-list'), { timeout: 10000 });
    // The client render replaces the SSR'd children with fresh nodes built from
    // the SERVED module, so these attributes come from its annotation.
    await page.waitForFunction(() => document.querySelector('todo-list .todo'), { timeout: 5000 });
    assert.equal(await src(page, 'todo-list .todo'), 'components/todo-list.ts:10');
    assert.equal(await src(page, '#add'), 'components/todo-list.ts:11');
    assert.equal(await src(page, '#rows'), 'components/todo-list.ts:12');
  });

  test('rows rendered only in the browser carry the annotation', async () => {
    await page.click('#add');
    await page.click('#add');
    await page.waitForFunction(() => document.querySelectorAll('#rows li').length === 2, { timeout: 5000 });
    const rows = await page.$$eval('#rows li', (els) => els.map((el) => el.getAttribute('data-webjs-src')));
    assert.deepEqual(rows, ['components/todo-list.ts:13', 'components/todo-list.ts:13']);
  });

  test('hydration logged no error or warning', () => {
    assert.deepEqual(consoleProblems, []);
  });
});
