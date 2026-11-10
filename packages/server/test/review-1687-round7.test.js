/**
 * The findings of the owner's seventh review of PR #1687 that live in the
 * form-action flash, each pinned through `createRequestHandler` against a
 * tmpdir app, beside what the previous rounds' fixes protect.
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
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-review-r7-')); });
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

function post(path, fields) {
  return new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
}

/** The cookies a response sets, merged over the ones a request sent. */
function nextCookie(prev, res) {
  const jar = new Map(prev ? prev.split('; ').map((kv) => [kv.split('=')[0], kv]) : []);
  for (const c of res.headers.getSetCookie()) { const kv = c.split(';')[0]; jar.set(kv.split('=')[0], kv); }
  return [...jar.values()].join('; ');
}

/** A page showing its actionData's message, with a form bound to the action. */
const showsMessage = (actionImport) => `
import { html } from ${CORE};
${actionImport}
export default ({ actionData }) => html\`<p id="r">\${actionData?.message ?? 'none'}</p>\${typeof act === 'function' ? html\`<form action=\${act}><button>go</button></form>\` : ''}\`;
`;
const plainPage = `import { html } from ${CORE};\nexport default ({ actionData }) => html\`<p id="r">\${actionData?.message ?? 'none'}</p>\`;\n`;
const messageOf = (html) => /<p id="r">([^<]*)<\/p>/.exec(html)?.[1];

test('under a basePath mount a success with no redirect stays in the app and shows its result', async () => {
  const appDir = makeApp({
    'package.json': JSON.stringify({ name: 'mounted', type: 'module', webjs: { basePath: '/app' } }),
    'modules/x/actions/act.server.ts': `'use server';\nexport async function act() { return { success: true, message: 'SAVED_MSG' }; }\n`,
    // The review's case: a page whose app-relative path itself starts with the mount.
    'app/app/settings/page.ts': showsMessage(`import { act } from '../../../modules/x/actions/act.server.ts';`),
  });
  const app = await createRequestHandler({ appDir, dev: true, logger: quiet });
  const html = await (await app.handle(new Request('http://x/app/app/settings'))).text();
  const done = await app.handle(post('/app/app/settings', { __webjs_action: identityOf(html) }));
  assert.equal(done.status, 303);
  assert.equal(done.headers.get('location'), '/app/app/settings', 'the public path, mount included');
  const landing = await app.handle(new Request('http://x/app/app/settings', { headers: { cookie: nextCookie('', done) } }));
  assert.equal(messageOf(await landing.text()), 'SAVED_MSG', 'the page shows its own result');
});

test('under a basePath mount a redirect written with the mount still shows on its target', async () => {
  // What the previous round's fix protects.
  const appDir = makeApp({
    'package.json': JSON.stringify({ name: 'mounted2', type: 'module', webjs: { basePath: '/app' } }),
    'modules/x/actions/act.server.ts': `'use server';\nexport async function act() { return { success: true, message: 'DONE_MSG', redirect: '/app/done' }; }\n`,
    'app/f/page.ts': showsMessage(`import { act } from '../../modules/x/actions/act.server.ts';`),
    'app/done/page.ts': plainPage,
  });
  const app = await createRequestHandler({ appDir, dev: true, logger: quiet });
  const html = await (await app.handle(new Request('http://x/app/f'))).text();
  const done = await app.handle(post('/app/f', { __webjs_action: identityOf(html) }));
  assert.equal(done.headers.get('location'), '/app/done');
  const landing = await app.handle(new Request('http://x/app/done', { headers: { cookie: nextCookie('', done) } }));
  assert.equal(messageOf(await landing.text()), 'DONE_MSG');
});
