// Tests for the PreToolUse branch-context guard
// (.claude/hooks/guard-branch-context.sh). The hook fires before Edit/Write
// and asks the user to create a feature branch when the working directory is
// on main/master, allows freely on any other branch, and allows everything in
// bypass mode. It reads the current branch from the cwd's git repo and the
// bypass flag from $HOME/.claude/settings.json, so the tests drive it in a
// throwaway git repo with a controlled HOME.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const HOOK = resolve(here, '../../.claude/hooks/guard-branch-context.sh');

/** Init a throwaway git repo on `branch` with one commit; return its path. */
function makeRepo(branch) {
  const dir = mkdtempSync(join(tmpdir(), 'guard-branch-'));
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  spawnSync('git', ['init', '-b', branch], { cwd: dir, encoding: 'utf8' });
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 'T');
  writeFileSync(join(dir, 'f.txt'), 'x');
  git('add', '.');
  git('commit', '-m', 'init');
  return dir;
}

/** A HOME dir whose settings.json sets (or omits) the bypass flag. */
function makeHome(bypass) {
  const home = mkdtempSync(join(tmpdir(), 'guard-home-'));
  if (bypass !== undefined) {
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(
      join(home, '.claude', 'settings.json'),
      JSON.stringify({ skipDangerousModePermissionPrompt: bypass }),
    );
  }
  return home;
}

/** Run the hook in `cwd` with `home`; return { code, out }. */
function run(cwd, home) {
  const r = spawnSync('bash', [HOOK], {
    cwd,
    input: JSON.stringify({ tool_name: 'Edit', tool_input: {} }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  });
  return { code: r.status, out: r.stdout.trim() };
}

test('asks to branch when on main', () => {
  const repo = makeRepo('main');
  const home = makeHome(undefined);
  const { code, out } = run(repo, home);
  assert.equal(code, 0);
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'ask');
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /feature branch/i);
  rmSync(repo, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

test('asks to branch when on master', () => {
  const repo = makeRepo('master');
  const home = makeHome(undefined);
  const { code, out } = run(repo, home);
  assert.equal(code, 0);
  assert.equal(JSON.parse(out).hookSpecificOutput.permissionDecision, 'ask');
  rmSync(repo, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

test('allows freely on a feature branch', () => {
  const repo = makeRepo('feat/thing');
  const home = makeHome(undefined);
  const { code, out } = run(repo, home);
  assert.equal(code, 0);
  assert.equal(out, '', 'no ask output on a feature branch');
  rmSync(repo, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

test('allows everything in bypass mode, even on main', () => {
  const repo = makeRepo('main');
  const home = makeHome(true);
  const { code, out } = run(repo, home);
  assert.equal(code, 0);
  assert.equal(out, '', 'bypass mode suppresses the ask');
  rmSync(repo, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

test('allows outside a git repo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'guard-nogit-'));
  const home = makeHome(undefined);
  const { code, out } = run(dir, home);
  assert.equal(code, 0);
  assert.equal(out, '', 'no ask when not in a git work tree');
  rmSync(dir, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});
