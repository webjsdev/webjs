// `webjs create`'s package-manager detection (#1494). The CLI and the UI kit
// each ship a copy of the same module (so a cli release cannot break at
// import time against an older @webjsdev/ui), and this test is what keeps the
// two from drifting: every fixture must resolve identically through both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import * as cli from '../../lib/package-manager.js';
import * as ui from '../../../ui/src/utils/package-manager.js';

const here = dirname(fileURLToPath(import.meta.url));

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'webjs-cli-pm-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  }
  return root;
}

const CASES = [
  { name: 'bun.lock', files: { 'bun.lock': '{}' }, at: '.' },
  { name: 'bun.lockb', files: { 'bun.lockb': '' }, at: '.' },
  { name: 'pnpm', files: { 'pnpm-lock.yaml': '' }, at: '.' },
  { name: 'yarn', files: { 'yarn.lock': '' }, at: '.' },
  { name: 'npm', files: { 'package-lock.json': '{}' }, at: '.' },
  {
    name: 'nested workspace member',
    files: { 'package.json': '{"workspaces":["apps/*"]}', 'bun.lock': '{}', 'apps/web/package.json': '{}' },
    at: 'apps/web',
  },
  {
    name: 'walk stops at the workspace root',
    files: { 'yarn.lock': '', 'mono/package.json': '{"workspaces":["a/*"]}', 'mono/a/b/package.json': '{}' },
    at: 'mono/a/b',
  },
  { name: 'empty dir', files: { 'package.json': '{}' }, at: '.' },
];
const ENVS = [
  {},
  { npm_config_user_agent: 'bun/1.3.14 npm/? node/v24.3.0 linux x64' },
  { npm_config_user_agent: 'npm/11.0.0 node/v24.3.0' },
  { npm_config_user_agent: 'pnpm/9.0.0 npm/? node/v24.3.0' },
];

test('the cli and ui copies agree on every fixture, both preferences', () => {
  for (const c of CASES) {
    const root = fixture(c.files);
    try {
      const cwd = join(root, c.at);
      for (const env of ENVS) {
        for (const prefer of ['lockfile', 'agent']) {
          assert.equal(
            cli.detectPackageManager({ cwd, env, prefer }),
            ui.detectPackageManager({ cwd, env, prefer }),
            `${c.name} / ${env.npm_config_user_agent || 'no agent'} / ${prefer}`,
          );
        }
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('create prefers the invoking tool, then the enclosing lockfile', () => {
  const root = fixture({ 'package.json': '{"workspaces":["apps/*"]}', 'bun.lock': '{}' });
  try {
    // A global `webjs create` (no user agent) inside a bun workspace installs with bun.
    assert.equal(cli.detectPackageManager({ cwd: join(root, 'apps'), env: {}, prefer: 'agent' }), 'bun');
    // An explicit invoker wins over the lockfile.
    assert.equal(
      cli.detectPackageManager({ cwd: root, env: { npm_config_user_agent: 'pnpm/9.0.0' }, prefer: 'agent' }),
      'pnpm',
    );
    // The runtime check passes cwd: null, so only the invoker counts there.
    assert.equal(cli.detectPackageManager({ cwd: null, env: {}, prefer: 'agent' }), 'npm');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the two copies differ only in their header comment', () => {
  const strip = (p) => readFileSync(p, 'utf8').replace(/^\/\*\*[\s\S]*?\*\/\n/, '');
  assert.equal(
    strip(join(here, '../../lib/package-manager.js')),
    strip(join(here, '../../../ui/src/utils/package-manager.js')),
  );
});
