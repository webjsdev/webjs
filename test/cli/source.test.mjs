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

test('a bare webjs source lists what WebJs provides, by need', () => {
  const r = run();
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^What WebJs provides, by need\./, 'the catalogue, not a usage error');
  assert.match(r.stdout, /^  Auth: createAuth, /m, 'auth is one line');
  assert.match(r.stdout, /^  Rate limits and CORS: rateLimit, /m, 'and so is each feature the brief does not name');
});

test('webjs source --pkg <name> alone lists that package, as the MCP tool does for { package }', () => {
  const r = run('--pkg', 'core');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /@webjsdev\/core\/src:/, 'the package listing, not a lookup of an export named core');
  assert.doesNotMatch(r.stdout, /No export named/);
  // A package that is not installed is a miss, as a name no package exports is.
  const typo = run('--pkg', 'sever');
  assert.equal(typo.status, 1, 'a --pkg typo exits 1');
  assert.match(typo.stderr, /not installed\/resolvable/, 'with the message on stderr');
  assert.equal(typo.stdout, '', 'and nothing on stdout');
  // The listing offers what a shell can do, not the MCP tool's modes.
  const listed = run('--pkg', 'core');
  assert.match(listed.stdout, /npx webjs source <Export>/);
  assert.doesNotMatch(listed.stdout, /source\(\{ path \}\)/, 'no MCP-only advice');
  // A name after the flag's value is still the name.
  const named = run('--pkg', 'core', 'optimistic');
  assert.equal(named.status, 0, named.stderr);
  assert.match(named.stdout, /@webjsdev\/core /);
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

test('a file convention name prints the routing guide; the exports named after one keep their lookup', () => {
  for (const name of ['not-found', 'middleware.ts', 'route.ts', 'error', 'routing']) {
    const r = run(name);
    assert.equal(r.status, 0, `${name}: ${r.stderr}`);
    assert.match(r.stdout, /^Guide: routing \(/, `${name} prints the routing guide`);
  }
  for (const name of ['route', 'middleware']) {
    const r = run(name);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^@webjsdev\/server /m, `${name} still prints the export`);
    assert.match(r.stdout, /For the route\.ts \/ middleware\.ts file convention: npx webjs source routing\n$/, `${name} points at the guide`);
  }
  const nf = run('notFound');
  assert.equal(nf.status, 0, nf.stderr);
  assert.match(nf.stdout, /^@webjsdev\/core /m, 'notFound is the function, not the guide');
  assert.doesNotMatch(nf.stdout, /Guide: routing/);
});

