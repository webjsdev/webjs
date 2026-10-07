/**
 * End-to-end test for the dev embed bridge (#1498).
 *
 * A host page on one origin frames a real `webjs dev` server on another, with
 * `WEBJS_EMBED_ORIGINS` naming the host. Everything asserted here is only
 * observable that way: the frame loading at all (the default X-Frame-Options
 * would refuse it), messages crossing a real cross-origin `postMessage`, the
 * client router taking a host `navigate` as a soft navigation, and the dev
 * overlay's server-error reaching the parent. Source locations (#1499) are on
 * as well, so inspect mode's `select` carries the clicked element's file:line.
 *
 * Run: WEBJS_E2E=1 node --test test/e2e/dev-embed.test.mjs
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const FIXTURE = resolve(__dirname, 'fixtures', 'embed-app');

function freePort() {
  return new Promise((res, rej) => {
    const srv = createNetServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
    srv.on('error', rej);
  });
}

/** Copy the fixture somewhere writable and link the framework packages in. */
function stageApp() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-embed-e2e-'));
  cpSync(FIXTURE, dir, { recursive: true });
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  for (const pkg of ['core', 'server']) {
    symlinkSync(join(ROOT, 'packages', pkg), join(dir, 'node_modules/@webjsdev', pkg));
  }
  return dir;
}

