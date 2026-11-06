/**
 * `GET /__webjs/dev/status` (#1664): has the last edit settled, and what broke
 * since the last rebuild. An agent waits on it instead of sleeping and grepping
 * a page for "Server error".
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import { invokeActionForTest } from '../../src/testing.js';
import { createDevStatus, PENDING_CHANGE_TTL_MS, DEV_STATUS_MAX_ERRORS } from '../../src/dev/dev-status.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE = JSON.stringify(pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString());

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-dev-status-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp() {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  const files = {
    'app/page.ts': `import { html } from ${CORE};\nexport default () => html\`<p>home</p>\`;\n`,
    'app/boom/page.ts': `export default () => { throw new Error('page exploded'); };\n`,
    'modules/x/fail.server.ts': `'use server';\nexport async function failHard() { throw new Error('action exploded'); }\n`,
    'modules/x/go.server.ts': `'use server';\nimport { redirect } from ${CORE};\nexport async function goHome() { redirect('/'); }\n`,
    'app/act/page.ts': `import { html } from ${CORE};\nimport { failHard } from '../../modules/x/fail.server.ts';\nexport default () => html\`<form action=\${failHard}><button>go</button></form>\`;\n`,
  };
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

function quiet() {
  const { error, warn } = console;
  console.error = () => {}; console.warn = () => {};
  return () => { console.error = error; console.warn = warn; };
}

const status = async (app, qs = '') => (await app.handle(new Request(`http://x/__webjs/dev/status${qs}`))).json();

test('a clean dev app reports ok and settled, with no errors', async () => {
  const app = await createRequestHandler({ appDir: makeApp(), dev: true, logger: { info() {}, warn() {}, error() {} } });
  await app.warmup();
  const body = await status(app, '?wait=5');
  assert.equal(body.status, 'ok');
  assert.equal(body.settled, true);
  assert.equal(body.ready, 'ok');
  assert.deepEqual(body.errors, []);
  assert.equal(typeof body.rebuilds, 'number');
});

test('the endpoint does not exist in production', async () => {
  const app = await createRequestHandler({ appDir: makeApp(), dev: false, logger: { info() {}, warn() {}, error() {} } });
  const res = await app.handle(new Request('http://x/__webjs/dev/status'));
  assert.equal(res.status, 404);
});

test('a failing render, a failing RPC action and a failing form action are all reported, with file and line', async () => {
  const restore = quiet();
  try {
    const appDir = makeApp();
    const app = await createRequestHandler({ appDir, dev: true, logger: { info() {}, warn() {}, error() {} } });
    await app.warmup();

    const page = await app.handle(new Request('http://x/boom'));
    assert.equal(page.status, 500);
    let body = await status(app);
    assert.equal(body.status, 'error');
    const render = body.errors.find((e) => e.kind === 'render');
    assert.ok(render, 'the render error is listed');
    assert.match(render.message, /page exploded/);
    assert.equal(render.url, '/boom');
    assert.match(String(render.file), /boom[\\/]page\.ts$/);
    assert.equal(typeof render.line, 'number');

    await assert.rejects(invokeActionForTest(app, join(appDir, 'modules/x/fail.server.ts'), 'failHard', []));
    body = await status(app);
    const rpc = body.errors.find((e) => e.kind === 'action');
    assert.ok(rpc, 'an RPC action error is listed even with no onError sink');
    assert.match(rpc.message, /action exploded/);

    const formPage = await (await app.handle(new Request('http://x/act'))).text();
    const id = /name="__webjs_action" value="([^"]*)"/.exec(formPage)[1];
    const submit = await app.handle(new Request('http://x/act', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://x' },
      body: new URLSearchParams({ __webjs_action: id }).toString(),
    }));
    assert.equal(submit.status, 500);
    body = await status(app);
    const formErrors = body.errors.filter((e) => e.kind === 'action' && e.url === '/act');
    assert.equal(formErrors.length, 1, 'a form action error is listed, under its page url');
  } finally { restore(); }
});

test('a rebuild keeps a render error until that page renders again, and clears the rest', async () => {
  const restore = quiet();
  try {
    const appDir = makeApp();
    const app = await createRequestHandler({ appDir, dev: true, logger: { info() {}, warn() {}, error() {} } });
    await app.warmup();
    await app.handle(new Request('http://x/boom'));
    await invokeActionForTest(app, join(appDir, 'modules/x/fail.server.ts'), 'failHard', []).catch(() => {});
    assert.deepEqual((await status(app)).errors.map((e) => e.kind).sort(), ['action', 'render']);

    // An unrelated rebuild: the page is still broken, so its error stays.
    await app.rebuild();
    let body = await status(app, '?wait=5');
    assert.deepEqual(body.errors.map((e) => e.kind), ['render'], 'the render error survives, the action error is cleared');
    assert.equal(body.status, 'error');

    // Requesting the still-broken page again does not duplicate the entry.
    await app.handle(new Request('http://x/boom'));
    assert.equal((await status(app)).errors.length, 1);

    // Fix the page: once it renders, its error goes.
    writeFileSync(join(appDir, 'app/boom/page.ts'), `import { html } from ${CORE};\nexport default () => html\`<p>fixed</p>\`;\n`);
    await app.rebuild();
    assert.equal((await app.handle(new Request('http://x/boom'))).status, 200);
    body = await status(app, '?wait=5');
    assert.deepEqual(body.errors, []);
    assert.equal(body.status, 'ok');
  } finally { restore(); }
});

test('a throwing route handler is recorded as a route error, even under a root middleware', async () => {
  const restore = quiet();
  try {
    const appDir = makeApp();
    writeFileSync(join(appDir, 'middleware.ts'), `export default async (req, next) => next();\n`);
    mkdirSync(join(appDir, 'app/api/bad'), { recursive: true });
    writeFileSync(join(appDir, 'app/api/bad/route.ts'), `export async function GET() { throw new Error('route exploded'); }\n`);
    const app = await createRequestHandler({ appDir, dev: true, logger: { info() {}, warn() {}, error() {} } });
    await app.warmup();
    assert.equal((await app.handle(new Request('http://x/api/bad'))).status, 500);
    const body = await status(app);
    assert.deepEqual(body.errors.map((e) => e.kind), ['route'], 'one entry, attributed to the route handler');
    assert.match(body.errors[0].message, /route exploded/);
    assert.match(String(body.errors[0].file), /api[\\/]bad[\\/]route\.ts$/);
  } finally { restore(); }
});

test('a layout that crashes while wrapping the 500 error boundary is recorded', async () => {
  const restore = quiet();
  try {
    const appDir = makeApp();
    // The boundary marks that it rendered; the layout throws only when it is
    // wrapping the boundary, the path that never reached the overlay.
    writeFileSync(join(appDir, 'app/error.ts'), `import { html } from ${CORE};\nexport default () => { globalThis.__wj1664Boundary = true; return html\`<p>boundary</p>\`; };\n`);
    writeFileSync(join(appDir, 'app/layout.ts'), `import { html } from ${CORE};\nexport default ({ children }) => { if (globalThis.__wj1664Boundary) { globalThis.__wj1664Boundary = false; throw new Error('layout exploded around the boundary'); } return html\`<main>\${children}</main>\`; };\n`);
    const app = await createRequestHandler({ appDir, dev: true, logger: { info() {}, warn() {}, error() {} } });
    await app.warmup();
    await app.handle(new Request('http://x/boom'));
    const body = await status(app);
    assert.ok(body.errors.some((e) => /page exploded/.test(e.message)), 'the page error is listed');
    assert.ok(body.errors.some((e) => /layout exploded around the boundary/.test(e.message)),
      'and so is the layout crash on the boundary path');
  } finally { restore(); delete globalThis.__wj1664Boundary; }
});

test('?wait holds until a pending change is rebuilt and the app is warm again', async () => {
  const app = await createRequestHandler({ appDir: makeApp(), dev: true, logger: { info() {}, warn() {}, error() {} } });
  await app.warmup();
  const before = (await status(app)).rebuilds;

  app.noteChange();
  const noWait = await status(app);
  assert.equal(noWait.settled, false, 'without wait a pending change reports unsettled at once');
  assert.equal(noWait.status, 'pending');

  let answered = false;
  const waiting = status(app, '?wait=10').then((b) => { answered = true; return b; });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(answered, false, 'the wait is still holding while the change is unbuilt');
  await app.rebuild();
  const body = await waiting;
  assert.equal(body.settled, true);
  assert.equal(body.ready, 'ok');
  assert.equal(body.rebuilds, before + 1);
});

test('the status ring dedupes a repeated report, caps its length, and expires a lost change', () => {
  let t = 1000;
  const s = createDevStatus({ now: () => t });
  const frame = { kind: 'render', message: 'x', file: '/a.ts', line: 1, url: '/' };
  s.record(frame);
  s.record(frame);
  assert.equal(s.snapshot().errors.length, 1, 'the same failure reported twice in a row is one entry');
  for (let i = 0; i < DEV_STATUS_MAX_ERRORS + 5; i++) s.record({ kind: 'action', message: 'm' + i });
  assert.equal(s.snapshot().errors.length, DEV_STATUS_MAX_ERRORS);
  assert.equal(s.snapshot().errors.at(-1).message, 'm' + (DEV_STATUS_MAX_ERRORS + 4), 'the newest are kept');

  s.noteChange();
  assert.equal(s.changing(), true);
  t += PENDING_CHANGE_TTL_MS + 1;
  assert.equal(s.changing(), false, 'a change no rebuild ever followed stops holding a wait');

  s.rebuildStarted();
  assert.equal(s.changing(), true, 'a running rebuild is a change in flight');
  s.rebuildFinished();
  assert.equal(s.changing(), false);
  assert.equal(s.snapshot().errors.length, 0, 'a finished rebuild drops the errors it replaced');
});

test('a thrown redirect() from an action is control flow, not an error', async () => {
  const appDir = makeApp();
  const app = await createRequestHandler({ appDir, dev: true, logger: { info() {}, warn() {}, error() {} } });
  await app.warmup();
  await invokeActionForTest(app, join(appDir, 'modules/x/go.server.ts'), 'goHome', []).catch(() => {});
  const body = await status(app);
  assert.deepEqual(body.errors, [], 'the redirect is not listed');
  assert.equal(body.status, 'ok');
});

// #1664 second review round.
test('a change noted while a rebuild runs keeps the status unsettled after that rebuild', () => {
  let t = 1000;
  const s = createDevStatus({ now: () => t });
  s.noteChange();
  s.rebuildStarted();
  s.noteChange(); // a second save lands while the first rebuild runs
  s.rebuildFinished();
  assert.equal(s.changing(), true, 'the second change is still waiting on its own rebuild');
  s.rebuildStarted();
  s.rebuildFinished();
  assert.equal(s.changing(), false);
});

test('an error object thrown again after a rebuild is recorded again', async () => {
  const restore = quiet();
  try {
    const appDir = makeApp();
    // The same Error instance on every call: a rejected module-scope init.
    writeFileSync(join(appDir, 'modules/x/init.server.ts'), `'use server';\nconst failure = new Error('init failed');\nexport async function useInit() { throw failure; }\n`);
    const app = await createRequestHandler({ appDir, dev: true, logger: { info() {}, warn() {}, error() {} } });
    await app.warmup();
    await invokeActionForTest(app, join(appDir, 'modules/x/init.server.ts'), 'useInit', []).catch(() => {});
    assert.equal((await status(app)).errors.length, 1);
    await app.rebuild();
    assert.equal((await status(app, '?wait=5')).errors.length, 0, 'an action error is cleared by the rebuild');
    await invokeActionForTest(app, join(appDir, 'modules/x/init.server.ts'), 'useInit', []).catch(() => {});
    const body = await status(app);
    assert.equal(body.errors.length, 1, 'the same object thrown again is recorded again');
    assert.match(body.errors[0].message, /init failed/);
  } finally { restore(); }
});

test('a deleted page that now answers 404 clears its render error', async () => {
  const restore = quiet();
  try {
    const appDir = makeApp();
    const app = await createRequestHandler({ appDir, dev: true, logger: { info() {}, warn() {}, error() {} } });
    await app.warmup();
    await app.handle(new Request('http://x/boom'));
    assert.equal((await status(app)).errors.length, 1);
    rmSync(join(appDir, 'app/boom'), { recursive: true, force: true });
    await app.rebuild();
    assert.equal((await app.handle(new Request('http://x/boom'))).status, 404);
    assert.deepEqual((await status(app, '?wait=5')).errors, [], 'a page that is gone has no render error');
  } finally { restore(); }
});

test('a POST form that binds no action is recorded against the page, not framework source', async () => {
  const restore = quiet();
  try {
    const appDir = makeApp();
    const app = await createRequestHandler({ appDir, dev: true, logger: { info() {}, warn() {}, error() {} } });
    await app.warmup();
    const res = await app.handle(new Request('http://x/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'http://x' },
      body: 'name=ada',
    }));
    assert.equal(res.status, 405);
    const body = await status(app);
    assert.equal(body.errors.length, 1);
    assert.equal(body.errors[0].kind, 'form');
    assert.match(body.errors[0].message, /^WEBJS_FORM_ACTION_MISSING: /);
    assert.equal(body.errors[0].url, '/');
    assert.equal(body.errors[0].file, null, 'no file inside the framework');
  } finally { restore(); }
});
