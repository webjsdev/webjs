/**
 * The core dist build must never write THROUGH a symlink standing at its out
 * dir (#1671).
 *
 * `npm run worktree:link` plants `packages/core/dist` in a linked worktree as a
 * symlink at the PRIMARY checkout's dist. Core's `prepare` runs this build
 * during `npm ci`, so before the guard an install in such a worktree replaced
 * the primary's bundles with the worktree's and deleted every file the primary
 * had that the build did not produce, silently running another branch's code
 * under everything that resolves through the primary.
 *
 * The fixture reproduces that shape in a temp dir: a "foreign" directory with a
 * marker file plays the primary's dist, and the out dir is a symlink at it. With
 * the guard the out dir becomes a real directory holding the bundles and the
 * foreign one is untouched. Without it the bundles land in the foreign dir and
 * the stale-file cleanup deletes the marker, so both assertions below fail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(ROOT, 'scripts/build-framework-dist.js');

test('core dist build replaces a symlinked out dir instead of writing into its target', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'webjs-dist-link-'));
  try {
    const foreign = join(tmp, 'primary-dist');
    mkdirSync(foreign);
    writeFileSync(join(foreign, 'MARKER'), 'the primary checkout\'s own build');
    const out = join(tmp, 'worktree-dist');
    symlinkSync(foreign, out, 'junction');

    const log = execFileSync(process.execPath, [SCRIPT, out], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });

    // The foreign target is exactly as it was: marker kept, no bundle written.
    assert.ok(existsSync(join(foreign, 'MARKER')), 'the stale-file cleanup must not delete files in the link target');
    assert.deepEqual(
      readdirSync(foreign).filter((f) => f.startsWith('webjs-core')),
      [],
      'no bundle may be written into the link target',
    );

    // The out dir is now a real directory carrying this build.
    assert.ok(!lstatSync(out).isSymbolicLink(), 'the symlink at the out dir is replaced');
    assert.ok(lstatSync(out).isDirectory(), 'the out dir is a real directory');
    for (const f of ['webjs-core.js', 'webjs-core-browser.js', 'webjs-core-lazy-loader.js', 'webjs-core-testing.js']) {
      assert.ok(existsSync(join(out, f)), `${f} is built into the real out dir`);
    }
    assert.match(log, /was a symlink at .*Replaced it with a real directory/, 'the replacement is reported, not silent');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('core dist build leaves a real out dir alone apart from the build itself', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'webjs-dist-real-'));
  try {
    const out = join(tmp, 'dist');
    mkdirSync(out);
    const log = execFileSync(process.execPath, [SCRIPT, out], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    assert.ok(existsSync(join(out, 'webjs-core-browser.js')));
    assert.doesNotMatch(log, /was a symlink/, 'no replacement is reported for a real directory');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('a FAILED build leaves a symlinked out dir exactly as it was', () => {
  // The link is swapped only after esbuild succeeds. Removing it first left a
  // worktree with an empty dist and no link whenever the build failed (a syntax
  // error in packages/core/src is the usual reason to rebuild), and opened the
  // empty-dist window the staging directory exists to close (#1474).
  //
  // ESBUILD_BINARY_PATH pointed at a binary that exits at once makes esbuild
  // fail ("The service was stopped") without touching any source. It has to be
  // a file that EXISTS: esbuild ignores a missing path with a warning and falls
  // back to its installed binary, so a nonexistent path fails only on a machine
  // whose install lacks that binary and passes the build everywhere else.
  const tmp = mkdtempSync(join(tmpdir(), 'webjs-dist-fail-'));
  try {
    const foreign = join(tmp, 'primary-dist');
    mkdirSync(foreign);
    writeFileSync(join(foreign, 'MARKER'), 'the primary checkout\'s own build');
    const out = join(tmp, 'worktree-dist');
    symlinkSync(foreign, out, 'junction');
    const fakeEsbuild = join(tmp, 'fake-esbuild');
    writeFileSync(fakeEsbuild, '#!/bin/sh\nexit 1\n');
    chmodSync(fakeEsbuild, 0o755);

    const r = spawnSync(process.execPath, [SCRIPT, out], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, ESBUILD_BINARY_PATH: fakeEsbuild },
    });
    assert.notEqual(r.status, 0, 'the build must fail for this test to mean anything');
    assert.ok(lstatSync(out).isSymbolicLink(), 'the link is still there after a failed build');
    assert.ok(existsSync(join(out, 'MARKER')), 'and still resolves to its target');
    assert.deepEqual(readdirSync(tmp).filter((f) => f.includes('.building-')), [], 'no staging dir is left behind');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
