// Tests for the require-tests-with-src PreToolUse hook
// (.claude/hooks/require-tests-with-src.sh). The hook reads a tool-call
// payload on stdin and, for a `git commit` that stages framework source
// without a test (or that net-removes test lines), exits 2 to block it.
//
// Each case builds a throwaway git repo, stages a specific shape of
// change, and feeds the hook the commit payload, asserting the exit code.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../.claude/hooks/require-tests-with-src.sh',
);

/** Init a throwaway repo with one src file and one test file committed. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-testgate-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  mkdirSync(join(dir, 'packages/core/src'), { recursive: true });
  mkdirSync(join(dir, 'packages/core/test'), { recursive: true });
  writeFileSync(join(dir, 'packages/core/test/x.test.js'), 'a\nb\nc\nd\ne\n');
  writeFileSync(join(dir, 'packages/core/src/x.js'), 'v1\n');
  git('add', '-A');
  git('commit', '-qm', 'init');
  return { dir, git };
}

/** Run the hook in `dir` with a commit payload and the given env, return exit code. */
function runHook(dir, env = {}) {
  const r = spawnSync('bash', [HOOK], {
    cwd: dir,
    input: JSON.stringify({ tool_input: { command: 'git commit -m x' } }),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
  return r.status;
}

test('blocks a commit that stages src with no test', () => {
  const { dir, git } = makeRepo();
  try {
    writeFileSync(join(dir, 'packages/core/src/x.js'), 'v2\n');
    git('add', 'packages/core/src/x.js');
    assert.equal(runHook(dir), 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('allows a commit that stages src AND a test', () => {
  const { dir, git } = makeRepo();
  try {
    writeFileSync(join(dir, 'packages/core/src/x.js'), 'v2\n');
    writeFileSync(join(dir, 'packages/core/test/x.test.js'), 'a\nb\nc\nd\ne\nf\n');
    git('add', '-A');
    assert.equal(runHook(dir), 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('allows a docs-only commit (no src touched)', () => {
  const { dir, git } = makeRepo();
  try {
    writeFileSync(join(dir, 'README.md'), 'docs\n');
    git('add', 'README.md');
    assert.equal(runHook(dir), 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('blocks a commit that net-removes test lines alongside src', () => {
  const { dir, git } = makeRepo();
  try {
    writeFileSync(join(dir, 'packages/core/src/x.js'), 'v3\n');
    writeFileSync(join(dir, 'packages/core/test/x.test.js'), 'a\n'); // shrink 5 -> 1
    git('add', '-A');
    assert.equal(runHook(dir), 2);
    // The override lets an intentional test refactor through.
    assert.equal(runHook(dir, { WEBJS_ALLOW_TEST_REMOVAL: '1' }), 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('WEBJS_NO_TEST_GATE=1 skips the gate entirely', () => {
  const { dir, git } = makeRepo();
  try {
    writeFileSync(join(dir, 'packages/core/src/x.js'), 'v2\n');
    git('add', 'packages/core/src/x.js');
    assert.equal(runHook(dir, { WEBJS_NO_TEST_GATE: '1' }), 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('does not fire on a non-commit git command', () => {
  const { dir } = makeRepo();
  try {
    const r = spawnSync('bash', [HOOK], {
      cwd: dir,
      input: JSON.stringify({ tool_input: { command: 'git status' } }),
      encoding: 'utf8',
    });
    assert.equal(r.status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
