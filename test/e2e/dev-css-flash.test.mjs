/**
 * End-to-end test for the unstyled flash after a dev edit (#1535).
 *
 * An edit that adds a utility class needs TWO things to reach the screen: the
 * new markup and the stylesheet rebuilt to carry the new class's rule
 * (`webjs.dev.regenerate`, #967, rebuilds it on request). If the markup is
 * painted before the rebuilt stylesheet has loaded, the element shows with no
 * rule for its new class, which is the unstyled flash an AI builder's preview
 * showed after every edit.
 *
 * The fixture's regenerate command is a stand-in for Tailwind: it writes a
 * rule only for the `c-<color>` classes the source uses, after a deliberate
 * delay (a real compile is never instant). A sampler records the target's
 * computed colour on every animation frame, which is what the browser paints,
 * so a single frame showing the new class without its rule fails the test.
 *
 * Two paths, both measured:
 *   1. In-place refresh (a page edit with the server in-process, which is what
 *      `bun --hot` gives every Bun user): the DOM swap must wait for the
 *      rebuilt stylesheet.
 *   2. Full reload (a restart under the Node supervisor): the stylesheet is
 *      render-blocking, so the browser holds the old page until it loads.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/dev-css-flash.test.mjs
 * The dev server runs on Node; `WEBJS_E2E_RUNTIME=bun` runs it on Bun instead.
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
const FIXTURE = resolve(__dirname, 'fixtures', 'dev-css-flash-app');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The relay's 2000ms quiet window, the 800ms compile, and the swap. */
const SETTLE_MS = 9000;

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, () => { const { port } = srv.address(); srv.close(() => res(port)); });
    srv.on('error', rej);
  });
}

function stageApp() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-css-flash-e2e-'));
  cpSync(FIXTURE, dir, { recursive: true });
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  for (const pkg of ['core', 'server']) symlinkSync(join(ROOT, 'packages', pkg), join(dir, 'node_modules/@webjsdev', pkg));
  return dir;
}

/** `inProcess` keeps the server in the spawned process (the refresh path). */
function startDev(dir, port, { inProcess }) {
  const cli = resolve(ROOT, 'packages', 'cli', 'bin', 'webjs.js');
  return new Promise((res, rej) => {
    const env = { ...process.env, NODE_ENV: 'development' };
    if (inProcess) env.__WEBJS_DEV_CHILD = '1';
    const runtime = process.env.WEBJS_E2E_RUNTIME === 'bun' ? 'bun' : process.execPath;
    const child = spawn(runtime, [cli, 'dev', '--port', String(port)], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let started = false;
    let log = '';
    const onData = (c) => { log += c; if (!started && log.includes('ready on')) { started = true; res(child); } };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => { if (!started) rej(new Error(`dev exited ${code}\n${log}`)); });
    setTimeout(() => { if (!started) rej(new Error(`dev start timeout\n${log}`)); }, 20000);
  });
}

/**
 * Installed on every document: on each animation frame, record whether the
 * target carries `c-red` and what colour it is painted. Kept on `window.name`
 * so it survives a full reload of the same tab.
 */
function sampler() {
  const log = () => { try { return JSON.parse(window.name || '[]'); } catch { return []; } };
  const tick = () => {
    const el = document.getElementById('target');
    if (el) {
      const frames = log();
      frames.push({ red: el.classList.contains('c-red'), color: getComputedStyle(el).color, text: el.textContent });
      window.name = JSON.stringify(frames.slice(-2000));
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const edit = (dir, cls, text) => writeFileSync(join(dir, 'app/page.ts'),
  `import { html } from '@webjsdev/core';\nexport default function Home() {\n  return html\`<h1 id="target" class="${cls}">${text}</h1>\`;\n}\n`);

describe('E2E: a dev edit never paints a new class without its rule (#1535)', {
  skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests',
}, () => {
  let browser;
  before(async () => {
    const puppeteer = (await import('puppeteer-core')).default;
    browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  });
  after(async () => { if (browser) await browser.close(); });

  // Node: in-process is the refresh path, the supervisor restarts (a reload).
  // Bun: `bun --hot` under the supervisor IS the refresh path, and an
  // in-process Bun server cannot pick up an edit at all (its module cache
  // ignores the cache-bust), so it is not a mode there.
  const MODES = process.env.WEBJS_E2E_RUNTIME === 'bun'
    ? [{ name: 'bun --hot in-place refresh', inProcess: false, reloads: false }]
    : [{ name: 'in-place refresh', inProcess: true, reloads: false }, { name: 'full reload after a restart', inProcess: false, reloads: true }];
  for (const mode of MODES) {
    test(`${mode.name}: the new markup waits for the rebuilt stylesheet`, async () => {
      const dir = stageApp();
      const port = await freePort();
      const child = await startDev(dir, port, mode);
      const page = await browser.newPage();
      try {
        await page.evaluateOnNewDocument(sampler);
        await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle2' });
        await page.waitForFunction(() => getComputedStyle(document.getElementById('target')).color === 'rgb(0, 0, 255)', { timeout: 10000 });
        await page.evaluate(() => { window.__startToken = window.__docToken; window.name = '[]'; });
        await sleep(300);

        edit(dir, 'c-red', 'RED');
        await page.waitForFunction(() => {
          const el = document.getElementById('target');
          return el && el.classList.contains('c-red') && getComputedStyle(el).color === 'rgb(255, 0, 0)';
        }, { timeout: SETTLE_MS });
        await sleep(200);

        const frames = await page.evaluate(() => JSON.parse(window.name || '[]'));
        const reloaded = await page.evaluate(() => window.__startToken !== window.__docToken);
        const unstyled = frames.filter((f) => f.red && f.color !== 'rgb(255, 0, 0)');
        assert.ok(frames.some((f) => f.red), 'the sampler saw the edited markup');
        assert.equal(reloaded, mode.reloads, mode.reloads ? 'a full reload' : 'an in-place refresh, no reload');
        assert.equal(unstyled.length, 0,
          `${unstyled.length} frame(s) painted the new class with no rule (first: ${JSON.stringify(unstyled[0])})`);

        // A second edit to the same element: still no flash, and the head
        // still holds exactly ONE link to the sheet (no growth per refresh).
        await page.evaluate(() => { window.name = '[]'; });
        edit(dir, 'c-green', 'GREEN');
        await page.waitForFunction(() => {
          const el = document.getElementById('target');
          return el && el.classList.contains('c-green') && getComputedStyle(el).color === 'rgb(0, 128, 0)';
        }, { timeout: SETTLE_MS });
        await sleep(300);
        const frames2 = await page.evaluate(() => JSON.parse(window.name || '[]'));
        const unstyled2 = frames2.filter((f) => f.text === 'GREEN' && f.color !== 'rgb(0, 128, 0)');
        assert.equal(unstyled2.length, 0, `second edit: ${unstyled2.length} unstyled frame(s)`);
        const sheets = await page.evaluate(() => document.querySelectorAll('link[rel~="stylesheet"][href*="/public/app.css"]').length);
        assert.equal(sheets, 1, 'exactly one link to the stylesheet is left');
      } finally {
        await page.close();
        try { process.kill(-child.pid, 'SIGTERM'); } catch {}
        await sleep(300);
        try { process.kill(-child.pid, 'SIGKILL'); } catch {}
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
});
