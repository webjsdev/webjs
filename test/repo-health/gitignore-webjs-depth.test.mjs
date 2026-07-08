// Regression guard for issue #365 (nested .webjs/routes.d.ts leaked into
// git status). The generated route-types overlay .webjs/routes.d.ts is
// per-machine and must be gitignored at ANY depth, while the committed
// .webjs/vendor/ pin must stay tracked at any depth. A slash-bearing
// `.webjs/*` anchors to the .gitignore's own directory, so it misses a
// nested in-repo app; the fix is the depth-robust `**/.webjs/*` form.
//
// The check.test.js rule tests verify git's SEMANTICS with inline
// patterns, but nothing there ties the assertion to the SHIPPED files,
// so a revert of any shipped .gitignore to `.webjs/*` would pass every
// other test while reintroducing the exact bug. This guards the real
// artifacts: it copies each shipped .gitignore into a throwaway git repo
// and asserts the observable behavior via `git check-ignore`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The shipped .gitignore artifacts this PR fixes. The scaffold template
// is the one that ships into every `webjs create` app.
const SHIPPED = [
  '.gitignore',
  'examples/blog/.gitignore',
  // The scaffold template ships as `gitignore` (no dot): npm strips a
  // published `.gitignore`, so a dotfile name would arrive missing (#845).
  // create.js renames it to `.gitignore` in the generated app.
  'packages/cli/templates/gitignore',
];

// `git check-ignore -q` exits 0 when ignored, 1 when not ignored, so
// execFileSync throws iff the path is NOT ignored. Strip inherited git
// env so cwd is the sole authority on which repo is consulted (a
// worktree pre-commit hook leaks GIT_DIR / GIT_WORK_TREE).
function isIgnored(repo, relPath) {
  const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, GIT_PREFIX, ...env } = process.env;
  try {
    execFileSync('git', ['check-ignore', '-q', relPath], { cwd: repo, env, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function initRepo() {
  const { GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, GIT_PREFIX, ...env } = process.env;
  const repo = mkdtempSync(join(tmpdir(), 'webjs-gitignore365-'));
  execFileSync('git', ['init', '-q'], { cwd: repo, env, stdio: 'ignore' });
  return repo;
}

for (const shipped of SHIPPED) {
  test(`shipped ${shipped} ignores nested .webjs/routes.d.ts and keeps vendor (#365)`, () => {
    const repo = initRepo();
    try {
      copyFileSync(join(repoRoot, shipped), join(repo, '.gitignore'));

      // routes.d.ts is the per-machine overlay: ignored at root AND when
      // the app is a nested package (the leak this PR fixes).
      assert.equal(
        isIgnored(repo, '.webjs/routes.d.ts'),
        true,
        `${shipped}: root .webjs/routes.d.ts must be ignored`,
      );
      assert.equal(
        isIgnored(repo, 'packages/site/.webjs/routes.d.ts'),
        true,
        `${shipped}: a NESTED .webjs/routes.d.ts must be ignored (the #365 leak)`,
      );

      // The committed vendor pin must stay tracked at root and nested
      // depths, including a deeply nested downloaded bundle file.
      assert.equal(
        isIgnored(repo, '.webjs/vendor/importmap.json'),
        false,
        `${shipped}: root vendor pin must stay tracked`,
      );
      assert.equal(
        isIgnored(repo, 'packages/site/.webjs/vendor/importmap.json'),
        false,
        `${shipped}: a NESTED vendor pin must stay tracked`,
      );
      assert.equal(
        isIgnored(repo, '.webjs/vendor/dayjs@1.11.0.js'),
        false,
        `${shipped}: a downloaded vendor bundle must stay tracked`,
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
}
