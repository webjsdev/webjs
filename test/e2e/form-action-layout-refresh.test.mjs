/**
 * End-to-end test: a form action that sets a cookie and redirects must not
 * leave the layout's markup stale (#1557).
 *
 * The defect is only visible end to end. The action's redirect response (the
 * one carrying `Set-Cookie`) is followed by `fetch` transparently, so the
 * client never sees it; the follow-up GET used to carry `X-Webjs-Have`, so the
 * server short-circuited at the root layout and never re-ran the layout's
 * cookie read; and the swap that followed could only reach the page's range,
 * never the layout header outside it. No unit or mocked-fetch layer exercises
 * all three halves at once, so this boots a real app and drives a real browser.
 *
 * The fixture's root layout renders "Signed in" / "Signed out" from a cookie,
 * a sign-out form bound to a server action when signed in, and a stateful
 * counter. The sign-in page binds a server action that answers the way
 * `createAuth().signIn` does: a redirect that also sets the session cookie.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/form-action-layout-refresh.test.mjs
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
const FIXTURE = resolve(__dirname, 'fixtures', 'form-cookie-app');

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
  const dir = mkdtempSync(join(tmpdir(), 'webjs-form-cookie-e2e-'));
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
    child.on('exit', (code) => {
      if (!started) rej(new Error(`dev server exited with ${code} before ready\n${log}`));
    });
    setTimeout(() => { if (!started) rej(new Error(`dev server start timeout\n${log}`)); }, 20000);
  });
}

describe('E2E: a cookie-setting form action refreshes the layout (#1557)', {
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

  /** Read what the assertions compare, in one round trip. */
  const probe = (page) => page.evaluate(() => ({
    token: window.__docToken,
    path: location.pathname,
    page: document.querySelector('#page')?.textContent,
    auth: document.querySelector('#auth-state')?.textContent,
    count: document.querySelector('#bump')?.textContent.trim(),
  }));

  test('sign in and sign out update the layout header with no reload, and layout state survives', async () => {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    /** @type {{ method: string, url: string, have: string | null }[]} */
    const requests = [];
    page.on('request', (r) => {
      if (r.headers()['x-webjs-router'] === '1') {
        requests.push({ method: r.method(), url: r.url(), have: r.headers()['x-webjs-have'] || null });
      }
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    try {
      await page.goto(base + '/signin', { waitUntil: 'networkidle2' });
      await page.waitForFunction(() => !!customElements.get('state-counter'), { timeout: 10000 });
      await page.waitForSelector('#bump');
      await page.click('#bump');
      await page.click('#bump');
      const before = await probe(page);
      assert.equal(before.auth, 'Signed out', 'the layout starts signed out');
      assert.equal(before.count, 'count 2', 'the layout counter hydrated and counted');
      assert.ok(before.token, 'the document stamped a load token');

      // Sign in: the action sets the cookie and redirects to /recipes.
      await page.click('#signin-btn');
      await page.waitForFunction(
        () => location.pathname === '/recipes' && document.querySelector('#page')?.textContent === 'Recipes',
        { timeout: 10000 },
      );
      // Give a (wrong) stale header every chance to show: the swap is done.
      await new Promise((r) => setTimeout(r, 200));
      const signedIn = await probe(page);
      assert.equal(signedIn.auth, 'Signed in', 'the layout header reflects the cookie the action just set');
      assert.equal(signedIn.token, before.token, 'with no reload: this was a soft navigation');
      assert.equal(signedIn.count, 'count 2', 'and the layout counter kept its state');

      const post = requests.find((r) => r.method === 'POST');
      assert.ok(post, 'the sign-in went through the client router');
      assert.equal(post.have, null, 'a mutating submission sends no X-Webjs-Have, so the server renders the layouts');

      // A plain link click is untouched: it still sends the have-header.
      requests.length = 0;
      await page.click('#home-link');
      await page.waitForFunction(() => location.pathname === '/', { timeout: 10000 });
      const linkNav = requests.find((r) => r.method === 'GET');
      assert.ok(linkNav && linkNav.have, 'a GET link navigation still sends X-Webjs-Have');

      // Sign out: the action clears the cookie and redirects home. Home is
      // ALSO where the reader already is, so this is the PRG-to-self shape.
      await page.waitForSelector('#signout-btn');
      await page.click('#signout-btn');
      await page.waitForFunction(
        () => document.querySelector('#auth-state')?.textContent === 'Signed out',
        { timeout: 10000 },
      );
      const signedOut = await probe(page);
      assert.equal(signedOut.path, '/', 'the sign-out landed home');
      assert.equal(signedOut.token, before.token, 'still no reload');
      assert.equal(signedOut.count, 'count 2', 'and the layout counter still kept its state');
      assert.ok(await page.$('#signin-link'), 'the header swapped the sign-out form for the sign-in link');
      assert.deepEqual(errors, [], 'no page errors');
    } finally {
      await context.close();
    }
  });
});
