/**
 * E2E (#1689): a dev render error recovers in place.
 *
 * Breaking a page used to reload into the dev 500 page, and fixing it
 * reloaded again, because the 500 page carries no children boundaries, so a
 * refresh against it could only hard-navigate. The dev server now marks a
 * render that reported an error `x-webjs-dev-error: 1`, and the client
 * router's refresh leaves the last good page on screen under the overlay
 * (Next's posture). The fixing edit's refresh then applies in place and takes
 * the overlay down, with no navigation at either step.
 *
 * Runs against the dev-morph fixture under the supervised Node `webjs dev`,
 * in real Chromium.
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
  const dir = mkdtempSync(join(tmpdir(), 'webjs-dev-error-e2e-'));
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SETTLE_MS = 8000;

const pageSource = (body) => `
import { html } from '@webjsdev/core';
export default function Home() {
  ${body}
  return html\`
    <h1 id="page-marker">PAGE_FIXED</h1>
    <div style="height:3000px"></div>
  \`;
}
`;

describe('E2E: a dev render error keeps the page under the overlay and recovers in place (#1689)', {
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

  test('breaking the page shows the overlay over the old content; fixing it applies in place', async () => {
    const page = await browser.newPage();
    const consoleLines = [];
    page.on('console', (m) => consoleLines.push(m.text()));
    try {
      await page.goto(base + '/', { waitUntil: 'networkidle2' });
      await page.waitForFunction(() => !!customElements.get('morph-counter'), { timeout: 10000 });
      await page.click('#bump');
      const before = await page.evaluate(() => ({
        token: window.__docToken,
        href: location.href,
        count: document.querySelector('#bump').textContent.trim(),
      }));
      assert.equal(before.count, 'count 1');

      // Break the page render.
      writeFileSync(join(dir, 'app/page.ts'), pageSource("throw new Error('PAGE_BROKEN');"));
      await page.waitForSelector('[data-webjs-error-overlay]', { timeout: SETTLE_MS });
      await sleep(800); // past the refresh the reload frame triggers
      const broken = await page.evaluate(() => ({
        token: window.__docToken,
        href: location.href,
        marker: document.querySelector('#page-marker')?.textContent,
        count: document.querySelector('#bump')?.textContent.trim(),
        overlay: document.querySelector('[data-webjs-error-overlay]')?.textContent || '',
      }));
      assert.equal(broken.token, before.token, 'the document never loaded again');
      assert.equal(broken.href, before.href, 'the url did not change');
      assert.equal(broken.marker, 'PAGE_A', 'the last good page stays under the overlay');
      assert.equal(broken.count, 'count 1', 'and its components keep their state');
      assert.match(broken.overlay, /PAGE_BROKEN/, 'the overlay describes the error');

      // Fix it: the refresh applies in place and the overlay goes.
      writeFileSync(join(dir, 'app/page.ts'), pageSource(''));
      await page.waitForFunction(
        () => document.querySelector('#page-marker')?.textContent === 'PAGE_FIXED',
        { timeout: SETTLE_MS },
      );
      await page.waitForFunction(() => !document.querySelector('[data-webjs-error-overlay]'), { timeout: SETTLE_MS });
      const fixed = await page.evaluate(() => ({
        token: window.__docToken,
        count: document.querySelector('#bump')?.textContent.trim(),
      }));
      assert.equal(fixed.token, before.token, 'the fix applied in place, with no navigation');
      assert.equal(fixed.count, 'count 1', 'the layout component outside the page kept its state');
      assert.ok(!consoleLines.some((l) => l.includes('[webjs] full reload')),
        `nothing reloaded (saw: ${consoleLines.join(' | ')})`);
    } finally {
      await page.close();
    }
  });
});
