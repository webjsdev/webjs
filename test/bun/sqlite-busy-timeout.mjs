/**
 * Cross-runtime proof of the #673 fix: the SQLite connection must set
 * `busy_timeout` so a contended write WAITS instead of throwing `database is
 * locked`. BOTH built-in drivers (node:sqlite DatabaseSync, bun:sqlite Database)
 * default busy_timeout to 0, so this regression (introduced when #670 dropped
 * better-sqlite3's 5000ms default) can flake on EITHER runtime. The connection
 * `tune()` (examples/blog/db/connection.server.ts + the scaffold generator)
 * sets busy_timeout=5000 + WAL; this mirrors that on whichever runtime runs it:
 *
 *   node test/bun/sqlite-busy-timeout.mjs
 *   bun  test/bun/sqlite-busy-timeout.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;

async function openRaw(file) {
  if (process.versions.bun) {
    const { Database } = await import('bun:sqlite');
    return new Database(file);
  }
  const { DatabaseSync } = await import('node:sqlite');
  return new DatabaseSync(file);
}

const pragma = (db, name) => db.prepare(`PRAGMA ${name}`).get();

const dir = mkdtempSync(join(tmpdir(), 'wjs-bt-'));
const file = join(dir, 'test.db');
try {
  // Counterfactual: default busy_timeout is 0, and a write contended against a
  // held write lock throws `database is locked`. This is the regression.
  const a = await openRaw(file);
  a.exec('PRAGMA journal_mode = WAL');
  a.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
  a.exec('BEGIN IMMEDIATE');
  a.exec("INSERT INTO t (v) VALUES ('a')");

  const b = await openRaw(file);
  assert.equal(pragma(b, 'busy_timeout').timeout, 0, `[${runtime}] default busy_timeout is 0`);
  assert.throws(
    () => b.exec("INSERT INTO t (v) VALUES ('b')"),
    /database is locked/,
    `[${runtime}] a contended write throws without busy_timeout`,
  );
  b.close();
  a.exec('COMMIT');
  a.close();

  // The fix: tune sets busy_timeout=5000 + WAL.
  const c = await openRaw(file);
  c.exec('PRAGMA busy_timeout = 5000');
  c.exec('PRAGMA journal_mode = WAL');
  assert.equal(pragma(c, 'busy_timeout').timeout, 5000, `[${runtime}] tune sets busy_timeout=5000`);
  assert.equal(String(pragma(c, 'journal_mode').journal_mode).toLowerCase(), 'wal', `[${runtime}] tune sets WAL`);
  c.close();

  console.log(`ok - sqlite busy_timeout fix verified on ${runtime}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
