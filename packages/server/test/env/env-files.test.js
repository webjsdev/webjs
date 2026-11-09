/**
 * Env files load in Next.js's order: the real environment, then
 * .env.$mode.local, .env.local (not in test), .env.$mode, .env. A key is only
 * assigned while unset, and the server's handler loads them for its mode.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { envFileOrder, loadEnvFiles, envMode } from '../../src/env-files.js';
import { createRequestHandler } from '../../src/dev.js';

function app(files) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-env-files-'));
  for (const [k, v] of Object.entries(files)) writeFileSync(join(dir, k), v);
  return dir;
}

test('envFileOrder matches Next (.env.local skipped in test)', () => {
  assert.deepEqual(envFileOrder('development'), ['.env.development.local', '.env.local', '.env.development', '.env']);
  assert.deepEqual(envFileOrder('production'), ['.env.production.local', '.env.local', '.env.production', '.env']);
  assert.deepEqual(envFileOrder('test'), ['.env.test.local', '.env.test', '.env']);
});

test('precedence: real env > $mode.local > .local > $mode > .env', () => {
  const dir = app({
    '.env': 'A=env\nB=env\nC=env\nD=env\nE=env\n',
    '.env.development': 'A=mode\nB=mode\nC=mode\nD=mode\n',
    '.env.local': 'A=local\nB=local\nC=local\n',
    '.env.development.local': 'A=modelocal\nB=modelocal\n',
    '.env.production': 'A=prod\n',
  });
  try {
    const env = { A: 'shell' };
    const loaded = loadEnvFiles(dir, 'development', env);
    assert.deepEqual(env, { A: 'shell', B: 'modelocal', C: 'local', D: 'mode', E: 'env' });
    assert.deepEqual(loaded, ['.env.development.local', '.env.local', '.env.development', '.env']);
    const prod = {};
    loadEnvFiles(dir, 'production', prod);
    assert.equal(prod.A, 'local', '.env.local still beats .env.production');
    const t = {};
    loadEnvFiles(dir, 'test', t);
    assert.equal(t.A, 'env', '.env.local is not read in test');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('values expand $NAME / ${NAME} as @next/env does', () => {
  const dir = app({
    '.env': [
      'HOST=db.local',
      'URL=postgres://$USER@${HOST}/app',
      'PORT_URL=${HOST}:${PORT:-5432}',
      'UNSET_DASH=${NOPE-fallback}',
      'EMPTY=',
      'EMPTY_COLON=${EMPTY:-used}',
      'EMPTY_DASH=${EMPTY-unused}',
      'PRICE=\\$5',
      "RAW='$HOST stays'",
      'FROM_LOCAL=${LOCAL_ONLY}',
      'LOOP=$LOOP',
      '',
    ].join('\n'),
    '.env.local': 'LOCAL_ONLY=from-local\nHOST=local-wins\n',
  });
  try {
    const env = { USER: 'ada' };
    loadEnvFiles(dir, 'development', env);
    assert.equal(env.HOST, 'local-wins', 'a higher-precedence file still wins');
    assert.equal(env.URL, 'postgres://ada@local-wins/app', 'the real env and already-loaded files resolve first');
    assert.equal(env.PORT_URL, 'local-wins:5432', ':- supplies a default for an unset key');
    assert.equal(env.UNSET_DASH, 'fallback', '- supplies a default for an unset key');
    assert.equal(env.EMPTY_COLON, 'used', ':- also covers an empty value');
    assert.equal(env.EMPTY_DASH, '', '- does not cover an empty value');
    assert.equal(env.PRICE, '$5', 'an escaped dollar is literal');
    assert.equal(env.RAW, '$HOST stays', 'a single-quoted value is not expanded');
    assert.equal(env.FROM_LOCAL, 'from-local');
    assert.equal(env.LOOP, '', 'a self reference expands to empty instead of looping');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('quoted values, comments, and a missing directory are handled', () => {
  const dir = app({ '.env': '# comment\nQ="a b"\nS=\'x\'\n' });
  try {
    const env = {};
    loadEnvFiles(dir, 'development', env);
    assert.deepEqual(env, { Q: 'a b', S: 'x' });
    assert.deepEqual(loadEnvFiles(join(dir, 'nope'), 'development', {}), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('envMode: test wins, else dev / production', () => {
  const saved = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'test';
    assert.equal(envMode(true), 'test');
    delete process.env.NODE_ENV;
    assert.equal(envMode(true), 'development');
    assert.equal(envMode(false), 'production');
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved;
  }
});

test('createRequestHandler loads .env.local and .env.production for a production handler', async () => {
  const dir = app({ '.env.local': 'WJ_ENV_LOCAL_PROBE=local\n', '.env.production': 'WJ_ENV_PROD_PROBE=prod\n', 'package.json': '{"name":"e"}' });
  mkdirSync(join(dir, 'app'));
  writeFileSync(join(dir, 'app', 'page.js'), `export default () => process.env.WJ_ENV_LOCAL_PROBE + ':' + process.env.WJ_ENV_PROD_PROBE;\n`);
  const saved = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  try {
    const h = await createRequestHandler({ appDir: dir, dev: false, logger: { info() {}, warn() {}, error() {} } });
    assert.match(await (await h.handle(new Request('http://x/'))).text(), /local:prod/);
  } finally {
    if (saved === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved;
    delete process.env.WJ_ENV_LOCAL_PROBE;
    delete process.env.WJ_ENV_PROD_PROBE;
    rmSync(dir, { recursive: true, force: true });
  }
});
