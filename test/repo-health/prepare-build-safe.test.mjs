// Regression guard: the root `prepare` script must NOT fail `npm install` when
// scripts/git-worktree-safe.mjs is absent.
//
// In a Docker / Nixpacks build, `npm install` runs after `COPY package.json`
// but before the rest of the repo is copied, so `scripts/` is not in the image
// yet. A bare `node scripts/git-worktree-safe.mjs` then exits 1 (module not
// found) and fails the build. This broke all four deployed services. The
// prepare command must tolerate the script being absent (exit 0).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('root prepare script tolerates a missing scripts/ dir (build context)', () => {
  const prepare = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts.prepare;
  assert.ok(prepare, 'root package.json defines a prepare script');

  // Run the EXACT prepare command in a temp dir that does NOT contain
  // scripts/git-worktree-safe.mjs, the way a Docker build runs it before the
  // repo is fully copied. It must exit 0 so `npm install` does not fail.
  const dir = mkdtempSync(join(tmpdir(), 'webjs-prepare-'));
  try {
    execSync(prepare, { cwd: dir, stdio: 'ignore' }); // throws on non-zero exit
  } catch (err) {
    assert.fail(
      `prepare command "${prepare}" failed when scripts/ is absent (exit ${err.status}); ` +
      `it must end in a guard like "|| true" so a build context cannot break npm install`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
