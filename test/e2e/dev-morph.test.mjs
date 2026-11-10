/**
 * End-to-end test for the in-place dev refresh (#1398) and the component hot
 * swap (#1689).
 *
 * The acceptance criteria are browser facts and nothing below the browser can
 * stand in for them. Whether a page RELOADED is not observable from the DOM, so
 * the fixture's root layout stamps a `window.__docToken` that only ever assigns
 * when absent: a `shell` swap re-runs the script and leaves it alone, while a
 * real reload replaces the whole global scope and therefore mints a new one.
 * Whether a hydrated component's state SURVIVED needs a real custom-element
 * upgrade and a real instance; and whether the reader kept their place needs
 * real scroll on a real tall document. The
 * unit and browser layers prove the verdict and the swap separately, and this
 * is the only layer that proves the whole loop: edit a file, the watcher
 * classifies it, the frame carries the verdict, the relay coalesces it, and the
 * tab applies it.
 *
 * The server runs under the real `webjs dev` supervisor, as users run it. On
 * Node the supervised child re-evaluates an edited server module in place
 * through its module resolve hook (#1689), so the supervisor restarts it only
 * for a restart file and every edit below reaches the tab as a classified
 * verdict from the same process. On Bun the same in-process shape is what
 * `bun --hot` gives users by default, and the dev source plugins version the
 * edited module and its importers the same way, so an untouched module keeps
 * its state there too.
 *
 * This is the first e2e that WRITES to a staged app file. It writes into the
 * temp copy `stageApp()` made, never into the repo.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/dev-morph.test.mjs
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

/** Find a free port by binding to 0 and releasing. */
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

/** Copy the fixture somewhere writable and link the framework packages in. */
function stageApp() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-morph-e2e-'));
  cpSync(FIXTURE, dir, { recursive: true });
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  for (const pkg of ['core', 'server']) {
    symlinkSync(join(ROOT, 'packages', pkg), join(dir, 'node_modules/@webjsdev', pkg));
  }
  return dir;
}

/** Spawn `webjs dev` against the staged app and resolve once it is listening. */
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

/**
 * The relay coalesces a burst and emits after a 2000ms quiet window (#1397), so
 * every wait below has to clear that plus the swap. Generous rather than tight:
 * a slow CI box that misses the window fails the assertion for the wrong
 * reason, and the cost of waiting is only wall clock.
 */
const RELOAD_SETTLE_MS = 4500;

