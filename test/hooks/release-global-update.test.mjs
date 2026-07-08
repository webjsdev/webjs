// Tests for the release-global-update PostToolUse hook
// (.claude/hooks/release-global-update.sh). After a RELEASE PR (chore/release-*
// branch or "chore: release" title) merges via `gh pr merge`, it injects a
// reminder to run `npm update -g webjsdev` + `bun add -g webjsdev` once the
// publish lands. A normal PR merge, a non-merge command, and the escape hatch
// produce no reminder. It never blocks the tool (always exits 0).
//
// `gh pr view` is stubbed with a fake `gh` on PATH so the test is offline and
// deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../.claude/hooks/release-global-update.sh',
);

/** A fake `gh` on PATH whose `pr view` prints the given headRefName + title. */
function fakeGhDir(headRefName, title) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-relhook-'));
  const gh = join(dir, 'gh');
  writeFileSync(gh, `#!/usr/bin/env bash\necho '${JSON.stringify({ headRefName, title })}'\n`);
  chmodSync(gh, 0o755);
  return dir;
}

function runHook(command, { headRefName = '', title = '', env = {} } = {}) {
  const ghDir = fakeGhDir(headRefName, title);
  try {
    const r = spawnSync('bash', [HOOK], {
      input: JSON.stringify({ tool_input: { command } }),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${ghDir}${delimiter}${process.env.PATH}`, ...env },
    });
    return { code: r.status, out: (r.stdout || '') };
  } finally {
    rmSync(ghDir, { recursive: true, force: true });
  }
}

test('reminds after a chore/release-* branch PR merge', () => {
  const { code, out } = runHook('gh pr merge 839 --squash --admin --delete-branch', {
    headRefName: 'chore/release-2026-07-08b',
    title: 'chore: release server 0.8.43',
  });
  assert.equal(code, 0);
  assert.match(out, /npm update -g webjsdev/, 'reminds about npm global update');
  assert.match(out, /bun add -g webjsdev/, 'reminds about bun global add');
});

test('reminds when the title is "chore: release" even if the branch differs', () => {
  const { out } = runHook('gh pr merge 1 --squash', {
    headRefName: 'some-branch',
    title: 'chore: release cli 0.10.32',
  });
  assert.match(out, /npm update -g webjsdev/);
});

test('does NOTHING for a normal (non-release) PR merge', () => {
  const { code, out } = runHook('gh pr merge 840 --squash', {
    headRefName: 'feat/thing',
    title: 'feat: a normal feature',
  });
  assert.equal(code, 0);
  assert.doesNotMatch(out, /webjsdev/, 'no reminder for a non-release PR');
});

test('does NOTHING for a command that is not `gh pr merge`', () => {
  const { out } = runHook('git status', { headRefName: 'chore/release-x', title: 'chore: release x' });
  assert.doesNotMatch(out, /webjsdev/);
});

test('honours the WEBJS_NO_RELEASE_GLOBAL_UPDATE escape hatch', () => {
  const { out } = runHook('gh pr merge 839 --squash', {
    headRefName: 'chore/release-2026-07-08b',
    title: 'chore: release server 0.8.43',
    env: { WEBJS_NO_RELEASE_GLOBAL_UPDATE: '1' },
  });
  assert.doesNotMatch(out, /webjsdev/);
});
