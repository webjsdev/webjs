/**
 * `add` installs only the npm dependencies the app does not already declare.
 * Every component depends on @webjsdev/core, which every WebJs app declares, so
 * before this an add of any component ran a full install and rewrote the app's
 * `@webjsdev/core` range (`latest` became `^0.8.0`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { undeclaredDeps } from '../src/commands/add.js';

function appWith(pkg) {
  const dir = mkdtempSync(join(tmpdir(), 'webjsui-deps-'));
  if (pkg) writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  return dir;
}

test('a dependency the app already declares is not installed again', () => {
  const dir = appWith({ dependencies: { '@webjsdev/core': 'latest' } });
  try {
    assert.deepEqual(undeclaredDeps(dir, ['@webjsdev/core']), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('every dependency field counts as declared, and a versioned spec matches its name', () => {
  const dir = appWith({
    devDependencies: { typescript: '^6.0.0' },
    peerDependencies: { '@scope/peer': '*' },
    optionalDependencies: { optdep: '1' },
  });
  try {
    assert.deepEqual(
      undeclaredDeps(dir, ['typescript@^6', '@scope/peer@2.0.0', 'optdep', 'fresh-pkg', '@scope/new@1']),
      ['fresh-pkg', '@scope/new@1'],
    );
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an app with no readable package.json installs everything asked for', () => {
  const dir = appWith(null);
  try {
    assert.deepEqual(undeclaredDeps(dir, ['@webjsdev/core', 'x']), ['@webjsdev/core', 'x']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