describe('E2E: a dev page, layout, server module or component edit applies in place (#1398, #1689)', {
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

  /**
   * Open the app, wait for the counter to upgrade, and hand back the page along
   * with a live log of stylesheet requests (see the CSS assertion below).
   */
  async function open() {
    const page = await browser.newPage();
    const cssRequests = [];
    const consoleLines = [];
    page.on('request', (r) => { if (r.url().includes('/app.css')) cssRequests.push(r.url()); });
    // Kept across a reload, so a line the outgoing document logged is seen.
    page.on('console', (m) => consoleLines.push(m.text()));
    await page.goto(base + '/', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => !!customElements.get('morph-counter'), { timeout: 10000 });
    await page.waitForSelector('#bump');
    page.cssRequests = cssRequests;
    page.consoleLines = consoleLines;
    return page;
  }

  /** The dev process boot id the page was rendered by. */
  async function bootId() {
    const body = await (await fetch(base + '/')).text();
    const meta = /<meta name="webjs-dev-reload" content="([^"]*)"/.exec(body);
    return meta ? JSON.parse(meta[1].replace(/&quot;|&#34;/g, '"')).boot : null;
  }

  // Runs first, while the page still renders `msg` and `hits` (#1689).
  test('a SERVER module edit refreshes in place from the same process, untouched module state kept', async () => {
    const page = await open();
    try {
      await page.click('#bump');
      const before = await page.evaluate(() => ({
        token: window.__docToken,
        hits: Number(document.querySelector('#hits').textContent),
      }));
      const bootBefore = await bootId();
      assert.ok(bootBefore, 'the page carries the dev boot id');

      writeFileSync(join(dir, 'lib/msg.server.ts'), "export const msg: string = 'MSG_B';\n");
      await page.waitForFunction(
        () => document.querySelector('#msg')?.textContent === 'MSG_B',
        { timeout: RELOAD_SETTLE_MS + 3000 },
      );
      const after = await page.evaluate(() => ({
        token: window.__docToken,
        hits: Number(document.querySelector('#hits').textContent),
      }));
      assert.equal(after.token, before.token, 'the document never loaded again');
      assert.equal(await bootId(), bootBefore, 'the SAME dev process rendered the edit (a new boot id is a restart)');
      assert.ok(after.hits > before.hits,
        `an untouched module kept its instance: hits went ${before.hits} -> ${after.hits}, a restart starts over at 1`);
    } finally {
      await page.close();
    }
  });

  // A stylesheet the browser does not hold as a module swaps in place (#1689):
  // the tab re-requests its sheets and drops the old link once the new one has
  // loaded, so nothing re-renders, nothing reloads, and the new rule applies.
  // Runs before the layout edit below, which drops the stylesheet link.
  test('a public/ stylesheet edit restyles in place, with no navigation', async () => {
    const page = await open();
    try {
      await page.click('#bump');
      const before = await page.evaluate(() => ({
        token: window.__docToken,
        count: document.querySelector('#bump').textContent.trim(),
      }));
      const requestsBefore = page.cssRequests.length;
      writeFileSync(join(dir, 'public/app.css'), '#page-marker { color: rgb(255, 0, 0); }\n');
      await page.waitForFunction(
        () => getComputedStyle(document.querySelector('#page-marker')).color === 'rgb(255, 0, 0)',
        { timeout: RELOAD_SETTLE_MS + 3000 },
      );
      const after = await page.evaluate(() => ({
        token: window.__docToken,
        count: document.querySelector('#bump').textContent.trim(),
        sheets: document.querySelectorAll('link[rel="stylesheet"][href*="/app.css"]').length,
      }));
      assert.equal(after.token, before.token, 'the document never loaded again');
      assert.equal(after.count, before.count, 'the counter kept its state, nothing re-rendered it');
      assert.equal(after.sheets, 1, 'the old link was dropped once the replacement loaded');
      assert.ok(page.cssRequests.length > requestsBefore, 'the stylesheet was re-requested');
      assert.ok(page.consoleLines.some((l) => l.includes('[webjs] stylesheets refreshed (public/app.css)')),
        `the tab says what it refreshed (saw: ${page.consoleLines.join(' | ')})`);
    } finally {
      await page.close();
    }
  });

  test('a PAGE edit updates in place: no reload, scroll kept, component state kept', async () => {
    const page = await open();
    try {
      await page.click('#bump');
      await page.click('#bump');
      await page.evaluate(() => window.scrollTo(0, 400));
      await sleep(100);

      const before = await page.evaluate(() => ({
        token: window.__docToken,
        scrollY: window.scrollY,
        count: document.querySelector('#bump').textContent.trim(),
      }));
      assert.ok(before.token, 'the document stamped a load token');
      assert.equal(before.count, 'count 2', 'the counter hydrated and counted');
      assert.ok(before.scrollY > 0, 'the fixture is tall enough to scroll');

      writeFileSync(join(dir, 'app/page.ts'), `
import { html } from '@webjsdev/core';
export default function Home() {
  return html\`
    <h1 id="page-marker">PAGE_B</h1>
    <div style="height:3000px"></div>
  \`;
}
`);
      await page.waitForFunction(
        () => document.querySelector('#page-marker')?.textContent === 'PAGE_B',
        { timeout: RELOAD_SETTLE_MS + 3000 },
      );

      const after = await page.evaluate(() => ({
        token: window.__docToken,
        scrollY: window.scrollY,
        count: document.querySelector('#bump').textContent.trim(),
      }));
      assert.equal(after.token, before.token, 'the document never loaded again, so this was a real in-place refresh');
      assert.equal(after.scrollY, before.scrollY, 'the reader kept their place');
      assert.equal(after.count, 'count 2', 'and the hydrated counter outside the changed region kept its state');
      // The tab says what it did (#1689); logged once the stylesheet swap commits.
      const said = '[webjs] page updated in place (app/page.ts)';
      for (let i = 0; i < 60 && !page.consoleLines.some((l) => l.includes(said)); i++) await sleep(50);
      assert.ok(page.consoleLines.some((l) => l.includes(said)), `the tab logged the in-place update (saw: ${page.consoleLines.join(' | ')})`);

      // The stylesheet has to be RE-REQUESTED, and the dev client's explicit
      // refresh is the only thing that can cause it. The link is hoisted into
      // `<head>` by the SSR, and this tier (`page`) merges the incoming head
      // through `addNewHeadElements`, which is ADD-ONLY and so never touches
      // the live link; the `shell` tier's `mergeHead` would not either, since
      // it preserves stylesheets unconditionally (#936). A reload used to do
      // the asking, which is how `webjs.dev.regenerate` (#967) ever ran, since
      // it rebuilds a stale output ON REQUEST. Without the refresh, an edit
      // adding a utility class would render with no backing rule until a
      // manual reload.
      assert.ok(page.cssRequests.length >= 2,
        `the refresh re-requested the stylesheet (saw ${page.cssRequests.length} request(s))`);
      assert.match(page.cssRequests[page.cssRequests.length - 1], /__webjs_dev=/,
        'and it went out cache-busted, so the server actually re-ran its regenerate step');
    } finally {
      await page.close();
    }
  });

  test('a LAYOUT edit updates the layout own markup in place, with no reload', async () => {
    const page = await open();
    try {
      await page.click('#bump');
      await page.evaluate(() => window.scrollTo(0, 400));
      await sleep(100);
      const before = await page.evaluate(() => ({
        token: window.__docToken,
        scrollY: window.scrollY,
        count: document.querySelector('#bump').textContent.trim(),
      }));
      assert.equal(before.count, 'count 1');

      writeFileSync(join(dir, 'app/layout.ts'), `
import { html, type LayoutProps } from '@webjsdev/core';
import '#components/counter.ts';
export default function RootLayout({ children }: LayoutProps) {
  return html\`
    <script>window.__docToken = window.__docToken || String(Math.random());</script>
    <header id="layout-marker">LAYOUT_B</header>
    <morph-counter></morph-counter>
    <main>\${children}</main>
  \`;
}
`);
      await page.waitForFunction(
        () => document.querySelector('#layout-marker')?.textContent === 'LAYOUT_B',
        { timeout: RELOAD_SETTLE_MS + 3000 },
      );

      const after = await page.evaluate(() => ({
        token: window.__docToken,
        scrollY: window.scrollY,
        count: document.querySelector('#bump').textContent.trim(),
      }));
      assert.equal(after.token, before.token, 'the layout markup changed WITHOUT a document load');
      assert.equal(after.scrollY, before.scrollY, 'the reader kept their place');
      // The honest cost of the shell tier, asserted rather than glossed: it
      // replaces the whole body, so every component is re-created. That is what
      // makes it a different verdict from `page` rather than a slower spelling
      // of the same one.
      assert.equal(after.count, 'count 0', 'component instances do not survive a shell swap');
    } finally {
      await page.close();
    }
  });

  // A component edit is never a morph: the page would keep the OLD class wired to
  // fresh markup. Since #1689 it hot-swaps instead, re-importing the versioned
  // module, which patches the registered class in place. So the instance, its
  // count and the document all survive, and the NEW behaviour is live.
  test('a COMPONENT edit hot-swaps: no reload, state kept, new behaviour active', async () => {
    const page = await open();
    try {
      await page.click('#bump');
      const before = await page.evaluate(() => ({
        token: window.__docToken,
        count: document.querySelector('#bump').textContent.trim(),
      }));
      assert.ok(before.token, 'the document stamped a load token');
      assert.equal(before.count, 'count 1');
      const bootBefore = await bootId();

      writeFileSync(join(dir, 'components/counter.ts'), `
import { WebComponent, html, prop } from '@webjsdev/core';
class MorphCounter extends WebComponent({ count: prop(Number) }) {
  constructor() { super(); this.count = 0; }
  render() {
    return html\`<button id="bump" @click=\${() => { this.count += 2; }}>clicks \${this.count}</button>\`;
  }
}
MorphCounter.register('morph-counter');
`);
      await page.waitForFunction(
        () => document.querySelector('#bump')?.textContent.trim() === 'clicks 1',
        { timeout: RELOAD_SETTLE_MS + 3000 },
      );
      assert.equal(await page.evaluate(() => window.__docToken), before.token, 'the document never loaded again');
      assert.equal(await bootId(), bootBefore, 'and the dev process was not restarted');
      await page.click('#bump');
      assert.equal(
        await page.evaluate(() => document.querySelector('#bump').textContent.trim()),
        'clicks 3',
        'the kept instance runs the NEW handler, which counts by two',
      );
      assert.ok(page.consoleLines.some((l) => l.includes('[webjs] hot-swapped <morph-counter>')),
        `the tab says what it swapped (saw: ${page.consoleLines.join(' | ')})`);
    } finally {
      await page.close();
    }
  });

  // The counterfactual: an edit the registered class cannot take (the native
  // registry keeps constructing with the old constructor) is a real reload,
  // and the tab says why.
  test('a component CONSTRUCTOR edit reloads and names the reason', async () => {
    const page = await open();
    try {
      const before = await page.evaluate(() => window.__docToken);
      writeFileSync(join(dir, 'components/counter.ts'), `
import { WebComponent, html, prop } from '@webjsdev/core';
class MorphCounter extends WebComponent({ count: prop(Number) }) {
  constructor() { super(); this.count = 10; }
  render() {
    return html\`<button id="bump" @click=\${() => { this.count += 2; }}>clicks \${this.count}</button>\`;
  }
}
MorphCounter.register('morph-counter');
`);
      // A real reload replaces the global scope, so the token is re-minted.
      await page.waitForFunction(
        (t) => window.__docToken && window.__docToken !== t,
        { timeout: RELOAD_SETTLE_MS + 3000 },
        before,
      );
      await page.waitForSelector('#bump');
      assert.equal(
        await page.evaluate(() => document.querySelector('#bump').textContent.trim()),
        'clicks 10',
        'the reloaded page constructs with the NEW constructor',
      );
      assert.ok(page.consoleLines.some((l) => l.includes('[webjs] full reload: constructor-changed (components/counter.ts)')),
        `the tab named the reason (saw: ${page.consoleLines.join(' | ')})`);
    } finally {
      await page.close();
    }
  });
});
