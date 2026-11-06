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

test('a rebuild clears the errors it replaced', async () => {
  const restore = quiet();
  try {
    const app = await createRequestHandler({ appDir: makeApp(), dev: true, logger: { info() {}, warn() {}, error() {} } });
    await app.warmup();
    await app.handle(new Request('http://x/boom'));
    assert.equal((await status(app)).errors.length, 1);
    await app.rebuild();
    const body = await status(app, '?wait=5');
    assert.deepEqual(body.errors, []);
    assert.equal(body.status, 'ok');
  } finally { restore(); }
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
