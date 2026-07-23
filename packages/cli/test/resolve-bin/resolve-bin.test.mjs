/**
 * Unit tests for resolveBin (#570): resolving a dependency's bin from an app's
 * node_modules without relying on `npx` or a `./bin`/`./package.json` export
 * (which drizzle-kit and @web/test-runner both block).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { resolveBin } from '../../lib/resolve-bin.js';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const cliDir = fileURLToPath(new URL('../../', import.meta.url));
// Resolve each tool from a cwd that genuinely DECLARES it (not via hoist luck):
// drizzle-kit is a devDependency of examples/blog; @web/test-runner is a root
// devDependency. Both packages block their bin subpath + ./package.json in
// `exports`, which is exactly what resolveBin works around.
const blogDir = fileURLToPath(new URL('../../../../examples/blog/', import.meta.url));

test('resolves drizzle-kit despite its exports blocking ./bin.cjs', () => {
  const p = resolveBin(blogDir, 'drizzle-kit', 'drizzle-kit');
  assert.match(p, /drizzle-kit[/\\]bin\.cjs$/);
  assert.ok(existsSync(p), 'the resolved drizzle-kit bin exists on disk');
});

test('resolves @web/test-runner via the wtr bin key', () => {
  const p = resolveBin(repoRoot, '@web/test-runner', 'wtr');
  assert.match(p, /@web[/\\]test-runner[/\\].*bin\.js$/);
  assert.ok(existsSync(p), 'the resolved wtr bin exists on disk');
});

test('resolves the @webjsdev/ui webjsui bin despite its exports gate (#1073)', () => {
  // @webjsdev/ui is a hard dependency of @webjsdev/cli, so resolve from the CLI
  // package dir the way `webjs ui` does.
  const p = resolveBin(cliDir, '@webjsdev/ui', 'webjsui');
  // Path tail only: the monorepo resolves the workspace `packages/ui/`, an
  // installed app resolves `node_modules/@webjsdev/ui/`; both end the same way.
  assert.match(p, /ui[/\\]bin[/\\]webjsui\.js$/);
  assert.ok(existsSync(p), 'the resolved webjsui bin exists on disk');
});

test('counterfactual: the raw bin subpath resolve is blocked by exports (#1073)', () => {
  // This is exactly the resolve the `ui` dispatch used to do, and why it failed
  // even with @webjsdev/ui installed: the exports map does not list ./bin/*, so
  // Node refuses the subpath though the file exists. resolveBin bypasses this.
  const req = createRequire(new URL('../../package.json', import.meta.url));
  assert.throws(
    () => req.resolve('@webjsdev/ui/bin/webjsui.js'),
    /ERR_PACKAGE_PATH_NOT_EXPORTED|is not defined by "exports"/,
  );
});

test('throws a clear error when the package is not installed', () => {
  assert.throws(
    () => resolveBin(repoRoot, 'definitely-not-a-real-package-xyz', 'nope'),
    /Cannot find (module|package)|package.json not found/,
  );
});
