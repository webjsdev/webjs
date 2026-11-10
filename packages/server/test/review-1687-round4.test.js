/**
 * The server-side findings of the owner's fourth review of PR #1687, each
 * pinned by a test through `createRequestHandler` against a tmpdir app (the
 * attribute-reader one is in packages/core/test).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../src/dev.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// A tmpdir fixture cannot resolve the bare specifiers, so it imports by URL.
const CORE = JSON.stringify(pathToFileURL(resolve(__dirname, '../../core/index.js')).toString());
const quiet = { info() {}, warn() {}, error() {}, debug() {} };

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-review-r4-')); });
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

function makeApp(files) {
  const appDir = mkdtempSync(join(tmpRoot, 'app-'));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(appDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return appDir;
}

const identityOf = (html) => /name="__webjs_action" value="([^"]*)"/.exec(html)?.[1] ?? null;

function post(path, fields, headers = {}) {
  return new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(fields).toString(),
  });
}

/** The `name=value` pairs a response sets, as a request Cookie header. */
const cookieOf = (res) => res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

test('a failed form action on a cached page renders the error, never the cached 200', async () => {
  const seen = [];
  const appDir = makeApp({
    'modules/x/actions/boom.server.ts': `'use server';\nexport async function boom() { throw new Error('ACTION_BOOM'); }\n`,
    'app/c/page.ts': `
import { html } from ${CORE};
import { boom } from '../../modules/x/actions/boom.server.ts';
export const revalidate = 60;
export default () => html\`<form action=\${boom}><button>go</button></form>\`;
`,
  });
  const app = await createRequestHandler({ appDir, dev: true, logger: quiet, onError: (e) => seen.push(e) });
  // Warm the HTML cache: the first GET stores the page, the second is a hit.
  const html = await (await app.handle(new Request('http://x/c'))).text();
  await app.handle(new Request('http://x/c'));
  const quietErr = console.error;
  console.error = () => {};
  let res;
  try { res = await app.handle(post('/c', { __webjs_action: identityOf(html) })); } finally { console.error = quietErr; }
  assert.equal(res.status, 500, 'the throw answers with the error page, not the cached page');
  assert.ok(seen.some((e) => e instanceof Error && e.message === 'ACTION_BOOM'), 'and onError hears it');
});
