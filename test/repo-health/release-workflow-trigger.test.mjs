/**
 * A merged release PR publishes on its own (#1650): `.github/workflows/release.yml`
 * runs when the CI run for a push to main completes green, and publishes the
 * changelog files that commit added. Every property below is one way the
 * automatic path can stop working, or start publishing when it must not, with
 * no failure anywhere to say so: a release simply never reaches npm, or the
 * wrong commit is diffed. Each assertion names the property it pins.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const release = readFileSync(join(ROOT, '.github/workflows/release.yml'), 'utf8');
const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');

/** The text of a top-level YAML block (`on:`, `jobs:`) up to the next one. */
function block(src, key) {
  const start = src.search(new RegExp(`^${key}:`, 'm'));
  assert.ok(start !== -1, `release.yml has a top-level ${key}: block`);
  const rest = src.slice(start + key.length + 1);
  const next = rest.search(/^[A-Za-z_]+:/m);
  return next === -1 ? rest : rest.slice(0, next);
}

test('the workflow_run trigger names the CI workflow by its exact name', () => {
  const ciName = /^name:\s*(.+)$/m.exec(ci)?.[1].trim().replace(/^['"]|['"]$/g, '');
  assert.ok(ciName, 'ci.yml declares a name');
  const on = block(release, 'on');
  assert.match(on, /^\s{2}workflow_run:/m, 'release.yml is triggered by workflow_run');
  const wf = /workflow_run:[\s\S]*?workflows:\s*\[([^\]]*)\]/.exec(on);
  assert.ok(wf, 'workflow_run lists its workflows');
  const names = wf[1].split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, ''));
  assert.deepEqual(names, [ciName], 'a renamed CI workflow would silently stop every release');
  assert.match(on, /workflow_run:[\s\S]*?types:\s*\[\s*completed\s*\]/, 'it fires when CI completes');
  assert.match(on, /workflow_run:[\s\S]*?branches:\s*\[\s*main\s*\]/, 'only for main');
});

test('the manual tag and dispatch paths are kept', () => {
  const on = block(release, 'on');
  assert.match(on, /push:\s*\n\s*tags:\s*\n\s*-\s*'publish-\*'/, 'scripts/release.sh still triggers a publish by tag');
  assert.match(on, /workflow_dispatch:/, 'the recovery dispatch stays');
});

test('only a green CI run for a push publishes', () => {
  const jobs = block(release, 'jobs');
  const cond = /^\s{4}if:\s*>-?\s*\n([\s\S]*?)\n\s{4}runs-on:/m.exec(jobs);
  assert.ok(cond, 'the release job carries an if: before runs-on');
  const expr = cond[1].replace(/\s+/g, ' ');
  assert.match(expr, /github\.event\.workflow_run\.conclusion == 'success'/, 'a red CI run must not publish');
  assert.match(expr, /github\.event\.workflow_run\.event == 'push'/, "a PR's CI run must not publish");
  assert.match(expr, /github\.event_name != 'workflow_run'/, 'the tag and dispatch paths are not gated on a CI run');
});

test('the checkout is the exact commit CI passed, not the moving tip of main', () => {
  const checkout = /- uses: actions\/checkout@[^\n]*\n\s*with:\n([\s\S]*?)\n\s*\n/.exec(release);
  assert.ok(checkout, 'the job checks out the repo');
  assert.match(checkout[1], /ref:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha/, 'checks out workflow_run.head_sha');
  assert.match(checkout[1], /fetch-depth:\s*2/, 'HEAD~1 must exist for the changelog diff');
});

test('changelog discovery runs before setup and install, which are skipped when nothing is new', () => {
  const diffAt = release.indexOf('- name: Find new changelog files');
  const setupAt = release.indexOf('- uses: actions/setup-node');
  const installAt = release.indexOf('- name: Install dependencies');
  assert.ok(diffAt !== -1 && setupAt !== -1 && installAt !== -1);
  assert.ok(diffAt < setupAt && diffAt < installAt, 'a push with no changelog file must not pay for an install');
  for (const at of [setupAt, installAt]) {
    const step = release.slice(at, at + 220);
    assert.match(step, /if: steps\.diff\.outputs\.count != '0' \|\| inputs\.lockstep_only/, 'setup and install are gated on new files (or the wrappers-only dispatch)');
  }
});

test('GitHub Releases are created in the workflow, after the registries', () => {
  assert.match(block(release, 'permissions'), /contents:\s*write/, 'gh release create needs contents: write');
  const releasesAt = release.indexOf('- name: Create GitHub Releases');
  assert.ok(releasesAt !== -1, 'a step creates the GitHub Releases');
  assert.ok(releasesAt > release.indexOf('- name: Publish to npm'), 'after npm');
  assert.ok(releasesAt > release.indexOf('- name: Publish to GitHub Packages'), 'after GitHub Packages');
  const step = release.slice(releasesAt, releasesAt + 600);
  assert.match(step, /node scripts\/publish-release\.js/, 'through the idempotent publish-release.js');
  assert.match(step, /GH_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/, 'with the workflow token');
});

test('one release run per commit', () => {
  assert.match(block(release, 'concurrency'), /group:\s*release-\$\{\{\s*github\.event\.workflow_run\.head_sha \|\| github\.sha\s*\}\}/,
    'an automatic run and a pushed tag for the same commit queue instead of racing');
});
