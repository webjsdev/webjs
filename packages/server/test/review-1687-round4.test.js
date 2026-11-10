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

test('an action result is shown only on the page its redirect lands on, and a frame load leaves it', async () => {
  const appDir = makeApp({
    'modules/x/actions/save.server.ts': `'use server';\nexport async function save() { return { success: true, message: 'SAVED_MSG' }; }\n`,
    'app/a/page.ts': `
import { html } from ${CORE};
import { save } from '../../modules/x/actions/save.server.ts';
export default ({ actionData }) => html\`<p>\${actionData?.message ?? 'none'}</p><form action=\${save}><button>go</button></form>\`;
`,
    'app/other/page.ts': `
import { html } from ${CORE};
export default ({ actionData }) => html\`<p>\${actionData?.message ?? 'none'}</p>\`;
`,
  });
  const app = await createRequestHandler({ appDir, dev: true, logger: quiet });
  const html = await (await app.handle(new Request('http://x/a'))).text();
  const done = await app.handle(post('/a', { __webjs_action: identityOf(html) }));
  assert.equal(done.status, 303);
  const cookie = cookieOf(done);

  const other = await app.handle(new Request('http://x/other', { headers: { cookie } }));
  const otherHtml = await other.text();
  assert.doesNotMatch(otherHtml, /SAVED_MSG/, 'another page never shows it');
  assert.equal(other.headers.getSetCookie().length, 0, 'and leaves it unconsumed');

  const frame = await app.handle(new Request('http://x/a', { headers: { cookie, 'x-webjs-frame': 'f' } }));
  await frame.text();
  assert.equal(frame.headers.getSetCookie().length, 0, 'a frame load of the target leaves it too');

  const target = await app.handle(new Request('http://x/a', { headers: { cookie } }));
  assert.match(await target.text(), /SAVED_MSG/, 'the page the redirect named shows it');
});
