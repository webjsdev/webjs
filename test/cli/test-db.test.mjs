/**
 * `webjs test` gives a SQLite app's server tests a fresh, migrated database
 * (packages/cli/lib/test-db.js), so a test that imports the app's `db` works
 * without hand-applied migrations and never writes into db/dev.db. Two of six
 * agents building apps on the scaffold hand-applied migration SQL to a
 * temporary file to test their actions.
 *
 * Counterfactual: with WEBJS_TEST_DB=0 the same test fails (no table), which
 * the last case asserts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { wantsTestDatabase } from '../../packages/cli/lib/test-db.js';
import { scaffoldApp } from '../../packages/cli/lib/create.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = join(ROOT, 'packages', 'cli', 'bin', 'webjs.js');

function appWith(files) {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-testdb-unit-'));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  return dir;
}

test('wantsTestDatabase: a SQLite app, with or without migrations, unless the shell sets DATABASE_URL or opts out', () => {
  const sqlite = appWith({ 'drizzle.config.ts': "export default { dialect: 'sqlite' };", 'db/migrations/0001/migration.sql': 'select 1;' });
  const pg = appWith({ 'drizzle.config.ts': "export default { dialect: 'postgresql' };", 'db/migrations/0001/migration.sql': 'select 1;' });
  const fresh = appWith({ 'drizzle.config.ts': "export default { dialect: 'sqlite' };" });
  try {
    assert.equal(wantsTestDatabase(sqlite, {}), true);
    assert.equal(wantsTestDatabase(sqlite, { DATABASE_URL: 'file:x.db' }), false, 'the shell wins');
    assert.equal(wantsTestDatabase(sqlite, { WEBJS_TEST_DB: '0' }), false, 'opt-out');
    assert.equal(wantsTestDatabase(pg, {}), false, 'Postgres needs a real test database');
    assert.equal(wantsTestDatabase(fresh, {}), true, 'no migrations yet: the schema is pushed instead');
    // Bun loads .env before any code runs, so the scaffold's own dev url arrives
    // in process.env. That is the app's file talking, not the shell.
    writeFileSync(join(sqlite, '.env'), 'DATABASE_URL=file:./db/dev.db\n');
    assert.equal(wantsTestDatabase(sqlite, { DATABASE_URL: 'file:./db/dev.db' }), true, 'the .env url is not a shell choice');
    assert.equal(wantsTestDatabase(sqlite, { DATABASE_URL: 'file:/tmp/ci.db' }), false, 'a different url still wins');
  } finally {
    for (const d of [sqlite, pg, fresh]) rmSync(d, { recursive: true, force: true });
  }
});

test('webjs test runs a db test against a fresh migrated database and leaves db/dev.db alone', { timeout: 180_000 }, async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'webjs-testdb-app-'));
  const log = console.log;
  console.log = () => {};
  try {
    await scaffoldApp('demo', cwd, { template: 'full-stack', install: false });
  } finally {
    console.log = log;
  }
  const app = join(cwd, 'demo');
  try {
    symlinkSync(join(ROOT, 'node_modules'), join(app, 'node_modules'));
    const env = { ...process.env };
    delete env.DATABASE_URL;
    delete env.WEBJS_TEST_DB;
    // Running node --test inside node --test inherits NODE_TEST_CONTEXT, and the
    // inner run then reports to this process instead of setting its exit code.
    delete env.NODE_TEST_CONTEXT;
    rmSync(join(app, 'test'), { recursive: true, force: true });
    mkdirSync(join(app, 'test', 'users'), { recursive: true });
    writeFileSync(join(app, 'test', 'users', 'users.test.ts'),
      `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '#db/connection.server.ts';
import { users } from '#db/schema.server.ts';

test('a row round-trips through the app db', async () => {
  await db.insert(users).values({ email: 'ada@example.com', name: 'Ada' });
  const rows = await db.select({ email: users.email }).from(users);
  assert.equal(rows.length, 1);
});
`);
    const run = (extra) => spawnSync(process.execPath, [CLI, 'test', '--server'], { cwd: app, env: { ...env, ...extra }, encoding: 'utf8' });

    // Before the first migration exists, the schema is pushed (#1686: a first
    // draft's tests failed with "no such table" because no migration existed).
    const before = run({});
    assert.equal(before.status, 0, before.stdout + before.stderr);
    assert.match(before.stdout, /schema pushed \(no migrations yet\)/);
    assert.equal(existsSync(join(app, 'db', 'dev.db')), false, 'the push never touched db/dev.db');

    const gen = spawnSync(process.execPath, [CLI, 'db', 'generate'], { cwd: app, env: { ...env, DATABASE_URL: 'file:' + join(cwd, 'gen.db') }, encoding: 'utf8' });
    assert.equal(gen.status, 0, gen.stdout + gen.stderr);
    const r = run({});
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /fresh migrated test database/);
    assert.equal(existsSync(join(app, 'db', 'dev.db')), false, 'the test never touched db/dev.db');

    // A second run starts empty again: the row count assertion would fail on a reused database.
    assert.equal(run({}).status, 0, 'each run gets its own database');

    // #1697: on Node, test files run in parallel processes, and on one shared
    // file they hit `database is locked`. Each file gets its own copy, so a
    // second file inserting the same unique email still sees exactly one row.
    // `bun test` runs every file in one process, one after another, so there is
    // no lock to hit and the files share the run's database by design.
    if (!process.versions.bun) {
      writeFileSync(join(app, 'test', 'users', 'again.test.ts'),
        readFileSync(join(app, 'test', 'users', 'users.test.ts'), 'utf8'));
      const pair = run({});
      assert.equal(pair.status, 0, 'two files writing the same unique row each have their own database\n' + pair.stdout + pair.stderr);
    }

    // Counterfactual: opted out, the test runs against the unmigrated dev database and fails.
    assert.notEqual(run({ WEBJS_TEST_DB: '0' }).status, 0, 'without the test database the table does not exist');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
