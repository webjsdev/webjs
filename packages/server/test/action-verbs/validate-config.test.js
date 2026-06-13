/**
 * The `export const validate` boundary validator on the RPC path (#245 + #488).
 * `invokeAction` runs the action's `validate` config export on the first arg
 * before the body: a structured `{ success: false, fieldErrors }` is returned as
 * a NORMAL 200 RPC payload (the client reads `result.fieldErrors`); a THROWN
 * validator is a sanitized error response (non-200); a passing validator runs
 * the action; a transform-return replaces the input. (This boundary used to be
 * covered by the removed validate-input.test.js; it now rides `export const
 * validate`, the config-export form that replaced `validateInput()`.)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import { hashFile } from '../../src/actions.js';
import { stringify, parse } from '@webjsdev/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_URL = pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString();

let tmpRoot, appDir, handle;
const hashes = {};
const url = (p) => 'http://localhost' + p;

function write(rel, body) {
  const abs = join(appDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
  return abs;
}

before(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-validate-'));
  appDir = mkdtempSync(join(tmpRoot, 'app-'));
  writeFileSync(join(appDir, 'package.json'), JSON.stringify({ name: 'validate', type: 'module', webjs: {} }));

  // A structured failure: validate returns { success: false, fieldErrors }.
  const structFile = write('actions/save-name.server.js',
    `'use server';\n` +
    `export const validate = (input) => {\n` +
    `  if (!input || !input.name) return { success: false, fieldErrors: { name: 'required' } };\n` +
    `  return { success: true, data: input };\n` +
    `};\n` +
    `export async function saveName(input) { return { saved: input.name }; }\n`);
  // A throwing validator (the classic Schema.parse style).
  const throwFile = write('actions/parse-input.server.js',
    `'use server';\n` +
    `export const validate = (input) => { if (typeof input.n !== 'number') throw new Error('n must be a number'); return input; };\n` +
    `export async function parseInput(input) { return { doubled: input.n * 2 }; }\n`);
  // A transform-return validator: the returned value replaces the input.
  const xformFile = write('actions/coerce.server.js',
    `'use server';\n` +
    `export const validate = (input) => ({ n: Number(input.n) });\n` +
    `export async function coerce(input) { return { isNumber: typeof input.n === 'number', n: input.n }; }\n`);

  write('app/layout.js', `import { html } from ${JSON.stringify(CORE_URL)};\nexport default ({children})=>html\`<!doctype html><html><head></head><body>\${children}</body></html>\`;\n`);
  write('app/page.js', `import { html } from ${JSON.stringify(CORE_URL)};\nexport default ()=>html\`<main>ok</main>\`;\n`);

  const app = await createRequestHandler({ appDir, dev: true });
  if (app.warmup) await app.warmup();
  handle = app.handle;
  hashes.struct = await hashFile(structFile);
  hashes.throw = await hashFile(throwFile);
  hashes.xform = await hashFile(xformFile);
});
after(() => { rmSync(tmpRoot, { recursive: true, force: true }); });

async function csrfHeaders() {
  const res = await handle(new Request(url('/')));
  const m = (res.headers.get('set-cookie') || '').match(/webjs_csrf=([^;]+)/);
  const t = m ? decodeURIComponent(m[1]) : '';
  return { 'content-type': 'application/vnd.webjs+json', 'x-webjs-csrf': t, cookie: `webjs_csrf=${t}` };
}

test('a structured validate failure is a NORMAL 200 RPC payload with fieldErrors', async () => {
  const headers = await csrfHeaders();
  const res = await handle(new Request(url(`/__webjs/action/${hashes.struct}/saveName`), { method: 'POST', body: await stringify([{}]), headers }));
  assert.equal(res.status, 200, 'a structured failure rides a 200 so the client reads result.fieldErrors');
  const result = parse(await res.text());
  assert.equal(result.success, false);
  assert.deepEqual(result.fieldErrors, { name: 'required' });
  assert.equal(result.status, 422, 'the failure status rides inside the envelope');
});

test('a passing validate runs the action', async () => {
  const headers = await csrfHeaders();
  const res = await handle(new Request(url(`/__webjs/action/${hashes.struct}/saveName`), { method: 'POST', body: await stringify([{ name: 'Ada' }]), headers }));
  assert.equal(res.status, 200);
  assert.deepEqual(parse(await res.text()), { saved: 'Ada' });
});

test('a THROWN validator is a sanitized error response (non-200), the action never runs', async () => {
  const headers = await csrfHeaders();
  const res = await handle(new Request(url(`/__webjs/action/${hashes.throw}/parseInput`), { method: 'POST', body: await stringify([{ n: 'oops' }]), headers }));
  assert.equal(res.status, 500, 'a thrown validator surfaces as a sanitized error (the client stub throws)');
  const result = parse(await res.text());
  assert.match(result.error, /n must be a number/);
});

test('a throwing validator that passes lets the action run', async () => {
  const headers = await csrfHeaders();
  const res = await handle(new Request(url(`/__webjs/action/${hashes.throw}/parseInput`), { method: 'POST', body: await stringify([{ n: 21 }]), headers }));
  assert.equal(res.status, 200);
  assert.deepEqual(parse(await res.text()), { doubled: 42 });
});

test('a transform-return validator replaces the input the action receives', async () => {
  const headers = await csrfHeaders();
  const res = await handle(new Request(url(`/__webjs/action/${hashes.xform}/coerce`), { method: 'POST', body: await stringify([{ n: '5' }]), headers }));
  assert.equal(res.status, 200);
  assert.deepEqual(parse(await res.text()), { isNumber: true, n: 5 }, 'the action saw the coerced number, not the string');
});
