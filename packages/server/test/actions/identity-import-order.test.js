/**
 * A test that statically imports a `'use server'` module (to call an action
 * directly) and only then creates the request handler still renders a page
 * binding that action to a form.
 *
 * Static imports load before any code runs, so the module is loaded before
 * `createRequestHandler` installs the identity load hook and sits unwrapped in
 * the module cache. The page imports the same instance, the hook never saw
 * the function, and the render threw "not a server action" for a function that
 * is one. An agent building an app on the scaffold hit exactly this and had to
 * move its import below the handler. In dev the resolver now finds it by
 * scanning the action index, once per function.
 *
 * The hook is process-global, so each case runs in its own child process.
 * Counterfactual: make `scanForIdentity` in `src/form-action-identity.js`
 * return null whenever the hook is installed (the old gate) and the dev case
 * fails with the render error.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = (p) => JSON.stringify(pathToFileURL(resolve(__dirname, p)).toString());
const CORE = url('../../../core/index.js');
const DEV = url('../../src/dev.js');
const TESTING = url('../../src/testing.js');

async function makeApp(dev) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-identity-order-'));
  await mkdir(join(dir, 'app/join'), { recursive: true });
  await mkdir(join(dir, 'modules/list'), { recursive: true });
  await writeFile(join(dir, 'modules/list/join.server.ts'),
    `'use server';
export async function join(formData) {
  return { success: true, redirect: '/joined/' + String(formData.get('email') || '') };
}
`);
  await writeFile(join(dir, 'app/join/page.ts'),
    `import { html } from ${CORE};
import { join } from '../../modules/list/join.server.ts';
export default () => html\`<form action=\${join}><input name="email"></form>\`;
`);
  // The shape the agent wrote: the action module first, the handler after.
  await writeFile(join(dir, 'driver.mjs'),
    `import { join } from './modules/list/join.server.ts';
import { createRequestHandler } from ${DEV};
import { submitForm, testRequest } from ${TESTING};
const direct = await join(new FormData());
const app = await createRequestHandler({ appDir: ${JSON.stringify(dir)}, dev: ${dev} });
const page = await testRequest(app.handle, '/join');
const html = await page.text();
let submitted = null;
if (page.status === 200) {
  const res = await submitForm(app.handle, '/join', { email: 'ada@example.com' });
  submitted = { status: res.status, location: res.headers.get('location') };
}
process.stdout.write(JSON.stringify({ direct: direct.success, status: page.status, bound: html.includes('__webjs_action'), submitted }));
process.exit(0);
`);
  return dir;
}

function run(dir) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [join(dir, 'driver.mjs')], { cwd: dir, env, encoding: 'utf8' });
  const line = r.stdout.trim().split('\n').pop();
  try {
    return { ...JSON.parse(line), stderr: r.stderr };
  } catch {
    throw new Error(`driver failed (exit ${r.status}):\n${r.stdout}\n${r.stderr}`);
  }
}

test('dev: an action module imported before the handler still binds to a form', { timeout: 60_000 }, async () => {
  const dir = await makeApp(true);
  try {
    const out = run(dir);
    assert.equal(out.direct, true, 'the direct call works');
    assert.equal(out.status, 200, `the page renders\n${out.stderr}`);
    assert.equal(out.bound, true, 'the form carries its action identity');
    assert.deepEqual(out.submitted, { status: 303, location: '/joined/ada@example.com' });
    assert.match(out.stderr, /imported before createRequestHandler\(\)/, 'the cause is named once');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('production keeps the fast refusal: no action index scan on a miss', { timeout: 60_000 }, async () => {
  const dir = await makeApp(false);
  try {
    const out = run(dir);
    assert.notEqual(out.status, 200, 'an unregistered function is still refused in production');
    assert.doesNotMatch(out.stderr, /imported before createRequestHandler/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
