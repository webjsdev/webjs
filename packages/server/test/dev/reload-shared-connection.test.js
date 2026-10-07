/**
 * The dev live-reload client shares ONE connection across all tabs via a
 * SharedWorker (#887). Before this, each tab opened its own `EventSource`, and
 * on an HTTP/1.1 dev server the browser's ~6-connections-per-host cap meant a
 * handful of open tabs held every slot with idle SSE streams and later tabs
 * could not fetch their HTML. Here we drive the two dev routes directly through
 * the handler (no browser needed; the served scripts are pure strings) and
 * assert the client uses the SharedWorker with an EventSource fallback and the
 * worker holds the single stream and relays to every port.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createRequestHandler } from '../../src/dev.js';

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-reload-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(webjs) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  mkdirSync(join(appDir, 'app'), { recursive: true });
  writeFileSync(join(appDir, 'app', 'page.js'), "export default function P() { return 'ok'; }\n");
  if (webjs) writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'x', webjs }));
  return appDir;
}

test('dev serves the reload SharedWorker, and the client uses it with a direct EventSource fallback', async () => {
  const appDir = makeApp();
  const app = await createRequestHandler({ appDir, dev: true });

  const client = await app.handle(new Request('http://x/__webjs/reload.js'));
  assert.equal(client.status, 200);
  assert.match(client.headers.get('content-type') || '', /javascript/);
  const clientSrc = await client.text();
  // The primary path is one shared connection through the SharedWorker.
  assert.match(clientSrc, /new SharedWorker\(/, 'client constructs a SharedWorker');
  assert.match(clientSrc, /reload-worker\.js/, 'client points the worker at the worker route');
  // The fallback keeps a per-tab connection where SharedWorker is unavailable,
  // and the whole thing is guarded so a construction failure (a strict dev CSP)
  // degrades instead of breaking. Since #1397 the fallback runs the SAME relay
  // in the tab over a shim port rather than a second copy of the boot-id rule,
  // so the client inlines the relay module too and hands it `EventSource`.
  assert.match(clientSrc, /typeof SharedWorker/, 'client feature-detects SharedWorker');
  assert.match(clientSrc, /function startReloadWorker/, 'the client inlines the relay module for the fallback');
  assert.match(clientSrc, /startReloadWorker\(scope, EventSource, "\/__webjs\/events", \{ idleMs: 0 \}\)/, 'the fallback runs the relay against the real EventSource');
  assert.match(clientSrc, /scope\.onconnect\(\{ ports: \[shim\] \}\)/, 'and drives it over a shim port');
  // #1507: both paths tell the relay whether the tab is visible, so the
  // stream is held open only while someone is looking.
  assert.match(clientSrc, /function __webjsReportVisibility/, 'the client reports its visibility');
  assert.equal(clientSrc.match(/__webjsReportVisibility\(function/g).length, 2, 'from the SharedWorker path and the fallback alike');
  // The shim's postMessage runs application code synchronously, and the relay's
  // fanout DELETES a port whose postMessage throws (correct for a real
  // MessagePort, where a throw means the tab is gone). Unguarded, an overlay
  // render that threw would permanently unsubscribe the tab and silently kill
  // its live reload, which the pre-#1397 fallback could not do because it
  // attached to the EventSource directly.
  //
  // Sliced to the fallback function's own body first. A regex over the whole
  // client matches the SharedWorker bootstrap's `try { ... } catch` further
  // down and passes with the guard removed, which is a test that observes
  // nothing.
  //
  // The slice must end at the function's OWN closing brace, not at the
  // bootstrap that follows it: ending at `indexOf('if (typeof SharedWorker')`
  // still trails `}\ntry {`, which leaves the bootstrap's `try` inside the
  // slice and the guard assertion vacuous again.
  //
  // Each assertion below was checked INDIVIDUALLY against the counterfactual,
  // not just the file as a whole. Checking the file is what let two vacuous
  // assertions through earlier here: the run went red on a later assertion and
  // the earlier one was recorded as discriminating without being looked at.
  // Removing the guard fails the `try`-present and ordering assertions;
  // removing only the `console.error` fails the reporting one.
  const fallbackStart = clientSrc.indexOf('function __webjsDirectEvents()');
  assert.notEqual(fallbackStart, -1, 'the fallback function is in the client');
  const fallbackEnd = clientSrc.indexOf('\n}\n', fallbackStart);
  assert.notEqual(fallbackEnd, -1, 'the fallback function closes');
  const fallbackBody = clientSrc.slice(fallbackStart, fallbackEnd + 2);
  assert.ok(!/if \(typeof SharedWorker/.test(fallbackBody), 'the slice stops before the bootstrap');
  assert.match(
    fallbackBody,
    /postMessage\(m\)\s*\{[^]*?try\s*\{/,
    'the shim port opens a try before running any application code',
  );
  assert.match(fallbackBody, /\}\s*catch\s*\(_\)/, 'and catches the throw so the relay cannot drop the tab');
  assert.match(fallbackBody, /console\.error\(/, 'and reports it rather than discarding it');
  // Both indices are asserted present FIRST. `indexOf` returns -1 for a
  // missing needle, and -1 is less than any real index, so a bare `<`
  // comparison passes when the guard is gone entirely, which is the one case
  // this assertion exists for.
  const tryAt = fallbackBody.indexOf('try {');
  const reloadAt = fallbackBody.indexOf('__webjsApplyReload(m.verdict)');
  assert.notEqual(tryAt, -1, 'the guard is present at all');
  assert.notEqual(reloadAt, -1, 'the reload call is present at all');
  assert.ok(tryAt < reloadAt, 'the guard opens BEFORE the reload call, not around something else');
  assert.match(clientSrc, /catch\s*\(_\)\s*\{\s*__webjsDirectEvents/, 'a worker failure falls back');
  // The debounce (#1397) is part of the relay, so it ships in BOTH scripts.
  assert.match(clientSrc, /const RELOAD_QUIET_MS/, 'the reload debounce ships in the client fallback');
  assert.match(clientSrc, /const RELOAD_MAX_HOLD_MS/, 'including the max-hold cap');
  // The overlay still renders on the main thread (a worker has no DOM).
  assert.match(clientSrc, /renderDevOverlay/, 'the error overlay still renders in the client');
  // ...and it tracks the page actually on screen (#1047). The gate lives in the
  // inlined module, so what ships has to be the module PLUS this one call.
  assert.match(clientSrc, /function installDevOverlayNavSync/, 'the nav sync is inlined');
  assert.match(clientSrc, /^installDevOverlayNavSync\(\);$/m, 'and the client installs it');
  // The inlined modules are `export`-stripped, so a leftover `export` keyword
  // would be a syntax error in the classic script the browser runs.
  assert.ok(!/\bexport\s/.test(clientSrc), 'no export keyword survives into the classic script');
  assert.doesNotThrow(() => new Function(clientSrc), 'the emitted client parses');

  const worker = await app.handle(new Request('http://x/__webjs/reload-worker.js'));
  assert.equal(worker.status, 200);
  assert.match(worker.headers.get('content-type') || '', /javascript/);
  const workerSrc = await worker.text();
  // The worker inlines the shared relay module and bootstraps it with the real
  // globals (the relay behaviour itself is exercised in the browser test).
  assert.match(workerSrc, /function startReloadWorker/, 'the worker inlines the relay module');
  assert.match(workerSrc, /startReloadWorker\(self, EventSource, "\/__webjs\/events", \{ idleMs: 0 \}\)/, 'it wires the single events stream to the worker');
  assert.match(workerSrc, /scope\.onconnect/, 'the relay accepts a port per tab');
  assert.match(workerSrc, /lastError = null/, 'the relay clears the cached error on reload');
  assert.match(workerSrc, /if \(lastError != null\)/, 'a late-joining tab gets the current error');
  assert.match(workerSrc, /const RELOAD_QUIET_MS/, 'the reload debounce ships in the worker (#1397)');
  assert.ok(!/\bexport\s/.test(workerSrc), 'no export keyword survives into the classic worker script');
});

test('both reload routes 404 in prod (never shipped to a production page)', async () => {
  const appDir = makeApp();
  const app = await createRequestHandler({ appDir, dev: false });
  const client = await app.handle(new Request('http://x/__webjs/reload.js'));
  const worker = await app.handle(new Request('http://x/__webjs/reload-worker.js'));
  assert.equal(client.status, 404, 'reload client is dev-only');
  assert.equal(worker.status, 404, 'reload worker is dev-only');
});

test('the worker events URL carries the base path under a sub-path deploy (#256)', async () => {
  const appDir = makeApp({ basePath: '/app' });
  const app = await createRequestHandler({ appDir, dev: true });
  const worker = await (await app.handle(new Request('http://x/app/__webjs/reload-worker.js'))).text();
  assert.match(worker, /startReloadWorker\(self, EventSource, "\/app\/__webjs\/events", \{ idleMs: 0 \}\)/, 'events URL is base-path prefixed in the worker');
  const client = await (await app.handle(new Request('http://x/app/__webjs/reload.js'))).text();
  assert.match(client, /reload-worker\.js/, 'client references the worker');
  assert.match(client, /\/app\/__webjs\/reload-worker\.js/, 'worker URL is base-path prefixed in the client');
});

// #893: a reload must never paint into a half-restarted server, and an app edit
// must never need a manual refresh. The client gates every reload on the server
// being healthy (probe /__webjs/version, then reload), and the direct-EventSource
// fallback treats a reconnect after a drop (a `node --watch` restart) as an edit
// signal so the reload fires even when the in-process reload frame was killed
// with the old process.
test('the reload client probes the server is up before reloading (no restart flash, #893)', async () => {
  const appDir = makeApp();
  const app = await createRequestHandler({ appDir, dev: true });
  const clientSrc = await (await app.handle(new Request('http://x/__webjs/reload.js'))).text();

  assert.match(clientSrc, /function __webjsWhenReady/, 'reload is gated on a readiness probe');
  assert.match(clientSrc, /function __webjsApplyReload/, 'and the signal is applied through the verdict branch (#1398)');
  assert.match(clientSrc, /fetch\(\"\/__webjs\/version\"/, 'the probe hits the lightweight version endpoint');
  // ONE probe helper with two callers, not a copied loop (#1398). The 100-try
  // bound and its `location.reload()` exhaustion behaviour are shared, so a
  // genuinely dead server still shows the browser's own error page.
  assert.equal(clientSrc.match(/fetch\(\"\/__webjs\/version\"/g).length, 1, 'the readiness loop exists exactly once');
  assert.match(clientSrc, /if \(\+\+tries > 100\) location\.reload\(\)/, 'the probe is bounded and exhaustion still reloads');
  // The morph is feature-DETECTED at runtime, never assumed (#1398). The
  // absence of the global covers `webjs.clientRouter: false` AND a page that
  // ships no component at all, and both fall back to a full reload.
  assert.match(clientSrc, /globalThis\.__webjsRefreshPage/, 'the refresh entry is feature-detected on the global');
  assert.match(clientSrc, /typeof refresh === 'function'/, 'and only used when it is actually a function');
  assert.match(clientSrc, /verdict === 'page' \|\| verdict === 'shell'/, 'only the two morphable verdicts take the refresh path');
  assert.match(clientSrc, /if \(!ok\) \{ location\.reload\(\); return; \}/, 'a refresh that declines falls back to a full reload');
  // A swap never re-requests a stylesheet on its own (mergeHead preserves them
  // per #936, and the dev href carries no content hash), so `webjs.dev.regenerate`
  // would never run and a newly added utility class would have no backing rule.
  // Only that the shared module SHIPS and is CALLED. Its behaviour (which node
  // survives a load versus an error, the de-dupe) is a DOM fact and is asserted
  // against real link elements and real events in
  // `test/dev/browser/refresh-styles.test.js`, which imports the same source
  // this inlines. A source-shape regex here could not tell a correct handler
  // from one that removes the wrong node.
  // A refresh has no exit for a live error overlay (the overlay's teardown is
  // keyed on the URL changing, and a same-url refresh never changes it), so the
  // client takes one down before re-rendering. BEFORE, not after: a render that
  // fails again pushes a fresh frame DURING it, and dismissing afterwards would
  // wipe that legitimately-new overlay.
  const dismissAt = clientSrc.indexOf('dismissDevOverlay();');
  const refreshAt = clientSrc.indexOf('refresh(verdict).then');
  assert.notEqual(dismissAt, -1, 'the refresh path dismisses a live error overlay');
  assert.notEqual(refreshAt, -1, 'and the refresh call is present at all');
  assert.ok(dismissAt < refreshAt, 'the dismiss happens BEFORE the re-render, not after it');
  assert.match(clientSrc, /function preloadStyles/, 'the stylesheet re-request ships in the client (#967 regenerate runs ON REQUEST)');
  // #1535: the rebuilt sheets load BEFORE the markup swap, and the old ones
  // go only after it, so a new class never paints without its rule.
  const preloadAt = clientSrc.indexOf('preloadStyles().then(');
  assert.notEqual(preloadAt, -1, 'an applied refresh preloads the stylesheets');
  assert.ok(preloadAt < refreshAt, 'BEFORE the markup swap, not after it');
  assert.ok(clientSrc.indexOf('styles.commit();') > refreshAt, 'and commits (drops the old sheets) after the swap');
  // The verdict parser ships too, so an unparseable frame resolves to reload
  // inside the tab rather than being trusted.
  assert.match(clientSrc, /function parseVerdict/, 'the verdict parser ships in the client fallback');
  // Both the SharedWorker path and the direct fallback route through the gate,
  // never a bare location.reload() on a reload signal. Since #1397 the fallback
  // reaches it through the shim port the shared relay posts to, which is the
  // same message contract the SharedWorker path consumes.
  assert.match(clientSrc, /if \(m\.type === 'reload'\) __webjsApplyReload\(m\.verdict\)/, 'both paths gate the reload');
  assert.match(clientSrc, /else if \(m\.type === 'webjs-error'\) __webjsApplyError\(m\.data\)/, 'and both route an error frame to the overlay');
  // The boot-id rule (#893) lives in the relay now, in ONE place, rather than
  // being re-implemented in the fallback where the two copies could drift.
  assert.match(clientSrc, /if \(lastBoot !== null && \(h\.boot !== lastBoot \|\| \(h\.seq !== null && lastSeq !== null && h\.seq !== lastSeq\)\)\) \{\s*requestReload\('reload'\);/, 'only a changed boot id, or a reload missed while paused (#1507), reloads, and it is unconditionally a FULL reload (#1398)');
  assert.equal(clientSrc.match(/lastBoot !== null/g).length, 1, 'the boot-id rule exists exactly once');
});

test('the direct-fallback probe carries the base path under a sub-path deploy (#893 + #256)', async () => {
  const appDir = makeApp({ basePath: '/app' });
  const app = await createRequestHandler({ appDir, dev: true });
  const clientSrc = await (await app.handle(new Request('http://x/app/__webjs/reload.js'))).text();
  assert.match(clientSrc, /fetch\(\"\/app\/__webjs\/version\"/, 'the readiness probe is base-path prefixed');
});

// #1507: webjs.dev.reloadIdle (seconds) reaches both served scripts as idleMs,
// and a set WEBJS_DEV_RELOAD_IDLE wins over it.
test('webjs.dev.reloadIdle and WEBJS_DEV_RELOAD_IDLE set the relay idle close (#1507)', async () => {
  const saved = process.env.WEBJS_DEV_RELOAD_IDLE;
  try {
    delete process.env.WEBJS_DEV_RELOAD_IDLE;
    const appDir = makeApp({ dev: { reloadIdle: 20 } });
    let app = await createRequestHandler({ appDir, dev: true });
    const worker = await (await app.handle(new Request('http://x/__webjs/reload-worker.js'))).text();
    assert.match(worker, /\{ idleMs: 20000 \}\)/, 'the config seconds become idleMs');
    const client = await (await app.handle(new Request('http://x/__webjs/reload.js'))).text();
    assert.match(client, /\{ idleMs: 20000 \}\)/, 'the fallback relay gets it too');
    process.env.WEBJS_DEV_RELOAD_IDLE = '5';
    app = await createRequestHandler({ appDir, dev: true });
    assert.match(await (await app.handle(new Request('http://x/__webjs/reload-worker.js'))).text(), /\{ idleMs: 5000 \}\)/, 'the env var wins');
  } finally {
    if (saved === undefined) delete process.env.WEBJS_DEV_RELOAD_IDLE;
    else process.env.WEBJS_DEV_RELOAD_IDLE = saved;
  }
});

// #1516: a dev page carries the reload state it was rendered at, and the client
// hands it to the relay, which re-checks it on every reconnect.
test('a dev page renders the reload state meta when a reload stream exists, and the client sends it', async () => {
  const { setDevReloadState } = await import('../../src/dev-reload-state.js');
  const appDir = makeApp();
  const app = await createRequestHandler({ appDir, dev: true });
  try {
    const noStream = await (await app.handle(new Request('http://x/'))).text();
    assert.doesNotMatch(noStream, /webjs-dev-reload/, 'no reload stream (embedded handler): no meta');

    let seq = 7;
    setDevReloadState(() => ({ boot: 'boot-1', seq }));
    const html = await (await app.handle(new Request('http://x/'))).text();
    const m = html.match(/<meta name="webjs-dev-reload" content="([^"]*)">/);
    assert.ok(m, 'the meta tag is rendered');
    assert.deepEqual(JSON.parse(m[1].replace(/&quot;/g, '"')), { boot: 'boot-1', seq: 7 });
    seq = 8;
    const later = await (await app.handle(new Request('http://x/'))).text();
    assert.match(later, /&quot;seq&quot;:8/, 'each render reads the current seq');

    const clientSrc = await (await app.handle(new Request('http://x/__webjs/reload.js'))).text();
    assert.match(clientSrc, /meta\[name="webjs-dev-reload"\]/, 'the client reads the meta');
    assert.match(clientSrc, /type: 'page'/, 'and sends it to the relay');
  } finally {
    setDevReloadState(null);
  }
});

test('a production page never renders the reload state meta', async () => {
  const { setDevReloadState } = await import('../../src/dev-reload-state.js');
  const appDir = makeApp();
  setDevReloadState(() => ({ boot: 'boot-1', seq: 1 }));
  try {
    const app = await createRequestHandler({ appDir, dev: false });
    const html = await (await app.handle(new Request('http://x/'))).text();
    assert.doesNotMatch(html, /webjs-dev-reload/);
  } finally {
    setDevReloadState(null);
  }
});
