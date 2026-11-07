/**
 * The dev status command (#1664). `runStatus` is pure of `process`, so these
 * drive it against the REAL dev handler in-process (its fetch dispatches to
 * `handle()`), plus a refused connection and a not-dev server.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runStatus, NO_SERVER_EXIT_CODE } from '../../packages/cli/lib/status.js';
import { createRequestHandler } from '../../packages/server/src/dev.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORE = JSON.stringify(pathToFileURL(resolve(HERE, '../../packages/core/index.js')).toString());
const SILENT = { info() {}, warn() {}, error() {} };

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-status-cli-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp() {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  const files = {
    'app/page.ts': `import { html } from ${CORE};\nexport default () => html\`<p>home</p>\`;\n`,
    'app/boom/page.ts': `export default () => { throw new Error('page exploded'); };\n`,
  };
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(appDir, rel)), { recursive: true });
    writeFileSync(join(appDir, rel), body);
  }
  return appDir;
}

/** A runStatus harness whose fetch is the dev handler itself. */
async function harness(dev = true) {
  const appDir = makeApp();
  const app = await createRequestHandler({ appDir, dev, logger: SILENT });
  const lines = [];
  const errs = [];
  const run = (opts = {}) => runStatus({
    port: 3999,
    graceMs: 0,
    timeoutMs: 5000,
    fetch: (url, init) => app.handle(new Request(url, init)),
    out: (s) => lines.push(s),
    err: (s) => errs.push(s),
    ...opts,
  });
  return { app, appDir, run, lines, errs };
}

function quiet() {
  const { error, warn } = console;
  console.error = () => {}; console.warn = () => {};
  return () => { console.error = error; console.warn = warn; };
}

test('a healthy app settles and exits 0, listing each requested path', async () => {
  const { run, lines } = await harness();
  const code = await run({ paths: ['/'] });
  assert.equal(code, 0, lines.join('\n'));
  assert.match(lines[0], /ok \(settled, ready: ok/);
  assert.ok(lines.some((l) => /GET \/  200/.test(l)));
});

test('a broken page is reported with its file and exits 1, in human and JSON form', async () => {
  const restore = quiet();
  try {
    const { run, lines } = await harness();
    const code = await run({ paths: ['/boom'] });
    assert.equal(code, 1);
    const out = lines.join('\n');
    assert.match(out, /GET \/boom  500/);
    assert.match(out, /\[render\] .*page exploded/);
    assert.match(out, /boom[\\/]page\.ts:\d+/);

    lines.length = 0;
    const jsonCode = await run({ paths: ['/boom'], json: true });
    assert.equal(jsonCode, 1);
    const report = JSON.parse(lines.join('\n'));
    assert.equal(report.ok, false);
    assert.equal(report.settled, true);
    assert.deepEqual(report.paths, [{ path: '/boom', status: 500 }]);
    assert.equal(report.errors[0].kind, 'render');
    assert.equal(report.errors[0].url, '/boom');
  } finally { restore(); }
});

test('no dev server on the port exits 2 after retrying until the timeout', async () => {
  let t = 0;
  let calls = 0;
  const errs = [];
  const code = await runStatus({
    port: 3999, graceMs: 0, timeoutMs: 1000,
    now: () => t,
    sleep: async (ms) => { t += ms; },
    fetch: async () => { calls++; throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }); },
    out: () => {}, err: (s) => errs.push(s),
  });
  assert.equal(code, NO_SERVER_EXIT_CODE);
  assert.ok(calls > 1, 'a refused connection is retried, since a Node dev server restarts on an edit');
  assert.match(errs[0], /No dev server answered on http:\/\/localhost:3999/);
});

test('a production server answers 404 for the status endpoint, which is reported, not mistaken for healthy', async () => {
  const { run, errs } = await harness(false);
  const code = await run();
  assert.equal(code, 1);
  assert.match(errs[0], /not a webjs dev server/);
});

test('a base path prefixes the status endpoint and every requested path', async () => {
  const seen = [];
  const code = await runStatus({
    port: 3999, graceMs: 0, timeoutMs: 1000, basePath: '/docs', paths: ['/intro'],
    fetch: async (url) => {
      seen.push(String(url));
      if (String(url).includes('/__webjs/dev/status')) {
        return Response.json({ status: 'ok', settled: true, ready: 'ok', boot: null, seq: null, rebuilds: 0, errors: [] });
      }
      return new Response('ok');
    },
    out: () => {}, err: () => {},
  });
  assert.equal(code, 0);
  assert.ok(seen[0].startsWith('http://localhost:3999/docs/__webjs/dev/status?wait='));
  assert.equal(seen[1], 'http://localhost:3999/docs/intro');
});

// #1664 review: a bare run must still render something (a Node dev server
// restarts on an edit and starts with no errors), and a page whose render
// error was recorded is re-requested, so a fix clears it instead of the stale
// error failing the run.
test('with no paths it checks the root, and re-requests every page with a recorded render error', async () => {
  const restore = quiet();
  try {
    const { app, appDir, run, lines } = await harness();
    await app.handle(new Request('http://x/boom'));

    let code = await run();
    assert.equal(code, 1);
    let out = lines.join('\n');
    assert.match(out, /GET \/  200/, 'the root is checked by default');
    assert.match(out, /GET \/boom  500/, 'the broken page is re-requested');

    writeFileSync(join(appDir, 'app/boom/page.ts'), `import { html } from ${CORE};\nexport default () => html\`<p>fixed</p>\`;\n`);
    await app.rebuild();
    lines.length = 0;
    code = await run();
    out = lines.join('\n');
    assert.equal(code, 0, out);
    assert.match(out, /GET \/boom  200/, 'the fixed page is re-rendered, which clears its error');
    assert.doesNotMatch(out, /error since/);
  } finally { restore(); }
});

// #1664 second review: a page re-requested only because of an old render error
// may have been deleted since, so a 404 there is not a failure.
test('a re-requested page that now answers 404 does not fail the run', async () => {
  const restore = quiet();
  try {
    const { app, appDir, run, lines } = await harness();
    await app.handle(new Request('http://x/boom'));
    rmSync(join(appDir, 'app/boom'), { recursive: true, force: true });
    await app.rebuild();
    const code = await run();
    const out = lines.join('\n');
    assert.equal(code, 0, out);
    assert.match(out, /GET \/boom  404/, 'the old page was re-requested and is gone');
  } finally { restore(); }
});
