/**
 * Unit tests for the SSR action-seeding switch resolution (#472): the
 * `WEBJS_SEED` environment override takes precedence over the `package.json`
 * `{ "webjs": { "seed": false } }` key, which overrides the default-on
 * behaviour. Mirrors the elision switch (`elide-switch.test.js`).
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readSeedEnabled } from '../../src/dev.js';

const tmps = [];
async function appDirWith(pkg) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-seedsw-'));
  tmps.push(dir);
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg), 'utf8');
  return dir;
}

const ORIG = process.env.WEBJS_SEED;
function setEnv(v) {
  if (v === undefined) delete process.env.WEBJS_SEED;
  else process.env.WEBJS_SEED = v;
}

afterEach(async () => {
  setEnv(ORIG);
  while (tmps.length) await rm(tmps.pop(), { recursive: true, force: true });
});

test('no env, no switch: seeding defaults ON', async () => {
  setEnv(undefined);
  assert.equal(await readSeedEnabled(await appDirWith({ name: 'x' })), true);
});

test('no env, package.json seed:false: OFF', async () => {
  setEnv(undefined);
  assert.equal(await readSeedEnabled(await appDirWith({ name: 'x', webjs: { seed: false } })), false);
});

test('WEBJS_SEED=0 forces OFF even when package.json leaves it default ON', async () => {
  for (const v of ['0', 'false', 'off', 'no', 'FALSE', ' Off ']) {
    setEnv(v);
    assert.equal(await readSeedEnabled(await appDirWith({ name: 'x' })), false, `value ${JSON.stringify(v)}`);
  }
});

test('WEBJS_SEED=1 forces ON even when package.json says seed:false (env wins)', async () => {
  for (const v of ['1', 'true', 'on', 'yes']) {
    setEnv(v);
    assert.equal(await readSeedEnabled(await appDirWith({ name: 'x', webjs: { seed: false } })), true, `value ${JSON.stringify(v)}`);
  }
});

test('a non-false seed value keeps seeding ON (opt-out only)', async () => {
  setEnv(undefined);
  assert.equal(await readSeedEnabled(await appDirWith({ name: 'x', webjs: { seed: true } })), true);
  assert.equal(await readSeedEnabled(await appDirWith({ name: 'x', webjs: {} })), true);
});
