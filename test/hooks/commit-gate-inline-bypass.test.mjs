// The four commit gates (tests, docs, scaffold, Bun parity) each print a
// remedy of the form "re-run with WEBJS_..=1". Their bypass used to read only
// the hook's OWN environment, which an agent cannot set (Claude Code runs a
// hook with the harness environment, not the command's), so the remedy could
// never be followed. Each gate now also honours the assignment written in
// front of the `git commit` it applies to, and only there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/hooks');

const GATES = [
  ['require-tests-with-src', 'WEBJS_NO_TEST_GATE'],
  ['require-docs-with-src', 'WEBJS_NO_DOC_GATE'],
  ['require-scaffold-with-src', 'WEBJS_NO_SCAFFOLD_GATE'],
  ['require-bun-parity-with-runtime-src', 'WEBJS_BUN_VERIFIED'],
];

/** A throwaway repo with a staged runtime-sensitive server source change, which every gate blocks. */
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-inline-bypass-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  mkdirSync(join(dir, 'packages/server/src'), { recursive: true });
  writeFileSync(join(dir, 'packages/server/src/actions.js'), 'v1\n');
  git('add', '-A');
  git('commit', '-qm', 'init');
  writeFileSync(join(dir, 'packages/server/src/actions.js'), 'v2\n');
  git('add', 'packages/server/src/actions.js');
  return dir;
}

function runHook(name, dir, command, env = {}) {
  const clean = { ...process.env, ...env };
  for (const [, v] of GATES) if (!(v in env)) delete clean[v];
  return spawnSync('bash', [join(HOOKS, `${name}.sh`)], {
    cwd: dir,
    input: JSON.stringify({ tool_input: { command } }),
    env: clean,
    encoding: 'utf8',
  }).status;
}

for (const [name, v] of GATES) {
  test(`${name}: the inline ${v}=1 prefix is honoured, and only in front of the commit`, () => {
    const dir = makeRepo();
    try {
      assert.equal(runHook(name, dir, 'git commit -m x'), 2, 'blocks without a bypass');
      assert.equal(runHook(name, dir, 'git commit -m x', { [v]: '1' }), 0, 'the environment bypass still works');
      assert.equal(runHook(name, dir, `${v}=1 git commit -m x`), 0, 'an inline prefix is honoured');
      assert.equal(runHook(name, dir, `FOO=bar ${v}=1 OTHER=2 git commit -q -m x`), 0, 'among other assignments');
      assert.equal(runHook(name, dir, `git add -A && ${v}=1 git commit -m x`), 0, 'after an earlier command in the chain');
      assert.equal(runHook(name, dir, `git commit -m "${v}=1 git commit"`), 2, 'not inside a commit message');
      assert.equal(runHook(name, dir, `echo ${v}=1; git commit -m x`), 2, 'not in a separate command');
      assert.equal(runHook(name, dir, `${v}=0 git commit -m x`), 2, 'only the value 1');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
