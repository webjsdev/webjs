/**
 * `webjs source <Export>` (#1623): one framework export's signature plus its doc
 * comment, read from the installed @webjsdev/* packages, so an agent checks a
 * contract without printing the file. The lookup itself is unit-tested in
 * packages/mcp/test/mcp-source.test.mjs; this proves the CLI front door: the
 * argument parsing, the exit status, and that it runs from inside an app.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');
const CLI = resolve(REPO, 'packages', 'cli', 'bin', 'webjs.js');
const run = (...args) => spawnSync(process.execPath, [CLI, 'source', ...args], { cwd: resolve(REPO, 'gallery'), encoding: 'utf8' });

test('webjs source <Export> prints the declaration and its doc, not the file', () => {
  const r = run('createAuth');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^@webjsdev\/server index\.d\.ts:\d+$/m, 'names the package, file and line');
  assert.match(r.stdout, /export declare function createAuth</, 'the typed signature');
  assert.match(r.stdout, /\/\*\*[\s\S]*\*\/\nexport declare function createAuth</, 'the doc comment directly above it');
  assert.ok(r.stdout.split('\n').length < 40, `one declaration, not the file (${r.stdout.split('\n').length} lines)`);
});

test('webjs source --pkg narrows the search; a miss exits 1 and names the searched packages', () => {
  const ok = run('optimistic', '--pkg', 'core');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /@webjsdev\/core /);
  const miss = run('createAuth', '--pkg', 'core');
  assert.equal(miss.status, 1, 'a miss is exit 1');
  assert.match(miss.stdout, /No export named "createAuth"/);
  // Counterfactual: a name no package exports.
  const none = run('definitelyNotAnExport');
  assert.equal(none.status, 1);
  assert.match(none.stdout, /searched @webjsdev\/\* packages \(core, server/);
});

test('webjs source with no name prints usage and exits 1', () => {
  const r = run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: webjs source <Export>/);
});
