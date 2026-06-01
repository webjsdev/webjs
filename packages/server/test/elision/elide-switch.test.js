/**
 * Unit tests for the elision switch resolution: the `WEBJS_ELIDE`
 * environment override takes precedence over the `package.json`
 * `{ "webjs": { "elide": false } }` key, which in turn overrides the
 * default-on behaviour. The env override is the deploy-time / ops escape
 * hatch and the seam the differential elision test
 * (`differential-elision.test.js`) uses to render one app on and off in a
 * single process.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readElideEnabled } from '../../src/dev.js';

const tmps = [];
async function appDirWith(pkg) {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-elide-'));
  tmps.push(dir);
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg), 'utf8');
  return dir;
}

const ORIG = process.env.WEBJS_ELIDE;
function setEnv(v) {
  if (v === undefined) delete process.env.WEBJS_ELIDE;
  else process.env.WEBJS_ELIDE = v;
}

afterEach(async () => {
  setEnv(ORIG);
  while (tmps.length) await rm(tmps.pop(), { recursive: true, force: true });
});

test('no env, no switch: elision defaults ON', async () => {
  setEnv(undefined);
  assert.equal(await readElideEnabled(await appDirWith({ name: 'x' })), true);
});

test('no env, package.json elide:false: OFF', async () => {
  setEnv(undefined);
  assert.equal(await readElideEnabled(await appDirWith({ name: 'x', webjs: { elide: false } })), false);
});

test('WEBJS_ELIDE=0 forces OFF even when package.json leaves it default ON', async () => {
  for (const v of ['0', 'false', 'off', 'no', 'FALSE', ' Off ']) {
    setEnv(v);
    assert.equal(await readElideEnabled(await appDirWith({ name: 'x' })), false, `value ${JSON.stringify(v)}`);
  }
});

test('WEBJS_ELIDE=1 forces ON even when package.json says elide:false (env wins)', async () => {
  // Counterfactual for precedence: without the env override this app would
  // elide OFF (its package.json disables it); the env flips it back ON.
  for (const v of ['1', 'true', 'on', 'yes']) {
    setEnv(v);
    assert.equal(await readElideEnabled(await appDirWith({ name: 'x', webjs: { elide: false } })), true, `value ${JSON.stringify(v)}`);
  }
});

test('an unrecognised WEBJS_ELIDE value is ignored, falling through to package.json', async () => {
  setEnv('maybe');
  assert.equal(await readElideEnabled(await appDirWith({ name: 'x', webjs: { elide: false } })), false, 'falls through to the switch');
  assert.equal(await readElideEnabled(await appDirWith({ name: 'x' })), true, 'falls through to the default');
});
