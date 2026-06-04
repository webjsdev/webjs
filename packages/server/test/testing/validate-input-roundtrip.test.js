/**
 * #245 acceptance through the REAL `/__webjs/action/<hash>/<fn>` endpoint.
 *
 * The `actions/validate-input.test.js` suite drives `invokeAction` directly;
 * this one rounds the SAME contract through `createRequestHandler().handle()`
 * via the `invokeActionForTest` helper (#267), so the structured field-error
 * result is proven to survive the genuine RPC transport (serializer + CSRF +
 * the response funnel) back to the client as a real object it can read.
 *
 * tmpdir app fixtures, like action-roundtrip-regression.test.js.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../src/dev.js';
import { invokeActionForTest } from '../../src/testing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_URL = JSON.stringify(pathToFileURL(resolve(__dirname, '../../../core/src/html.js')).toString());
// The action imports the attacher from the core SOURCE entry (not the bare
// specifier, whose prebuilt dist bundle can be stale in this no-build repo).
const CORE_URL = JSON.stringify(pathToFileURL(resolve(__dirname, '../../../core/index.js')).toString());

let tmpRoot;
before(() => { tmpRoot = mkdtempSync(join(tmpdir(), 'webjs-validate-rt-')); });
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

const ACTION_REL = 'modules/m/create-post.server.js';

function validatingApp() {
  return makeApp({
    'app/page.js':
      `import { html } from ${HTML_URL};\n` +
      `import { createPost } from '../${ACTION_REL}';\n` +
      `export default () => html\`<p>\${createPost}</p>\`;\n`,
    [ACTION_REL]:
      `'use server';\n` +
      `import { validateInput } from ${CORE_URL};\n` +
      `globalThis.__webjs_createpost_ran = false;\n` +
      `export const createPost = validateInput(\n` +
      `  async (input) => { globalThis.__webjs_createpost_ran = true; return { success: true, data: { id: 1, title: input.title } }; },\n` +
      `  (input) => (input && input.title && input.title.trim())\n` +
      `    ? { success: true, data: { title: input.title.trim() } }\n` +
      `    : { success: false, fieldErrors: { title: 'Title is required' } },\n` +
      `);\n`,
  });
}

test('RPC endpoint: a failing validator round-trips fieldErrors and the body never runs', async () => {
  const appDir = validatingApp();
  const app = await createRequestHandler({ appDir, dev: true });
  globalThis.__webjs_createpost_ran = false;

  // Through the REAL endpoint: an invalid input. The validation failure is a
  // normal RPC result (the stub does not throw), so invokeActionForTest returns
  // the parsed envelope object directly.
  const out = await invokeActionForTest(app, ACTION_REL, 'createPost', [{ title: '   ' }]);
  assert.equal(out.success, false, 'a structured failure envelope crossed the wire');
  assert.deepEqual(out.fieldErrors, { title: 'Title is required' });
  assert.equal(out.status, 422);
  assert.equal(globalThis.__webjs_createpost_ran, false, 'the action body did not run');

  delete globalThis.__webjs_createpost_ran;
});

test('RPC endpoint: a valid input passes; the validator-substituted data reaches the action', async () => {
  const appDir = validatingApp();
  const app = await createRequestHandler({ appDir, dev: true });
  globalThis.__webjs_createpost_ran = false;

  const out = await invokeActionForTest(app, ACTION_REL, 'createPost', [{ title: '  Hello  ' }]);
  assert.equal(out.success, true);
  assert.equal(out.data.title, 'Hello', 'the action received the trimmed, validator-substituted data');
  assert.equal(globalThis.__webjs_createpost_ran, true, 'the body ran on a valid input');

  delete globalThis.__webjs_createpost_ran;
});
