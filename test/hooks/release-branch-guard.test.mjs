/**
 * The framework `.hooks/pre-commit` blocks a published-library version bump on a
 * non-`chore/release-*` branch (#590). That is the canonical wrong-branch
 * release commit: a concurrent agent moved HEAD in a shared checkout, so a
 * `chore: release` landed on someone else's feature branch with a contaminated
 * changelog. This drives the REAL hook script against throwaway temp git repos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const hook = fileURLToPath(new URL('../../.hooks/pre-commit', import.meta.url));

/** Stage a `version` bump for `pkg` on `branch` in a temp repo, run the hook. */
function runHook(pkgPath, branch) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-hook-'));
  const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  git('checkout', '-q', '-b', branch);
  mkdirSync(join(dir, dirname(pkgPath)), { recursive: true });
  // commit a baseline package.json, then stage a version bump (the diff the hook reads)
  writeFileSync(join(dir, pkgPath), JSON.stringify({ name: 'x', version: '1.0.0' }, null, 2) + '\n');
  git('add', '-A'); git('commit', '-q', '--no-verify', '-m', 'base');
  writeFileSync(join(dir, pkgPath), JSON.stringify({ name: 'x', version: '1.0.1' }, null, 2) + '\n');
  git('add', pkgPath);
  const r = spawnSync('bash', [hook], { cwd: dir, encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

const GUARD = /not a chore\/release-\* branch/;

test('blocks a cli bump on a feature branch (the wrong-branch release symptom)', () => {
  const r = runHook('packages/cli/package.json', 'feat/something');
  assert.notEqual(r.code, 0, 'the commit is rejected');
  assert.match(r.out, GUARD);
});

test('blocks server / core / mcp / ui / intellisense bumps off a release branch', () => {
  for (const p of ['server', 'core', 'mcp', 'ui']) {
    const r = runHook(`packages/${p}/package.json`, 'feat/x');
    assert.match(r.out, GUARD, `${p} is guarded`);
  }
  // intellisense lives under packages/editors/
  assert.match(runHook('packages/editors/intellisense/package.json', 'feat/x').out, GUARD, 'intellisense is guarded');
});

// Past gate-3, a detected bump reaches the changelog step. Asserting that marker
// (not just the ABSENCE of the guard) proves the bump was let THROUGH gate-3,
// so these stay meaningful even if gate-3 were deleted (they would then hit the
// guard message instead, failing the doesNotMatch).
const REACHED_CHANGELOG_STEP = /Detected staged version bump|backfill-changelog/;

test('does NOT block on a chore/release-* branch (lib bump belongs there)', () => {
  const r = runHook('packages/cli/package.json', 'chore/release-cli-0.10.20');
  assert.doesNotMatch(r.out, GUARD);
  assert.match(r.out, REACHED_CHANGELOG_STEP, 'passed gate-3 into the changelog step');
});

test('exempts editor apps (vscode/nvim ride feature commits)', () => {
  for (const p of ['editors/vscode', 'editors/nvim']) {
    const r = runHook(`packages/${p}/package.json`, 'feat/x');
    assert.doesNotMatch(r.out, GUARD, `${p} is not guarded`);
    assert.match(r.out, REACHED_CHANGELOG_STEP, `${p} passed gate-3`);
  }
});

test('exempts lockstep wrappers (skipped by the changelog step, clean pass)', () => {
  for (const p of ['wrappers/create-webjs', 'wrappers/webjsdev']) {
    const r = runHook(`packages/${p}/package.json`, 'feat/x');
    assert.doesNotMatch(r.out, GUARD, `${p} is not guarded`);
    assert.equal(r.code, 0, `${p} passes the hook (no changelog required)`);
  }
});
