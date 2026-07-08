// Tests for the FRAMEWORK's cleanup-merged-worktree PostToolUse hook
// (.claude/hooks/cleanup-merged-worktree.sh). After a `gh pr merge`, it sweeps
// the repo's git worktrees and removes the ones whose branch is MERGED (an
// ancestor of the base ref, or a merged GitHub PR) AND whose tree is clean,
// while KEEPING anything dirty, unmerged, the current directory, or the primary
// checkout. It never blocks the tool (always exits 0).
//
// Each case builds a throwaway repo with real worktrees, feeds the hook a
// PostToolUse payload, and asserts which worktrees survive. Merges are made with
// real `git merge` so the ancestor-of-base signal fires WITHOUT needing gh (a
// no-remote temp repo makes `gh pr list` a harmless no-op).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../.claude/hooks/cleanup-merged-worktree.sh',
);

/** Init a throwaway repo (primary on `main`) with one baseline commit. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-wtcleanup-'));
  const main = join(dir, 'main');
  const git = (...args) => execFileSync('git', args, { cwd: main, stdio: 'pipe' });
  execFileSync('git', ['init', '-q', '-b', 'main', main], { stdio: 'pipe' });
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  git('commit', '-q', '--allow-empty', '-m', 'init');
  return { dir, main, git };
}

/** Add a worktree on a new branch with one commit; optionally merge it into main. */
function addWorktree({ git, dir, main }, name, { merged, dirty } = {}) {
  const path = join(dir, name);
  git('branch', name);
  git('worktree', 'add', '-q', path, name);
  execFileSync('git', ['commit', '-q', '--allow-empty', '-m', 'work'], { cwd: path, stdio: 'pipe' });
  if (merged) git('merge', '-q', '--no-ff', name, '-m', `merge ${name}`);
  if (dirty) writeFileSync(join(path, 'scratch.txt'), 'uncommitted\n');
  return path;
}

/** Run the hook with a given command, from a given cwd. Returns {code, out}. */
function runHook(command, cwd) {
  const r = spawnSync('bash', [HOOK], {
    cwd,
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
    // Force the no-remote temp repo to make gh a harmless no-op regardless of host auth.
    env: { ...process.env, GH_NO_UPDATE_NOTIFIER: '1' },
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

test('removes a merged + clean worktree, keeps dirty and unmerged ones', () => {
  const repo = makeRepo();
  const clean = addWorktree(repo, 'feat-merged-clean', { merged: true });
  const dirty = addWorktree(repo, 'feat-merged-dirty', { merged: true, dirty: true });
  const unmerged = addWorktree(repo, 'feat-unmerged', {});

  const { code } = runHook('gh pr merge 1 --squash --admin --delete-branch', repo.main);

  assert.equal(code, 0, 'hook never blocks the tool');
  assert.ok(!existsSync(clean), 'merged + clean worktree is removed');
  assert.ok(existsSync(dirty), 'merged but dirty worktree is kept');
  assert.ok(existsSync(unmerged), 'unmerged worktree is kept');
  assert.ok(existsSync(repo.main), 'primary checkout is never removed');
});

test('does nothing on a command that is not `gh pr merge`', () => {
  const repo = makeRepo();
  const clean = addWorktree(repo, 'feat-merged-clean', { merged: true });

  const { code } = runHook('git status', repo.main);

  assert.equal(code, 0);
  assert.ok(existsSync(clean), 'a non-merge command leaves worktrees untouched');
});

test('never removes the worktree the merge was run from (current directory)', () => {
  const repo = makeRepo();
  const clean = addWorktree(repo, 'feat-merged-clean', { merged: true });

  // Run the hook FROM inside the merged worktree.
  const { code } = runHook('gh pr merge 1 --squash', clean);

  assert.equal(code, 0);
  assert.ok(existsSync(clean), 'the current worktree is kept even when merged + clean');
});

test('honours the WEBJS_NO_WORKTREE_CLEANUP escape hatch', () => {
  const repo = makeRepo();
  const clean = addWorktree(repo, 'feat-merged-clean', { merged: true });

  const r = spawnSync('bash', [HOOK], {
    cwd: repo.main,
    input: JSON.stringify({ tool_input: { command: 'gh pr merge 1 --squash' } }),
    encoding: 'utf8',
    env: { ...process.env, WEBJS_NO_WORKTREE_CLEANUP: '1' },
  });

  assert.equal(r.status, 0);
  assert.ok(existsSync(clean), 'the escape hatch disables all cleanup');
});
