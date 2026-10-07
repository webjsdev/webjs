/**
 * Real-browser tests for the dev embed bridge, browser half (#1498).
 *
 * `dev-embed-client.js` is the exact source the dev server inlines into every
 * document when `WEBJS_EMBED_ORIGINS` is set, so driving it here tests the
 * code that ships. Each test frames a same-origin fixture page, installs the
 * bridge into the FRAME's window, and listens on this (the parent) window, so
 * every message crosses a real `postMessage` boundary and every host command
 * arrives with a real `event.source` / `event.origin`.
 */
import { installEmbedBridge } from '../../../src/dev-embed-client.js';
import { renderDevOverlay, dismissDevOverlay } from '../../../src/dev-overlay.js';
import { assert } from '../../../../../test/browser-assert.js';

const FRAME_URL = new URL('./embed-frame.html', import.meta.url).href;
const FRAME_PATH = new URL(FRAME_URL).pathname;

/** Every bridge message the parent received, in order. */
let received = [];
window.addEventListener('message', (e) => {
  if (e.data && e.data.source === 'webjs-embed') received.push(e.data);
});

function frameLoad(iframe) {
  return new Promise((res) => iframe.addEventListener('load', () => res(), { once: true }));
}

async function mount() {
  received = [];
  const iframe = document.createElement('iframe');
  iframe.src = FRAME_URL;
  const loaded = frameLoad(iframe);
  document.body.appendChild(iframe);
  await loaded;
  const win = iframe.contentWindow;
  const handle = installEmbedBridge([location.origin], { win });
  return { iframe, win, handle };
}

