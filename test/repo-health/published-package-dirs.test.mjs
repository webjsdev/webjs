// Regression guard for issue #421.
//
// scripts/publish-github-packages.js resolves a package's workspace manifest
// from its npm name by probing a set of base dirs. It originally hard-coded
// `packages/<short>`, which the #402/#404 reorg broke for the grouped
// packages (`packages/editors/<short>`, `packages/wrappers/<short>`). The
// @webjsdev/intellisense rename (#420) surfaced it: the GitHub Packages mirror
// step failed with "cannot find packages/intellisense/package.json".
//
// This asserts (a) the script still probes all three base dirs, and (b) every
// @webjsdev-scoped published package the changelog tracks resolves through
// that probe, so a future package landing in a new group dir fails CI here
// instead of at release time.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASES = ['packages', 'packages/editors', 'packages/wrappers'];

/** Resolve a short package name to its package.json via the same probe. */
function resolvePkgDir(short) {
  return BASES.map((b) => join(ROOT, b, short, 'package.json')).find((p) => existsSync(p));
}

test('publish-github-packages.js probes all grouped base dirs', () => {
  const src = readFileSync(join(ROOT, 'scripts/publish-github-packages.js'), 'utf8');
  for (const base of BASES) {
    assert.ok(
      src.includes(`'${base}'`),
      `publish-github-packages.js must probe ${base} when resolving a workspace dir`,
    );
  }
});

test('every @webjsdev npm-published changelog package resolves through the probe', () => {
  // A `changelog/<key>/` dir whose entries are NOT `npm: false` is published
  // under @webjsdev/<key>; its source dir must resolve through the probe.
  const changelogDir = join(ROOT, 'changelog');
  const keys = readdirSync(changelogDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const missing = [];
  for (const key of keys) {
    const entries = readdirSync(join(changelogDir, key)).filter((f) => f.endsWith('.md'));
    if (!entries.length) continue;
    // npm:false is a per-package property, stable across versions; sample one.
    const fm = readFileSync(join(changelogDir, key, entries[0]), 'utf8').match(/^---\n([\s\S]*?)\n---/);
    if (fm && /^npm:\s*false$/m.test(fm[1])) continue; // non-npm (vscode, nvim)
    // `ts-plugin` is the FROZEN legacy name (renamed to intellisense, #416);
    // its source dir no longer exists, which is expected.
    if (key === 'ts-plugin') continue;
    if (!resolvePkgDir(key)) missing.push(key);
  }
  assert.deepEqual(missing, [], `published packages whose dir the probe cannot resolve: ${missing.join(', ')}`);
});
