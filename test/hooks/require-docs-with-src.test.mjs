// Tests for the FRAMEWORK's require-docs-with-src PreToolUse hook
// (.claude/hooks/require-docs-with-src.sh). A `git commit` that stages
// framework source (packages/*/src/** or packages/cli/lib/**) with NO doc
// surface exits 2 to block it, with a WEBJS_NO_DOC_GATE=1 escape hatch.
//
// The agent skill that used to count as a doc surface was removed, so these
// pin what DOES count now: the docs site under website/, any AGENTS / CLAUDE /
// README markdown, the scaffold templates, and the brief's source. A path
// under the deleted skill directory no longer satisfies the gate.
//
// Each case builds a throwaway repo, stages a shape of change, feeds the
// hook the commit payload, and asserts the exit code.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../.claude/hooks/require-docs-with-src.sh',
);

/** Init a throwaway monorepo-shaped repo with a baseline commit. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-docgate-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  writeFileSync(join(dir, 'README.md'), 'docs\n');
  git('add', '-A');
  git('commit', '-qm', 'init');
  return { dir, git };
}

/** Write `rel` (creating its directory) with `body`. */
function put(dir, rel, body) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), body);
}

function runHook(dir, env = {}) {
  const r = spawnSync('bash', [HOOK], {
    cwd: dir,
    input: JSON.stringify({ tool_input: { command: 'git commit -m x' } }),
    env: { ...process.env, WEBJS_NO_DOC_GATE: '', ...env },
    encoding: 'utf8',
  });
  return r.status;
}

/** Stage a source change plus `docPath`, run the hook, and return its exit code. */
function withDoc(docPath) {
  const { dir, git } = makeRepo();
  try {
    put(dir, 'packages/core/src/x.js', 'v2\n');
    if (docPath) put(dir, docPath, 'doc\n');
    git('add', '-A');
    return runHook(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('blocks a source commit that stages no doc surface', () => {
  assert.equal(withDoc(null), 2);
});

for (const doc of [
  'website/app/(site)/docs/components/page.ts',
  'website/app/page.ts',
  'AGENTS.md',
  'packages/core/AGENTS.md',
  'README.md',
  'packages/cli/templates/AGENTS.md',
  'packages/mcp/src/brief.js',
]) {
  test(`accepts a source commit that stages ${doc}`, () => {
    assert.equal(withDoc(doc), 0);
  });
}

test('the deleted skill directory no longer counts as a doc surface', () => {
  assert.equal(withDoc('.agents/skills/webjs/SKILL.md'), 2);
});

test('WEBJS_NO_DOC_GATE=1 lets an internal change through', () => {
  const { dir, git } = makeRepo();
  try {
    put(dir, 'packages/core/src/x.js', 'v2\n');
    git('add', '-A');
    assert.equal(runHook(dir, { WEBJS_NO_DOC_GATE: '1' }), 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a commit touching no framework source is never gated', () => {
  const { dir, git } = makeRepo();
  try {
    put(dir, 'scripts/x.mjs', 'v\n');
    git('add', '-A');
    assert.equal(runHook(dir), 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