async function waitFor(pred, what) {
  for (let i = 0; i < 100; i++) {
    const hit = received.find(pred);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out waiting for ${what}; got ${JSON.stringify(received.map((m) => m.type))}`);
}

function host(win, msg) {
  win.postMessage({ source: 'webjs-embed-host', ...msg }, location.origin);
}

suite('dev embed bridge, browser half (#1498)', () => {
  test('is inert outside a frame and with no allowed origin', () => {
    assert.equal(installEmbedBridge([location.origin], { win: window }), null, 'a top-level page installs nothing');
    assert.equal(installEmbedBridge([], { win: window, parent: { postMessage() {} } }), null, 'no origins, no bridge');
  });

  test('ready and navigate carry the path and title', async () => {
    const { iframe, win, handle } = await mount();
    const ready = await waitFor((m) => m.type === 'ready', 'ready');
    assert.equal(ready.path, FRAME_PATH);
    assert.equal(ready.title, 'Framed page');
    win.history.pushState({}, '', FRAME_PATH + '?step=2');
    win.document.dispatchEvent(new CustomEvent('webjs:navigate'));
    const nav = await waitFor((m) => m.type === 'navigate', 'navigate');
    assert.equal(nav.path, FRAME_PATH + '?step=2');
    handle.uninstall();
    iframe.remove();
  });

  test('console error and warn are relayed, rate limited, and still reach the console', async () => {
    const { iframe, win, handle } = await mount();
    let printed = 0;
    // Wrap UNDER the bridge's wrapper, so this counts what the bridge forwards.
    handle.uninstall();
    const origError = win.console.error;
    win.console.error = function () { printed++; };
    const h2 = installEmbedBridge([location.origin], { win });
    win.console.warn('careful', 42);
    win.console.error('boom', { a: 1 }, new Error('inner'));
    const warn = await waitFor((m) => m.type === 'console' && m.level === 'warn', 'console warn');
    assert.equal(warn.message, 'careful 42');
    const err = await waitFor((m) => m.type === 'console' && m.level === 'error', 'console error');
    assert.equal(err.message, 'boom {"a":1} inner');
    for (let i = 0; i < 40; i++) win.console.error('spam ' + i);
    await new Promise((r) => setTimeout(r, 100));
    const consoleMsgs = received.filter((m) => m.type === 'console');
    assert.equal(consoleMsgs.length, 20, 'at most 20 console messages per second');
    assert.equal(printed, 41, 'every call still reaches the real console');
    h2.uninstall();
    win.console.error = origError;
    iframe.remove();
  });

  test('uncaught errors and unhandled rejections are relayed with their location', async () => {
    const { iframe, win, handle } = await mount();
    win.dispatchEvent(new win.ErrorEvent('error', {
      message: 'Uncaught Error: kaboom',
      filename: location.origin + '/components/counter.ts',
      lineno: 12,
      colno: 5,
      error: new Error('kaboom'),
    }));
    const e = await waitFor((m) => m.type === 'error' && /kaboom/.test(m.message), 'error');
    assert.equal(e.file, '/components/counter.ts', 'a same-origin file is reported as a path');
    assert.equal(e.line, 12);
    assert.equal(e.column, 5);
    assert.ok(typeof e.stack === 'string' && e.stack.length > 0, 'the stack rides along');
    const rej = new win.Event('unhandledrejection');
    rej.reason = new Error('nope');
    win.dispatchEvent(rej);
    const r = await waitFor((m) => m.type === 'error' && /nope/.test(m.message), 'unhandledrejection');
    assert.equal(r.message, 'Unhandled rejection: nope');
    handle.uninstall();
    iframe.remove();
  });

  test('fetch answering >= 500 and failing fetches are relayed, a 404 is not', async () => {
    const { iframe, win, handle } = await mount();
    handle.uninstall();
    win.fetch = (input) => {
      const u = String(input);
      if (u.includes('down')) return Promise.reject(new TypeError('Failed to fetch'));
      if (u.includes('abort')) return Promise.reject(new DOMException('aborted', 'AbortError'));
      return Promise.resolve(new Response('x', { status: u.includes('missing') ? 404 : 503 }));
    };
    const h2 = installEmbedBridge([location.origin], { win });
    await win.fetch('/api/missing');
    await win.fetch('/api/items?page=2', { method: 'post' });
    await win.fetch('/api/down').catch(() => {});
    await win.fetch('/api/abort').catch(() => {});
    await win.fetch('/__webjs/version').catch(() => {});
    await new Promise((r) => setTimeout(r, 100));
    const net = received.filter((m) => m.type === 'network');
    assert.deepEqual(net.map((m) => [m.method, m.url, m.status]), [
      ['POST', '/api/items?page=2', 503],
      ['GET', '/api/down', 0],
    ], 'only the 503 and the network failure are reported');
    assert.ok(/Failed to fetch/.test(net[1].error), 'a failure carries its error');
    h2.uninstall();
    iframe.remove();
  });

  test('an XHR answering >= 500 is relayed', async () => {
    const { iframe, win, handle } = await mount();
    const xhr = new win.XMLHttpRequest();
    xhr.open('GET', '/definitely-not-here.json');
    const done = new Promise((r) => xhr.addEventListener('loadend', r));
    xhr.send();
    await done;
    // The fixture server answers 404, which is NOT reported. Read a 502 off
    // the next one, whose real load event then fires with that status.
    const fake = new win.XMLHttpRequest();
    fake.open('PUT', '/api/thing');
    Object.defineProperty(fake, 'status', { value: 502 });
    const fakeDone = new Promise((r) => fake.addEventListener('loadend', r));
    fake.send();
    await fakeDone;
    const n = await waitFor((m) => m.type === 'network', 'xhr network');
    assert.deepEqual([n.method, n.url, n.status], ['PUT', '/api/thing', 502]);
    assert.equal(received.filter((m) => m.type === 'network').length, 1, 'the 404 was not reported');
    handle.uninstall();
    iframe.remove();
  });

  test('server-error relays what the dev overlay shows', async () => {
    const { iframe, win, handle } = await mount();
    win.document.dispatchEvent(new CustomEvent('webjs:dev-overlay', {
      detail: { kind: 'render', message: 'db is down', file: '/app/app/page.ts', line: 4 },
    }));
    const s = await waitFor((m) => m.type === 'server-error', 'server-error');
    assert.equal(s.message, 'db is down');
    assert.equal(s.kind, 'render');
    assert.equal(s.line, 4);
    handle.uninstall();
    iframe.remove();
  });

  test('renderDevOverlay announces an overlay it renders, and not one it holds for another url', () => {
    const seen = [];
    const on = (e) => seen.push(e.detail);
    document.addEventListener('webjs:dev-overlay', on);
    renderDevOverlay({ kind: 'render', message: 'elsewhere', url: '/some/other/page' });
    assert.equal(seen.length, 0, 'a frame scoped to another url renders nothing and announces nothing');
    renderDevOverlay({ kind: 'rebuild', message: 'syntax error', file: '/app/x.ts', line: 2 });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].message, 'syntax error');
    assert.equal(seen[0].kind, 'rebuild');
    dismissDevOverlay();
    document.removeEventListener('webjs:dev-overlay', on);
  });

  test('inspect mode captures a click and posts select with the nearest source location', async () => {
    const { iframe, win, handle } = await mount();
    const doc = win.document;
    let appClicks = 0;
    doc.getElementById('target').addEventListener('click', () => appClicks++);
    host(win, { type: 'inspect', enabled: true });
    for (let i = 0; i < 50 && !doc.querySelector('[data-webjs-embed-highlight]'); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.ok(doc.querySelector('[data-webjs-embed-highlight]'), 'the highlight box is mounted');
    doc.getElementById('target').dispatchEvent(new win.MouseEvent('click', { bubbles: true, composed: true, shiftKey: true, metaKey: true }));
    const sel = await waitFor((m) => m.type === 'select', 'select');
    // Modifier keys ride along so a host can multi-select (#1532).
    assert.equal(sel.shiftKey, true);
    assert.equal(sel.metaKey, true);
    assert.equal(sel.altKey, false);
    assert.equal(sel.ctrlKey, false);
    assert.equal(sel.src, 'app/page.ts:7');
    assert.equal(sel.tag, 'main', 'the reported element is the one carrying the source location');
    assert.equal(sel.text, 'Hello world');
    assert.ok(sel.rect && typeof sel.rect.width === 'number', 'a rect rides along');
    assert.equal(appClicks, 0, 'the app never saw the inspect click');
    doc.querySelector('#plain span').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    const plain = await waitFor((m) => m.type === 'select' && m.src === null, 'select without source');
    assert.equal(plain.tag, 'span');
    host(win, { type: 'inspect', enabled: false });
    for (let i = 0; i < 50 && doc.querySelector('[data-webjs-embed-highlight]'); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(doc.querySelector('[data-webjs-embed-highlight]'), null, 'the highlight is removed');
    doc.getElementById('target').click();
    assert.equal(appClicks, 1, 'clicks reach the app again');
    handle.uninstall();
    iframe.remove();
  });

  test('host navigate follows a local path and ignores anything else; reload reloads', async () => {
    const { iframe, win } = await mount();
    let loads = 0;
    iframe.addEventListener('load', () => loads++);
    host(win, { type: 'navigate', path: '//evil.example/x' });
    host(win, { type: 'navigate', path: 'https://evil.example/x' });
    host(win, { type: 'navigate', path: '/\\evil.example' });
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(loads, 0, 'non-local paths are ignored');
    const nav = frameLoad(iframe);
    host(win, { type: 'navigate', path: FRAME_PATH + '?went=1' });
    await nav;
    assert.equal(iframe.contentWindow.location.search, '?went=1', 'the frame navigated (a full load, no client router here)');
    // The bridge was installed from outside, so the new document has none;
    // install again to drive reload.
    installEmbedBridge([location.origin], { win: iframe.contentWindow });
    const reloaded = frameLoad(iframe);
    host(iframe.contentWindow, { type: 'reload' });
    await reloaded;
    assert.equal(iframe.contentWindow.location.search, '?went=1', 'reload keeps the url');
    iframe.remove();
  });

  test('every host command counts as activity, so resume reopens an idle-closed reload stream (#1507)', async () => {
    const { iframe, win, handle } = await mount();
    let pings = 0;
    win.__webjsDevActivity = () => { pings++; };
    host(win, { type: 'resume' });
    host(win, { type: 'inspect', enabled: false });
    for (let i = 0; i < 50 && pings < 2; i++) await new Promise((r) => setTimeout(r, 10));
    assert.equal(pings, 2, 'resume and any other host command ping the reload relay');
    handle.uninstall();
    iframe.remove();
  });

  test('a host message that is not from the parent window is ignored', async () => {
    const { iframe, win, handle } = await mount();
    // Posted by the frame to itself: right origin, wrong source. It must run
    // in the frame's realm, since postMessage stamps the CALLING window as the
    // source, and a call made from this test file would read as the parent.
    win.eval("postMessage({ source: 'webjs-embed-host', type: 'inspect', enabled: true }, location.origin)");
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(win.document.querySelector('[data-webjs-embed-highlight]'), null);
    handle.uninstall();
    iframe.remove();
  });
  test('hold pauses the reload client, persists for the tab, and its release applies the pending reload (#1532)', async () => {
    const { iframe, win, handle } = await mount();
    let releases = 0;
    win.__webjsDevReleaseHold = () => { releases++; };
    host(win, { type: 'hold', enabled: true });
    const on = await waitFor((m) => m.type === 'hold' && m.enabled === true, 'hold ack');
    assert.equal(on.enabled, true);
    assert.equal(win.__webjsEmbedHold, true, 'the reload client reads this flag');
    assert.equal(win.sessionStorage.getItem('webjs-embed-hold'), '1', 'a new document in this tab starts held');
    assert.equal(releases, 0, 'holding releases nothing');
    // A new document in the tab installs held.
    handle.uninstall();
    win.__webjsEmbedHold = false;
    const h2 = installEmbedBridge([location.origin], { win });
    assert.equal(win.__webjsEmbedHold, true, 'the stored hold is picked up at install');
    received = [];
    host(win, { type: 'hold', enabled: false });
    await waitFor((m) => m.type === 'hold' && m.enabled === false, 'release ack');
    assert.equal(win.__webjsEmbedHold, false);
    assert.equal(win.sessionStorage.getItem('webjs-embed-hold'), null);
    assert.equal(releases, 1, 'the release asks the reload client to apply what it held');
    h2.uninstall();
    iframe.remove();
  });

  test('scroll is restored when the frame reloads on the same path, not on another path (#1532)', async () => {
    const TALL = new URL('./embed-frame-tall.html', import.meta.url).href;
    const iframe = document.createElement('iframe');
    iframe.style.height = '300px';
    iframe.src = TALL;
    let loaded = frameLoad(iframe);
    document.body.appendChild(iframe);
    await loaded;
    let win = iframe.contentWindow;
    // Take the browser's own restoration out of the picture, so only the
    // bridge can put the position back.
    win.history.scrollRestoration = 'manual';
    let handle = installEmbedBridge([location.origin], { win });
    win.scrollTo(0, 1234);
    assert.equal(Math.round(win.scrollY), 1234);
    loaded = frameLoad(iframe);
    win.location.reload();
    await loaded;
    win = iframe.contentWindow;
    handle = installEmbedBridge([location.origin], { win });
    assert.equal(Math.round(win.scrollY), 1234, 'the reload kept the scroll position');
    assert.equal(win.sessionStorage.getItem('webjs-embed-scroll'), null, 'the saved position is used once');
    // A different path never takes it.
    win.scrollTo(0, 800);
    loaded = frameLoad(iframe);
    win.location.href = TALL + '?other=1';
    await loaded;
    win = iframe.contentWindow;
    handle = installEmbedBridge([location.origin], { win });
    assert.equal(Math.round(win.scrollY), 0, 'another path starts at the top');
    handle.uninstall();
    iframe.remove();
  });
});
