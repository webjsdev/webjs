/**
 * The webjs.dev CDN purge runs on Actions for every push to main (#1652).
 * #1594 moved it to the merging machine, where it skipped silently whenever
 * that shell lacked a credential, and the edge kept serving stale assets for
 * hours with nothing red anywhere. Each assertion pins one property whose loss
 * would bring that back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const purge = readFileSync(join(ROOT, '.github/workflows/purge-cdn.yml'), 'utf8');
const ciMerge = readFileSync(join(ROOT, 'scripts/ci-merge.sh'), 'utf8');
const release = readFileSync(join(ROOT, 'scripts/release.sh'), 'utf8');

/** The text of a top-level YAML block (`on:`, `jobs:`) up to the next one. */
function block(src, key) {
  const start = src.search(new RegExp(`^${key}:`, 'm'));
  assert.ok(start !== -1, `purge-cdn.yml has a top-level ${key}: block`);
  const rest = src.slice(start + key.length + 1);
  const next = rest.search(/^[A-Za-z_]+:/m);
  return next === -1 ? rest : rest.slice(0, next);
}

/** The body of the step whose `- name:` line matches `name`. */
function step(name) {
  const lines = purge.split('\n');
  const i = lines.findIndex((l) => /^\s*- name:/.test(l) && l.includes(name));
  assert.ok(i !== -1, `purge-cdn.yml has a step named "${name}"`);
  const indent = lines[i].search(/-/);
  let j = i + 1;
  while (j < lines.length && !(lines[j].search(/\S/) === indent && lines[j].trimStart().startsWith('- '))) j++;
  return lines.slice(i, j).join('\n');
}

test('purge-cdn.yml runs on every push to main, and by hand', () => {
  const on = block(purge, 'on');
  assert.match(on, /^\s+push:\s*\n\s+branches:\s*\[\s*main\s*\]/m, 'on.push.branches is [main]');
  assert.match(on, /^\s+workflow_dispatch:/m, 'a manual dispatch stays available');
});

test('a push waits for the Railway deployment of its own commit', () => {
  const resolve = step('Resolve the Railway deployment');
  assert.match(resolve, /if:\s*github\.event_name == 'push'/, 'the deploy lookup runs on push');
  assert.match(resolve, /SHA:\s*\$\{\{\s*github\.sha\s*\}\}/, 'it looks up the pushed sha');
});

test('the purge runs only after a successful deploy, or on a manual dispatch', () => {
  for (const name of ['Purge the Cloudflare cache', 'Confirm the edge now matches the origin']) {
    assert.match(
      step(name),
      /if:\s*github\.event_name == 'workflow_dispatch' \|\| steps\.deploy\.outputs\.should_purge == 'true'/,
      `"${name}" is gated on the deploy status`,
    );
  }
});

test('the workflow reads repository secrets, not an environment', () => {
  assert.doesNotMatch(purge, /^\s+environment:/m, 'an environment would hide repository-scoped secrets');
  assert.match(purge, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.match(purge, /secrets\.RAILWAY_TOKEN/);
});

test('ci-merge.sh no longer starts a local purge', () => {
  const code = ciMerge.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.doesNotMatch(code, /bash\s+\S*purge-cdn\.sh/, 'the local purge is the one that skipped silently');
});

test('release.sh purges only on request', () => {
  assert.match(release, /^purge=0 /m, 'the default is no local purge');
  assert.match(release, /--purge\) purge=1 ;;/);
});
