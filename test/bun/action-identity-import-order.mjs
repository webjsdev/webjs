/**
 * Cross-runtime proof that an action module imported BEFORE the handler
 * installs the `'use server'` load hook still binds to a form in dev. Run from
 * the repo root:
 *
 *   node test/bun/action-identity-import-order.mjs
 *   bun  test/bun/action-identity-import-order.mjs
 *
 * The module sits unwrapped in the module cache, so the identity resolver
 * finds the function by importing each indexed action module and comparing
 * exports. That comparison only works when the scan's import lands on the SAME
 * cached instance the static import produced, and the two runtimes key their
 * module cache differently (Node by file URL, Bun by plain path), so it needs
 * proving on both. The hook is process-global, hence the child process.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runtime = process.versions.bun ? 'bun' : 'node';
const here = dirname(fileURLToPath(import.meta.url));
const url = (p) => JSON.stringify(pathToFileURL(resolve(here, p)).toString());

const dir = mkdtempSync(join(tmpdir(), 'webjs-identity-order-bun-'));
mkdirSync(join(dir, 'app/join'), { recursive: true });
mkdirSync(join(dir, 'modules/list'), { recursive: true });
writeFileSync(join(dir, 'modules/list/join.server.ts'), `'use server';
export async function join(formData) {
  return { success: true, redirect: '/joined/' + String(formData.get('email') || '') };
}
`);
writeFileSync(join(dir, 'app/join/page.ts'), `import { html } from ${url('../../packages/core/index.js')};
import { join } from '../../modules/list/join.server.ts';
export default () => html\`<form action=\${join}><input name="email"></form>\`;
`);
writeFileSync(join(dir, 'driver.mjs'), `import { join } from './modules/list/join.server.ts';
import { createRequestHandler } from ${url('../../packages/server/src/dev.js')};
import { submitForm, testRequest } from ${url('../../packages/server/src/testing.js')};
await join(new FormData());
const app = await createRequestHandler({ appDir: ${JSON.stringify(dir)}, dev: true });
const page = await testRequest(app.handle, '/join');
const html = await page.text();
let submitted = null;
if (page.status === 200) {
  const res = await submitForm(app.handle, '/join', { email: 'ada@example.com' });
  submitted = { status: res.status, location: res.headers.get('location') };
}
process.stdout.write('\\n' + JSON.stringify({ status: page.status, bound: html.includes('__webjs_action'), submitted }));
process.exit(0);
`);

try {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [join(dir, 'driver.mjs')], { cwd: dir, env, encoding: 'utf8' });
  let out;
  try {
    out = JSON.parse(r.stdout.trim().split('\n').pop());
  } catch {
    throw new Error(`[${runtime}] driver failed (exit ${r.status}):\n${r.stdout}\n${r.stderr}`);
  }
  assert.equal(out.status, 200, `[${runtime}] the page renders\n${r.stderr}`);
  assert.equal(out.bound, true, `[${runtime}] the form carries its action identity`);
  assert.deepEqual(out.submitted, { status: 303, location: '/joined/ada@example.com' }, `[${runtime}] the submission runs the action`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`[action-identity-import-order] early-imported action binds on ${runtime}`);
