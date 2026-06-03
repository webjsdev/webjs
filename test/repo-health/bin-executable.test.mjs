// Regression guard for issue #321 (recurring spurious mode-only diff).
//
// npm marks a package's declared `bin` script executable (100755) during
// install. So a `bin` committed 100644 flips to 100755 on a fresh `npm
// install`, and `git status` then reports a mode-only change that is easy to
// stage by accident (it bit the website-redesign work, where create-webjs.js
// had to be hand-excluded from every commit).
//
// This asserts every file a package declares as `bin` is committed with git
// mode 100755, so a future bin added as 100644 fails CI immediately instead of
// festering as a recurring local diff.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Every file declared under a package's `bin`, as a repo-relative posix path. */
function declaredBinFiles() {
  const out = [];
  const pkgsDir = join(ROOT, 'packages');
  for (const name of readdirSync(pkgsDir)) {
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(join(pkgsDir, name, 'package.json'), 'utf8'));
    } catch {
      continue; // not a package dir
    }
    if (!pkg.bin) continue;
    const targets = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin);
    for (const rel of targets) {
      out.push(posix.join('packages', name, rel));
    }
  }
  return out;
}

test('#321: every declared package `bin` is committed executable (git mode 100755)', () => {
  const bins = declaredBinFiles();
  assert.ok(bins.length >= 4, `expected to find the package bins, found ${bins.length}`);

  // `git ls-files -s` prints `<mode> <sha> <stage>\t<path>` for each tracked file.
  const listing = execFileSync('git', ['ls-files', '-s', '--', ...bins], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const modeByPath = new Map();
  for (const line of listing.split('\n').filter(Boolean)) {
    const [meta, path] = line.split('\t');
    modeByPath.set(path, meta.split(' ')[0]);
  }

  for (const bin of bins) {
    const mode = modeByPath.get(bin);
    assert.ok(mode, `declared bin is tracked in git: ${bin}`);
    assert.equal(
      mode,
      '100755',
      `${bin} must be committed executable (100755), got ${mode}. ` +
        `Run: git update-index --chmod=+x ${bin}`,
    );
  }
});
