/**
 * Preloaded (`node --import`) into every process `webjs test` starts on Node.
 * `node --test` runs each test file in a child process of its own, and they
 * all shared one migrated SQLite file, so two files writing at once failed
 * with `database is locked`: a transaction that upgrades from read to write
 * gets SQLITE_BUSY at once, whatever the busy timeout (#1697). Each child
 * copies the migrated template and points `DATABASE_URL` at its copy, the
 * database-per-worker shape of Rails' parallel tests. The copy lives beside
 * the template, in the directory `webjs test` removes when the run ends.
 * Bun's runner keeps every file in one process, so it never reaches here.
 *
 * @module
 */
import { copyFileSync } from 'node:fs';

const template = process.env.WEBJS_TEST_DB_TEMPLATE;
// NODE_TEST_CONTEXT is set in the per-file children only, not in the runner.
if (template && process.env.NODE_TEST_CONTEXT) {
  const own = template.replace(/\.db$/, `-${process.pid}.db`);
  copyFileSync(template, own);
  process.env.DATABASE_URL = 'file:' + own;
}
