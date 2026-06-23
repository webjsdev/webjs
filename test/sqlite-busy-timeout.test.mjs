// Guards the #673 fix: the SQLite connection must set `busy_timeout` so a
// contended write WAITS instead of throwing `database is locked`. node:sqlite
// (and bun:sqlite) default busy_timeout to 0; better-sqlite3 used 5000ms, and
// dropping it (#670) reintroduced intermittent "database is locked" flakes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('busy_timeout: default is 0, and a contended write throws without it (the bug)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wjs-bt-'));
  const file = join(dir, 'test.db');
  try {
    const a = new DatabaseSync(file);
    a.exec('PRAGMA journal_mode = WAL');
    a.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    a.exec('BEGIN IMMEDIATE'); // hold a write lock
    a.exec("INSERT INTO t (v) VALUES ('a')");

    const b = new DatabaseSync(file);
    // Counterfactual: the default busy_timeout is 0, so a write contended
    // against A's lock throws immediately. This is the regression condition.
    assert.equal(b.prepare('PRAGMA busy_timeout').get().timeout, 0);
    assert.throws(() => b.exec("INSERT INTO t (v) VALUES ('b')"), /database is locked/);
    b.close();
    a.exec('COMMIT');
    a.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('busy_timeout: the connection tune sets busy_timeout=5000 and WAL (the fix)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wjs-bt-'));
  const file = join(dir, 'test.db');
  try {
    // Mirror what the connection does (db/connection.server.ts `tune`).
    const c = new DatabaseSync(file);
    c.exec('PRAGMA busy_timeout = 5000');
    c.exec('PRAGMA journal_mode = WAL');
    assert.equal(c.prepare('PRAGMA busy_timeout').get().timeout, 5000);
    assert.equal(String(c.prepare('PRAGMA journal_mode').get().journal_mode).toLowerCase(), 'wal');
    c.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
