/**
 * The findings of the owner's fifth review of PR #1687 that live in the form
 * path, each pinned through `createRequestHandler` against a tmpdir app.
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
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-review-r5-')); });
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

test('schema issues for fields named like Object members, and symbol paths, become field errors', async () => {
  const appDir = makeApp({
    'modules/x/actions/save.server.ts': `'use server';
export function validate() {
  const e = new Error('invalid');
  e.issues = [
    { path: ['constructor'], message: 'CTOR_MSG' },
    { path: ['toString'], message: 'TOSTRING_MSG' },
    { path: ['__proto__'], message: 'PROTO_MSG' },
    { path: [Symbol('meta'), { key: 'x' }], message: 'SYMBOL_MSG' },
  ];
  throw e;
}
export async function save() { return { success: true }; }
`,
    'app/s/page.ts': `
import { html } from ${CORE};
import { save } from '../../modules/x/actions/save.server.ts';
const own = (o, k) => (o && Object.hasOwn(o, k) ? o[k] : '');
export default ({ actionData }) => {
  const f = actionData?.fieldErrors;
  return html\`<p id="c">\${own(f, 'constructor')}</p><p id="t">\${own(f, 'toString')}</p><p id="p">\${own(f, '__proto__')}</p><p id="m">\${own(f, 'meta.x')}</p><p id="proto">\${f ? String(Object.getPrototypeOf(f) === Object.prototype) : ''}</p><form action=\${save}></form>\`;
};
`,
  });
  const app = await createRequestHandler({ appDir, dev: true, logger: quiet, onError: () => {} });
  const id = identityOf(await (await app.handle(new Request('http://x/s'))).text());
  const res = await app.handle(post('/s', { __webjs_action: id }));
  assert.equal(res.status, 422, 'invalid input, not a 500');
  const body = await res.text();
  assert.match(body, /<p id="c">CTOR_MSG<\/p>/, 'a field named constructor keeps its message');
  assert.match(body, /<p id="t">TOSTRING_MSG<\/p>/, 'so does toString');
  assert.match(body, /<p id="p">PROTO_MSG<\/p>/, '__proto__ is a field');
  assert.match(body, /<p id="proto">true<\/p>/, 'and the object keeps its prototype');
  assert.match(body, /<p id="m">SYMBOL_MSG<\/p>/, 'a symbol segment is named by its description');
});
