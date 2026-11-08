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
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
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
    assert.match(log, /was a symlink at .*replaced it with a real directory/, 'the replacement is reported, not silent');
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
