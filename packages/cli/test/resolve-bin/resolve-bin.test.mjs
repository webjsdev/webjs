/**
 * Unit tests for resolveBin (#570): resolving a dependency's bin from an app's
 * node_modules without relying on `npx` or a `./bin`/`./package.json` export
 * (which drizzle-kit and @web/test-runner both block).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { resolveBin } from '../../lib/resolve-bin.js';

// The repo root has both tools installed (they are the framework's own
// devDependencies), so resolution from here exercises the real packages whose
// `exports` do NOT expose the bin subpath.
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

test('resolves drizzle-kit despite its exports blocking ./bin.cjs', () => {
  const p = resolveBin(repoRoot, 'drizzle-kit', 'drizzle-kit');
  assert.match(p, /drizzle-kit[/\\]bin\.cjs$/);
  assert.ok(existsSync(p), 'the resolved drizzle-kit bin exists on disk');
});

test('resolves @web/test-runner via the wtr bin key', () => {
  const p = resolveBin(repoRoot, '@web/test-runner', 'wtr');
  assert.match(p, /@web[/\\]test-runner[/\\].*bin\.js$/);
  assert.ok(existsSync(p), 'the resolved wtr bin exists on disk');
});

test('throws a clear error when the package is not installed', () => {
  assert.throws(
    () => resolveBin(repoRoot, 'definitely-not-a-real-package-xyz', 'nope'),
    /Cannot find (module|package)|package.json not found/,
  );
});
