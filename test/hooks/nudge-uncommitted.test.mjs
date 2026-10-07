// The scaffold's nudge-uncommitted PostToolUse hook. It reminds an agent to
// commit while changes pile up on a feature branch, but stays silent in a
// repository with no commit yet: a first build from the scaffold is one
// logical unit, committed once at the end (the Stop hook asks for it), and a
// mid-build nudge only split it into extra turns and commits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const HOOK = resolve(import.meta.dirname, '../../packages/cli/templates/.claude/hooks/nudge-uncommitted.sh');

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'nudge-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  git('config', 'core.hooksPath', '/dev/null');
  return { dir, git };
}
const run = (dir) => spawnSync('bash', [HOOK], { cwd: dir, input: '{}', encoding: 'utf8' }).stdout;
const files = (dir, n) => { for (let i = 0; i < n; i++) writeFileSync(join(dir, `f${i}.ts`), 'x'); };

test('silent on a first build: no commit yet, many changes on a feature branch', () => {
  const { dir, git } = repo();
  try {
    git('checkout', '-q', '-b', 'feat/app');
    files(dir, 8);
    assert.equal(run(dir), '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('nudges once the branch has history and changes pile up', () => {
  const { dir, git } = repo();
  try {
    writeFileSync(join(dir, 'README.md'), 'x');
    git('add', '-A');
    git('commit', '-qm', 'init');
    git('checkout', '-q', '-b', 'feat/x');
    files(dir, 8);
    assert.match(run(dir), /uncommitted changes on 'feat\/x'/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