function startDev(dir, port, embedOrigins) {
  const cli = resolve(ROOT, 'packages', 'cli', 'bin', 'webjs.js');
  return new Promise((res, rej) => {
    const child = spawn(process.execPath, [cli, 'dev', '--port', String(port)], {
      cwd: dir,
      // Source locations on too (#1499), so inspect mode's `select` can carry
      // the file:line of the clicked element, the click-to-edit pairing.
      env: { ...process.env, __WEBJS_DEV_CHILD: '1', NODE_ENV: 'development', WEBJS_EMBED_ORIGINS: embedOrigins, WEBJS_SOURCE_LOCATIONS: '1' },
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

/**
 * The host: one page that frames the app and records every bridge message.
 * `window.send` posts a host command to the frame at the app's exact origin.
 */
function startHost(port, appOrigin) {
  const page = `<!doctype html><html><head><title>host</title></head><body>
<iframe id="preview" src="${appOrigin}/" style="width:800px;height:600px"></iframe>
<script>
window.__msgs = [];
window.addEventListener('message', function (e) {
  if (e.origin === ${JSON.stringify(appOrigin)} && e.data && e.data.source === 'webjs-embed') window.__msgs.push(e.data);
});
window.send = function (msg) {
  msg.source = 'webjs-embed-host';
  document.getElementById('preview').contentWindow.postMessage(msg, ${JSON.stringify(appOrigin)});
};
</script></body></html>`;
  const srv = createHttpServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page);
  });
  return new Promise((res) => srv.listen(port, '127.0.0.1', () => res(srv)));
}

describe('E2E: dev embed bridge (#1498)', {
  skip: !process.env.WEBJS_E2E && 'set WEBJS_E2E=1 to run E2E tests',
}, () => {
  let browser, page, child, dir, host, appOrigin, hostOrigin;

  /** Wait for a message matching `pred` that arrived after index `from`. */
  async function message(pred, from = 0, timeout = 10000) {
    const handle = await page.waitForFunction(
      (src, start) => {
        const fn = new Function('m', 'return (' + src + ')(m)');
        return window.__msgs.slice(start).find((m) => fn(m)) || null;
      },
      { timeout },
      pred.toString(),
      from,
    ).catch(async (err) => {
      const seen = await page.evaluate(() => window.__msgs.map((m) => m.type + ' ' + (m.path || m.message || '')));
      throw new Error(`${err.message}\nmessages since ${from}: ${JSON.stringify(seen.slice(from))}`);
    });
    return handle.jsonValue();
  }
  const count = () => page.evaluate(() => window.__msgs.length);
  const frame = () => page.frames().find((f) => f.url().startsWith(appOrigin));

  before(async () => {
    const puppeteer = (await import('puppeteer-core')).default;
    const chromium = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
    dir = stageApp();
    const appPort = await freePort();
    const hostPort = await freePort();
    // Two different origins: the host is on 127.0.0.1, the app on localhost.
    appOrigin = `http://localhost:${appPort}`;
    hostOrigin = `http://127.0.0.1:${hostPort}`;
    child = await startDev(dir, appPort, hostOrigin);
    host = await startHost(hostPort, appOrigin);
    browser = await puppeteer.launch({
      executablePath: chromium,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
  });

  after(async () => {
    if (browser) await browser.close();
    if (host) host.close();
    if (child) { try { child.kill('SIGTERM'); } catch { /* already gone */ } }
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test('the dev server lets the listed origin frame it', async () => {
    const res = await fetch(`${appOrigin}/`);
    assert.equal(res.headers.get('x-frame-options'), null, 'no X-Frame-Options');
    const body = await res.text();
    assert.match(body, /<script data-webjs-embed>/, 'the bridge is inlined');
  });

  test('ready arrives from the framed app with its path and title', async () => {
    await page.goto(`${hostOrigin}/`, { waitUntil: 'domcontentloaded' });
    const ready = await message((m) => m.type === 'ready');
    assert.equal(ready.path, '/');
    assert.equal(ready.title, 'Embed home');
  });

  test('a host navigate is a client-router soft navigation, reported back as navigate', async () => {
    await frame().waitForFunction(() => !!customElements.get('trouble-el'), { timeout: 10000 });
    await frame().evaluate(() => { window.__wjCtx = 'kept'; });
    const from = await count();
    await page.evaluate(() => window.send({ type: 'navigate', path: '/about' }));
    const nav = await message((m) => m.type === 'navigate', from);
    assert.equal(nav.path, '/about');
    await frame().waitForSelector('#about', { timeout: 5000 });
    assert.equal(await frame().evaluate(() => window.__wjCtx), 'kept', 'no document load happened');
  });

  test('a console error, a failing fetch and an uncaught throw are all reported', async () => {
    const from = await count();
    await frame().evaluate(() => document.querySelector('#trouble').click());
    const c = await message((m) => m.type === 'console', from);
    assert.equal(c.level, 'error');
    assert.equal(c.message, 'trouble: console error');
    const n = await message((m) => m.type === 'network', from);
    assert.deepEqual([n.method, n.url, n.status], ['GET', '/api/fail', 503]);
    const e = await message((m) => m.type === 'error', from);
    assert.match(e.message, /trouble: uncaught/);
    assert.equal(e.file, '/components/trouble.ts', 'the throwing module, as an app path');
  });

  test('inspect mode turns a click into select instead of an app click', async () => {
    const from = await count();
    await page.evaluate(() => window.send({ type: 'inspect', enabled: true }));
    await frame().waitForSelector('[data-webjs-embed-highlight]', { timeout: 5000 });
    await frame().click('#about');
    const sel = await message((m) => m.type === 'select', from);
    assert.equal(sel.tag, 'h1');
    assert.equal(sel.text, 'about');
    assert.equal(sel.src, 'app/about/page.ts:6', 'the clicked element maps back to its template line');
    await page.evaluate(() => window.send({ type: 'inspect', enabled: false }));
    await frame().waitForFunction(() => !document.querySelector('[data-webjs-embed-highlight]'), { timeout: 5000 });
  });

  test('a server render error reaches the host as server-error', async () => {
    const from = await count();
    await page.evaluate(() => window.send({ type: 'navigate', path: '/crash' }));
    const s = await message((m) => m.type === 'server-error', from);
    assert.equal(s.kind, 'render');
    assert.match(s.message, /this page threw during render/);
    assert.equal(s.path, '/crash');
    // A 500 page shares no boundary with the page it replaces, so the router
    // finishes the trip as a full load of /crash. Wait for that document, or
    // the next test's command could land on the one being torn down.
    await message((m) => m.type === 'ready' && m.path === '/crash', from);
  });

  test('a host reload reloads the frame, which reports ready again', async () => {
    // Leave the crash page first. Whether that is a soft or a full navigation
    // depends on what the 500 page loaded, so either report will do.
    const left = await count();
    await page.evaluate(() => window.send({ type: 'navigate', path: '/' }));
    await message((m) => (m.type === 'ready' || m.type === 'navigate') && m.path === '/', left);
    const from = await count();
    await page.evaluate(() => window.send({ type: 'reload' }));
    const ready = await message((m) => m.type === 'ready', from);
    assert.equal(ready.path, '/');
  });
  test('hold keeps edits off the preview until release, then reloads once (#1532)', async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await frame().waitForFunction(() => typeof window.__webjsDevReleaseHold === 'function', { timeout: 10000 });
    // Released with nothing changed: no reload at all.
    await frame().evaluate(() => { window.__mark = 'same-document'; });
    let from = await count();
    await page.evaluate(() => window.send({ type: 'hold', enabled: true }));
    await message((m) => m.type === 'hold' && m.enabled === true, from);
    await page.evaluate(() => window.send({ type: 'hold', enabled: false }));
    await message((m) => m.type === 'hold' && m.enabled === false, from);
    await sleep(1500);
    assert.equal(await frame().evaluate(() => window.__mark), 'same-document', 'an empty hold reloads nothing');

    // Held across two component edits (each a full-reload verdict): nothing.
    from = await count();
    await page.evaluate(() => window.send({ type: 'hold', enabled: true }));
    await message((m) => m.type === 'hold' && m.enabled === true, from);
    appendFileSync(join(dir, 'components/trouble.ts'), '\n// held edit 1\n');
    await sleep(400);
    appendFileSync(join(dir, 'components/trouble.ts'), '\n// held edit 2\n');
    await sleep(2500);
    assert.equal(await frame().evaluate(() => window.__mark), 'same-document', 'no reload while held');
    assert.equal((await page.evaluate(() => window.__msgs)).slice(from).filter((m) => m.type === 'ready').length, 0);

    // Release: exactly one reload.
    const before = await count();
    await page.evaluate(() => window.send({ type: 'hold', enabled: false }));
    await message((m) => m.type === 'ready', before);
    await sleep(1500);
    const readies = (await page.evaluate(() => window.__msgs)).slice(before).filter((m) => m.type === 'ready');
    assert.equal(readies.length, 1, 'one reload for the whole held batch');
    assert.equal(await frame().evaluate(() => window.__mark), undefined, 'a new document');
  });
});
