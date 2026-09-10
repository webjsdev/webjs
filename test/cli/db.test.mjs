/**
 * Tests for the `webjs db` verb map (#1468), the bring-your-own-ORM seam.
 *
 * A `"webjs": { "db": { "<verb>": "<command>" } }` block in package.json makes
 * `webjs db <verb>` run that command through the shell instead of the
 * drizzle-kit default, with extra args appended, so `webjs db migrate` is one
 * spelling across ORMs. With no block every verb keeps its default. Each test
 * scaffolds a throwaway app dir with a package.json and a marker-writing
 * command, then spawns the real CLI against it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');
const CLI = resolve(REPO, 'packages', 'cli', 'bin', 'webjs.js');

/**
 * Make an app dir whose package.json carries the given `webjs` block. The
 * marker command is a `node -e` one-liner (portable across shells) that
 * writes its argv to `marker.txt`, proving both that the mapped command ran
 * and what args reached it.
 */
function app(webjs) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-db-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'db-test', type: 'module', webjs }, null, 2));
  return dir;
}

/** The shell command that records its args in marker.txt (cwd-relative). */
const MARK = `node -e "require('fs').writeFileSync('marker.txt', process.argv.slice(1).join(' '))" --`;

function db(dir, ...args) {
  return spawnSync(process.execPath, [CLI, 'db', ...args], { cwd: dir, encoding: 'utf8' });
}

test('a mapped verb runs its command with the extra args appended', () => {
  const dir = app({ db: { migrate: MARK } });
  try {
    const r = db(dir, 'migrate', '--foo', 'bar');
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(dir, 'marker.txt')), 'the mapped command ran');
    assert.equal(readFileSync(join(dir, 'marker.txt'), 'utf8'), '--foo bar', 'args passed through');
    assert.match(r.stdout, /webjs db migrate: running/, 'names what it ran');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('any key is a verb: a verb only the map declares runs too', () => {
  const dir = app({ db: { reset: MARK } });
  try {
    const r = db(dir, 'reset');
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(dir, 'marker.txt')), 'the map-only verb ran');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a mapped seed overrides the db/seed.server.ts runner', () => {
  const dir = app({ db: { seed: MARK } });
  try {
    // No db/seed.server.ts exists here, so the default runner would exit 1.
    const r = db(dir, 'seed');
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(dir, 'marker.txt')), 'the mapped seed ran');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a mapped command\'s exit code is the CLI\'s exit code', () => {
  const dir = app({ db: { migrate: 'node -e "process.exit(3)"' } });
  try {
    assert.equal(db(dir, 'migrate').status, 3, 'the failure propagates');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('with no block, a kit verb keeps its drizzle-kit default and names webjs.db as the BYO path', () => {
  // A bare app has no drizzle-kit, so the default path fails with the
  // install hint, which now also tells a non-Drizzle app how to map the verb.
  // Under Bun the resolver can fall through to a GLOBAL drizzle-kit, in which
  // case the kit itself runs and fails on the missing drizzle.config; either
  // way the passthrough (not a mapped command) is what ran.
  const dir = app({});
  try {
    const r = db(dir, 'migrate');
    assert.equal(r.status, 1);
    assert.doesNotMatch(r.stdout, /webjs db migrate: running/, 'no mapped command');
    assert.ok(!existsSync(join(dir, 'marker.txt')));
    const out = r.stderr + r.stdout;
    if (/drizzle-kit is not installed/.test(out)) {
      assert.match(out, /"webjs": \{ "db": \{ "migrate":/, 'the BYO mapping is suggested');
    } else {
      assert.match(out, /drizzle\.config/, 'a globally resolved drizzle-kit ran instead');
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an unmapped unknown verb still exits 1 and says how to add it', () => {
  const dir = app({ db: { migrate: MARK } });
  try {
    const r = db(dir, 'reset');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Unknown db subcommand "reset"/);
    assert.match(r.stderr, /"webjs": \{ "db": \{ "reset": "<command>" \} \}/, 'names the map');
    assert.ok(!existsSync(join(dir, 'marker.txt')), 'nothing ran');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
