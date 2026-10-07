// The block-admin-merge hook refuses `gh pr merge --admin` (a merge over red
// CI) and allows every other command, including ones that only mention the
// flag. AGENTS.md: a PR merges only with green CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = resolve(dirname(fileURLToPath(import.meta.url)), '../../.claude/hooks/block-admin-merge.sh');

function runHook(command, env = {}) {
  return spawnSync('bash', [HOOK], {
    input: JSON.stringify({ tool_input: { command } }),
    // Pin the escape hatch off so an inherited value cannot flip the blocks.
    env: { ...process.env, WEBJS_ALLOW_ADMIN_MERGE: '0', ...env },
    encoding: 'utf8',
  });
}

for (const cmd of [
  'gh pr merge 12 --squash --admin',
  'gh pr merge --admin --squash --delete-branch 12',
  'cd ../webjs-x && gh pr merge 12 --squash --admin',
  'GH_DEBUG=api gh pr merge 12 --admin',
]) {
  test(`blocks: ${cmd}`, () => {
    const r = runHook(cmd);
    assert.equal(r.status, 2, `expected block, got ${r.status}: ${r.stderr}`);
    assert.match(r.stderr, /merges over failing CI/);
  });
}

for (const cmd of [
  'gh pr merge 12 --squash --delete-branch',
  'git commit -m "docs: never use gh pr merge --admin"',
  'grep -rn -- "--admin" AGENTS.md',
  'gh pr checks 12',
  'ls',
]) {
  test(`allows: ${cmd}`, () => {
    const r = runHook(cmd);
    assert.equal(r.status, 0, `expected allow, got ${r.status}: ${r.stderr}`);
  });
}

test('the escape hatch allows an owner-approved admin merge', () => {
  const r = runHook('gh pr merge 12 --squash --admin', { WEBJS_ALLOW_ADMIN_MERGE: '1' });
  assert.equal(r.status, 0, r.stderr);
});
