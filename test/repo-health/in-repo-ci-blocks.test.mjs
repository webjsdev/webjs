/**
 * The monorepo and its three in-repo apps each declare a `webjs.ci` step list
 * (#1471), so `npm run ci` runs local CI at the root and inside each app. This
 * guard keeps those blocks honest without running them: each parses with zero
 * problems through the same reader `webjs ci` uses, and every step that goes
 * through an npm script names a script that exists in the package it targets
 * (a step naming a missing script fails at run time with a message that never
 * mentions the block). It also pins that every step at the root runs the CLI
 * from THIS checkout rather than a hoisted `webjs` bin, since a linked
 * worktree's node_modules/.bin resolves into the primary checkout.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCiConfig, flattenSteps } from '../../packages/cli/lib/ci-config.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACKAGES = { '.': 'root', gallery: 'gallery', 'examples/blog': 'blog', website: 'website' };

/** `@webjsdev/<name>` workspace -> its directory, for `npm <cmd> --workspace=` steps. */
function workspaceDirs() {
  const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const dirs = new Map();
  const candidates = ['gallery', 'examples/blog', 'website'];
  for (const d of readdirSync(join(ROOT, 'packages'))) candidates.push(`packages/${d}`);
  for (const rel of candidates) {
    let pkg;
    try { pkg = JSON.parse(readFileSync(join(ROOT, rel, 'package.json'), 'utf8')); } catch { continue; }
    if (pkg.name) dirs.set(pkg.name, rel);
  }
  assert.ok(Array.isArray(root.workspaces), 'the root declares workspaces');
  return dirs;
}

/** The npm scripts a shell step invokes, each resolved to the package it targets. */
function scriptRefs(run, selfDir, dirs) {
  const refs = [];
  const re = /\bnpm (?:run |test\b)([\w:.-]+)?((?:\s+--workspace=\S+)?)/g;
  for (const m of run.matchAll(re)) {
    const script = m[0].includes('npm test') && !m[1] ? 'test' : m[1];
    if (!script) continue;
    const ws = /--workspace=(\S+)/.exec(m[2] || '')?.[1];
    const dir = ws ? dirs.get(ws) : selfDir;
    assert.ok(dir, `${run}: unknown workspace ${ws}`);
    refs.push({ script, dir });
  }
  return refs;
}

for (const [rel, label] of Object.entries(PACKAGES)) {
  test(`${label}: the webjs.ci block parses clean and every npm script it names exists`, () => {
    const dir = join(ROOT, rel);
    const cfg = readCiConfig(dir);
    assert.equal(cfg.declared, true, `${rel}/package.json declares webjs.ci`);
    assert.deepEqual(cfg.problems, [], `${rel}: webjs.ci has no shape problems`);
    const steps = flattenSteps(cfg.steps);
    assert.ok(steps.length > 0, `${rel}: at least one step`);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    assert.ok(pkg.scripts && pkg.scripts.ci, `${rel}: a ci script exists so npm run ci works`);
    const dirs = workspaceDirs();
    for (const step of steps) {
      for (const { script, dir: target } of scriptRefs(step.run, rel, dirs)) {
        const targetPkg = JSON.parse(readFileSync(join(ROOT, target, 'package.json'), 'utf8'));
        assert.ok(targetPkg.scripts?.[script], `${rel}: step "${step.title}" names npm script "${script}" which ${target}/package.json does not define`);
      }
    }
  });
}

test('the root list runs the CLI from this checkout, never a hoisted bin', () => {
  const cfg = readCiConfig(ROOT);
  const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.match(root.scripts.ci, /^node packages\/cli\/bin\/webjs\.js ci$/, 'the root ci script runs this checkout\'s CLI');
  for (const step of flattenSteps(cfg.steps)) {
    assert.doesNotMatch(step.run, /(^|[\s(;&|])webjs /, `root step "${step.title}" must not call a bare bin (a linked worktree resolves it into the primary): ${step.run}`);
  }
});
