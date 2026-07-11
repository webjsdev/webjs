// Tests for the PreToolUse merge guard (.claude/hooks/guard-main-merge.sh).
// The hook reads a Bash command from stdin and asks before a `git merge` or a
// `git push` that targets main, allows a feature-branch push, and allows
// everything in bypass mode. The bypass flag comes from
// $HOME/.claude/settings.json, so the tests control HOME.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const HOOK = resolve(here, '../../.claude/hooks/guard-main-merge.sh');

/** A HOME dir whose settings.json sets (or omits) the bypass flag. */
function makeHome(bypass) {
  const home = mkdtempSync(join(tmpdir(), 'merge-home-'));
  if (bypass !== undefined) {
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(
      join(home, '.claude', 'settings.json'),
      JSON.stringify({ skipDangerousModePermissionPrompt: bypass }),
    );
  }
  return home;
}

/** Run the hook with a command; return { code, out }. */
function run(command, home) {
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  });
  return { code: r.status, out: r.stdout.trim() };
}

function decision(out) {
  return out ? JSON.parse(out).hookSpecificOutput?.permissionDecision : '';
}

test('asks on git merge', () => {
  const home = makeHome(undefined);
  assert.equal(decision(run('git merge origin/main', home).out), 'ask');
  rmSync(home, { recursive: true, force: true });
});

test('asks on a git push targeting main', () => {
  const home = makeHome(undefined);
  assert.equal(decision(run('git push origin main', home).out), 'ask');
  rmSync(home, { recursive: true, force: true });
});

test('allows a feature-branch push', () => {
  const home = makeHome(undefined);
  const { code, out } = run('git push -u origin feat/thing', home);
  assert.equal(code, 0);
  assert.equal(out, '', 'no ask on a feature-branch push');
  rmSync(home, { recursive: true, force: true });
});

test('allows a push to a branch that merely contains "main"', () => {
  const home = makeHome(undefined);
  for (const cmd of ['git push origin main-thing', 'git push origin maintenance']) {
    assert.equal(run(cmd, home).out, '', `no ask for: ${cmd}`);
  }
  rmSync(home, { recursive: true, force: true });
});

test('asks on a git push targeting master', () => {
  const home = makeHome(undefined);
  assert.equal(decision(run('git push origin master', home).out), 'ask');
  rmSync(home, { recursive: true, force: true });
});

test('allows an unrelated command', () => {
  const home = makeHome(undefined);
  const { code, out } = run('git status', home);
  assert.equal(code, 0);
  assert.equal(out, '');
  rmSync(home, { recursive: true, force: true });
});

test('allows git merge in bypass mode', () => {
  const home = makeHome(true);
  const { code, out } = run('git merge origin/main', home);
  assert.equal(code, 0);
  assert.equal(out, '', 'bypass mode suppresses the ask');
  rmSync(home, { recursive: true, force: true });
});
