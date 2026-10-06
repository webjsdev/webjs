// Package-manager detection for `webjs ui add` (#1494). The bug: only
// `bun.lockb` was recognised and only `cwd` was searched, so every current Bun
// project (text `bun.lock` since Bun 1.2) and every app nested in a workspace
// fell through to npm and got a stray package-lock.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  detectPackageManager,
  managerFromLockfile,
  managerFromUserAgent,
} from '../src/utils/package-manager.js';
import { detectAddCommand } from '../src/commands/add.js';

const NO_AGENT = {};

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'webjs-pm-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, body);
  }
  return root;
}

test('bun.lock (the text lockfile) selects bun add', () => {
  const dir = fixture({ 'package.json': '{}', 'bun.lock': '{}' });
  try {
    assert.equal(detectPackageManager({ cwd: dir, env: NO_AGENT }), 'bun');
    assert.deepEqual(detectAddCommand(dir, NO_AGENT), { exec: 'bun', add: 'add' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('bun.lockb (the old binary lockfile) still selects bun', () => {
  const dir = fixture({ 'package.json': '{}', 'bun.lockb': '' });
  try {
    assert.equal(detectPackageManager({ cwd: dir, env: NO_AGENT }), 'bun');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('pnpm, yarn and npm lockfiles are unchanged', () => {
  for (const [lock, pm, cmd] of [
    ['pnpm-lock.yaml', 'pnpm', { exec: 'pnpm', add: 'add' }],
    ['yarn.lock', 'yarn', { exec: 'yarn', add: 'add' }],
    ['package-lock.json', 'npm', { exec: 'npm', add: 'install' }],
  ]) {
    const dir = fixture({ 'package.json': '{}', [lock]: '' });
    try {
      assert.equal(detectPackageManager({ cwd: dir, env: NO_AGENT }), pm, lock);
      assert.deepEqual(detectAddCommand(dir, NO_AGENT), cmd, lock);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('bun.lock beside a stray package-lock.json still picks bun', () => {
  // The exact mixed state the old detection produced.
  const dir = fixture({ 'package.json': '{}', 'bun.lock': '{}', 'package-lock.json': '{}' });
  try {
    assert.equal(detectPackageManager({ cwd: dir, env: NO_AGENT }), 'bun');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an app nested in a workspace finds the root lockfile', () => {
  const root = fixture({
    'package.json': JSON.stringify({ workspaces: ['apps/*'] }),
    'bun.lock': '{}',
    'apps/web/package.json': '{}',
  });
  try {
    assert.equal(detectPackageManager({ cwd: join(root, 'apps/web'), env: NO_AGENT }), 'bun');
    assert.deepEqual(detectAddCommand(join(root, 'apps/web'), NO_AGENT), { exec: 'bun', add: 'add' });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the walk stops at the workspace root', () => {
  // A lockfile ABOVE the workspace root belongs to some other project.
  const outer = fixture({
    'yarn.lock': '',
    'mono/package.json': JSON.stringify({ workspaces: ['apps/*'] }),
    'mono/apps/web/package.json': '{}',
  });
  try {
    assert.equal(managerFromLockfile(join(outer, 'mono/apps/web')), null);
    const pnpmOuter = fixture({
      'yarn.lock': '',
      'mono/pnpm-workspace.yaml': 'packages: [apps/*]\n',
      'mono/apps/web/package.json': '{}',
    });
    try {
      assert.equal(managerFromLockfile(join(pnpmOuter, 'mono/apps/web')), null);
    } finally { rmSync(pnpmOuter, { recursive: true, force: true }); }
  } finally { rmSync(outer, { recursive: true, force: true }); }
});

test('with no lockfile, the user agent decides', () => {
  const dir = fixture({ 'package.json': '{}' });
  try {
    const env = { npm_config_user_agent: 'bun/1.3.14 npm/? node/v24.3.0 linux x64' };
    assert.equal(detectPackageManager({ cwd: dir, env }), 'bun');
    assert.deepEqual(detectAddCommand(dir, env), { exec: 'bun', add: 'add' });
    assert.equal(
      detectPackageManager({ cwd: dir, env: { npm_config_user_agent: 'pnpm/9.0.0 npm/? node/v24.3.0' } }),
      'pnpm',
    );
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a lockfile outranks the user agent by default, and loses under prefer: agent', () => {
  const dir = fixture({ 'package.json': '{}', 'bun.lock': '{}' });
  try {
    const env = { npm_config_user_agent: 'npm/11.0.0 node/v24.3.0' };
    assert.equal(detectPackageManager({ cwd: dir, env }), 'bun');
    assert.equal(detectPackageManager({ cwd: dir, env, prefer: 'agent' }), 'npm');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('nothing detected falls back to npm', () => {
  assert.equal(detectPackageManager({ cwd: null, env: NO_AGENT }), 'npm');
  assert.equal(managerFromUserAgent(''), null);
  assert.equal(managerFromUserAgent('deno/2.0'), null);
});
