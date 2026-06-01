// Regression guard for issue #166 (recurring core.bare=true corruption).
//
// Proves scripts/git-worktree-safe.mjs heals a repo that is in the broken
// bare state, that --check catches the breakage, and that the per-worktree
// override survives a later shared-config core.bare flip (the exact event
// that used to re-break the main checkout).

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', 'scripts', 'git-worktree-safe.mjs',
);

let repo;

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', ...opts }).trim();
}
// Run the heal/check script in the throwaway repo. Returns {code, out}.
function runScript(args = []) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

before(() => {
  repo = mkdtempSync(join(tmpdir(), 'webjs-corebare-'));
  git(['init', '-q']);
  git(['config', 'user.email', 't@t.t']);
  git(['config', 'user.name', 't']);
  writeFileSync(join(repo, 'a.txt'), 'hi\n');
  git(['add', 'a.txt']);
  git(['commit', '-qm', 'init']);
  // A tracked .hooks dir so the script exercises the hooksPath branch.
  mkdirSync(join(repo, '.hooks'));
  writeFileSync(join(repo, '.hooks', 'pre-commit'), '#!/bin/bash\nexit 0\n');
});

after(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

describe('git-worktree-safe (#166)', () => {
  test('--check fails when the shared config is in the broken bare state', () => {
    // Simulate the corruption: shared core.bare=true, no per-worktree override.
    git(['config', '--local', 'core.bare', 'true']);
    assert.notEqual(
      git(['rev-parse', '--is-inside-work-tree'], { stdio: ['ignore', 'pipe', 'ignore'] }, ),
      'true',
      'precondition: the repo should read as bare/broken',
    );
    const { code } = runScript(['--check']);
    assert.equal(code, 1, '--check must exit non-zero on the broken state');
  });

  test('ensure heals the broken state', () => {
    const { code } = runScript();
    assert.equal(code, 0, 'ensure must succeed');
    assert.equal(git(['rev-parse', '--is-inside-work-tree']), 'true',
      'main checkout is a usable work tree again');
    assert.equal(git(['config', 'core.bare']), 'false',
      'core.bare resolves to false');
    assert.equal(git(['config', 'extensions.worktreeConfig']), 'true',
      'per-worktree config is enabled');
    assert.equal(git(['config', 'core.repositoryformatversion']), '1',
      'repositoryformatversion bumped to 1 so the extension is contractually honored');
    const hooks = git(['config', 'core.hooksPath']);
    assert.equal(hooks, join(repo, '.hooks'),
      'core.hooksPath pinned to the absolute .hooks dir');
  });

  test('--check passes after healing', () => {
    assert.equal(runScript(['--check']).code, 0);
  });

  test('the per-worktree override survives a later SHARED core.bare flip', () => {
    // This is the event that used to re-break the checkout every time.
    git(['config', '--local', 'core.bare', 'true']);
    assert.equal(git(['config', 'core.bare']), 'false',
      'main worktree still reads false despite the shared flip');
    assert.equal(git(['rev-parse', '--is-inside-work-tree']), 'true');
    assert.equal(runScript(['--check']).code, 0,
      '--check stays green because the override holds');
  });

  test('ensure is idempotent', () => {
    assert.equal(runScript().code, 0);
    assert.equal(runScript().code, 0);
    assert.equal(runScript(['--check']).code, 0);
  });

  test('--check rejects a relative hooksPath drift, cwd-independently', () => {
    // Drift hooksPath back to a relative value (the old-prepare bug), while
    // core.bare and worktreeConfig stay healthy. A cwd-relative comparison
    // would have passed this from the repo root; it must fail everywhere.
    git(['config', '--worktree', 'core.hooksPath', '.hooks']);
    assert.equal(runScript(['--check']).code, 1, 'fails from the repo root');
    const sub = join(repo, 'pkg', 'nested');
    mkdirSync(sub, { recursive: true });
    let fromSub;
    try {
      execFileSync(process.execPath, [SCRIPT, '--check'], { cwd: sub, stdio: ['ignore', 'pipe', 'pipe'] });
      fromSub = 0;
    } catch (err) { fromSub = err.status ?? 1; }
    assert.equal(fromSub, 1, 'fails from a subdirectory too');
    // Healing restores the absolute pin and the check goes green.
    assert.equal(runScript().code, 0);
    assert.equal(runScript(['--check']).code, 0);
  });

  test('--check rejects an rfv drop below 1 (worktree override no longer guaranteed)', () => {
    // worktreeConfig + the override stay in place; only rfv drops. Current git
    // still honors the override, but the check must flag it because a stricter
    // git would not, which is exactly what ensure's rfv bump defends against.
    git(['config', 'core.repositoryformatversion', '0']);
    assert.equal(runScript(['--check']).code, 1, 'rfv < 1 must fail the check');
    assert.equal(runScript().code, 0);
    assert.equal(git(['config', 'core.repositoryformatversion']), '1', 'heal restores rfv=1');
    assert.equal(runScript(['--check']).code, 0);
  });
});
