/**
 * `/__webjs/dev/status` behaves identically on Node and Bun (#1664): a clean
 * app settles, a failing render and a failing action are listed with their
 * file, a rebuild clears them, and production has no such endpoint.
 *
 * A plain assert script so it runs under either runtime; the sibling
 * `dev-status.test.mjs` wraps it for `node --test`.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../packages/server/src/dev.js';
import { invokeActionForTest } from '../../packages/server/src/testing.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const CORE = JSON.stringify(pathToFileURL(resolve('packages/core/index.js')).toString());
const SILENT = { info() {}, warn() {}, error() {} };

const dir = mkdtempSync(join(tmpdir(), 'webjs-1664-status-'));
const files = {
  'app/page.js': `import { html } from ${CORE};\nexport default () => html\`<p>home</p>\`;\n`,
  'app/boom/page.js': `export default () => { throw new Error('page exploded'); };\n`,
  'modules/x/fail.server.js': `'use server';\nexport async function failHard() { throw new Error('action exploded'); }\n`,
  'app/act/page.js': `import { html } from ${CORE};\nimport { failHard } from '../../modules/x/fail.server.js';\nexport default () => html\`<p>\${typeof failHard}</p>\`;\n`,
};
for (const [rel, body] of Object.entries(files)) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
}

const { error: origError, warn: origWarn } = console;
console.error = () => {}; console.warn = () => {};
try {
  const app = await createRequestHandler({ appDir: dir, dev: true, logger: SILENT });
  await app.warmup();
  const status = async (qs = '') => (await app.handle(new Request(`http://x/__webjs/dev/status${qs}`))).json();

  let body = await status('?wait=5');
  assert.equal(body.status, 'ok', `[${runtime}] a clean app is ok`);
  assert.equal(body.settled, true, `[${runtime}] and settled`);

  assert.equal((await app.handle(new Request('http://x/boom'))).status, 500);
  await assert.rejects(invokeActionForTest(app, join(dir, 'modules/x/fail.server.js'), 'failHard', []));
  body = await status();
  assert.equal(body.status, 'error', `[${runtime}] errors are reported`);
  const render = body.errors.find((e) => e.kind === 'render');
  assert.ok(render && /page exploded/.test(render.message) && /boom[\\/]page\.js$/.test(String(render.file)),
    `[${runtime}] the render error carries its message and file`);
  assert.ok(body.errors.some((e) => e.kind === 'action' && /action exploded/.test(e.message)),
    `[${runtime}] an RPC action error is listed`);

  await app.rebuild();
  body = await status('?wait=5');
  assert.deepEqual(body.errors, [], `[${runtime}] a rebuild clears the errors it replaced`);

  const prod = await createRequestHandler({ appDir: dir, dev: false, logger: SILENT });
  assert.equal((await prod.handle(new Request('http://x/__webjs/dev/status'))).status, 404,
    `[${runtime}] production has no dev status endpoint`);
} finally {
  console.error = origError; console.warn = origWarn;
  rmSync(dir, { recursive: true, force: true });
}
console.log(`[dev-status] /__webjs/dev/status OK on ${runtime}`);
