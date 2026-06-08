/**
 * #413: the two editor packages (the VS Code extension and webjs.nvim) are
 * tracked in the unified changelog but ship through non-npm channels (vsce /
 * ovsx, the webjs.nvim git subtree). Their changelog entries carry
 * `npm: false`, which is the contract that decouples changelog-tracking from
 * npm publishing: the release workflow's publish scripts MUST skip a
 * `npm: false` entry, never attempting a registry publish.
 *
 * This locks that contract:
 *   1. The committed editor entries exist and are flagged `npm: false`.
 *   2. Every publish-* script skips (exit 0) on a `npm: false` file.
 *   3. Counterfactual: the SAME scripts do NOT skip a file without the flag
 *      (they fall through to the missing-frontmatter error, exit 2), proving
 *      the skip is keyed on `npm: false` and not unconditional. This path is
 *      fully offline: the error fires before any `npm`/`gh` call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const PUBLISH_SCRIPTS = [
  'scripts/publish-npm.js',
  'scripts/publish-github-packages.js',
  'scripts/publish-release.js',
];

function runScript(rel, file) {
  return spawnSync('node', [join(ROOT, rel), file], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('the committed editor changelog entries are flagged npm:false', () => {
  const entries = [
    { file: 'changelog/vscode/0.2.0.md', name: 'webjs (VS Code extension)' },
    { file: 'changelog/nvim/0.1.0.md', name: 'webjs.nvim' },
  ];
  for (const e of entries) {
    const path = join(ROOT, e.file);
    assert.ok(existsSync(path), `${e.file} should exist`);
    const raw = readFileSync(path, 'utf8');
    const fm = raw.match(/^---\n([\s\S]*?)\n---/)[1];
    assert.match(fm, /^npm:\s*false$/m, `${e.file} must carry npm: false`);
    assert.match(fm, new RegExp(`package:\\s*"${e.name.replace(/[()]/g, '\\$&')}"`), `${e.file} package name`);
    // A real entry, not an empty placeholder.
    assert.match(raw, /## (Features|Fixes|Performance|Breaking)/, `${e.file} has content`);
  }
});

test('every publish script SKIPS a npm:false changelog file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wj-cl-'));
  try {
    const f = join(dir, 'entry.md');
    writeFileSync(
      f,
      '---\npackage: "webjs (VS Code extension)"\nversion: 9.9.9\ndate: 2026-01-01\nnpm: false\n---\n## Features\n- x\n',
    );
    for (const s of PUBLISH_SCRIPTS) {
      const r = runScript(s, f);
      assert.equal(r.status, 0, `${s} should exit 0 on npm:false, got ${r.status}\n${r.stderr}`);
      assert.match(r.stdout, /skip .*npm:false/, `${s} should log the npm:false skip`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('counterfactual: publish scripts do NOT skip a file lacking npm:false', () => {
  // No `npm:` line and no package/version -> the scripts fall through PAST the
  // skip guard to the missing-frontmatter error (exit 2). If the skip were
  // unconditional this would wrongly exit 0. Offline: errors before any npm/gh.
  const dir = mkdtempSync(join(tmpdir(), 'wj-cl-'));
  try {
    const f = join(dir, 'entry.md');
    writeFileSync(f, '---\ndate: 2026-01-01\n---\n## Features\n- x\n');
    for (const s of PUBLISH_SCRIPTS) {
      const r = runScript(s, f);
      assert.equal(r.status, 2, `${s} should exit 2 (missing package), not skip; got ${r.status}`);
      assert.doesNotMatch(r.stdout, /npm:false/, `${s} must not log a npm:false skip here`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the website badge map has colors for both editor packages', () => {
  const badge = readFileSync(
    join(ROOT, 'website/modules/changelog/utils/pkg-badge.ts'),
    'utf8',
  );
  assert.match(badge, /\bvscode:\s*'[^']+'/, 'pkg-badge needs a vscode color');
  assert.match(badge, /\bnvim:\s*'[^']+'/, 'pkg-badge needs an nvim color');
});
