/**
 * A schema edit reaches `db.query` without a restart (#1664), on Node and Bun.
 *
 * The scaffold used to cache the whole Drizzle instance on `globalThis`, and a
 * Drizzle instance captures `schema.relations` when it is built. On Bun the dev
 * server is one long-lived process whose module registry is reset on an edit
 * while `globalThis` survives, so the re-evaluated connection module handed back
 * the FIRST instance, and a table added during `webjs dev` stayed undefined on
 * `db.query` until a restart.
 *
 * Two scaffolded apps pointed at one SQLite file stand in for "the same
 * connection module, evaluated again after its schema changed": B's schema adds
 * a table and a relation, and B's connection is evaluated second in the same
 * process. The driver handle must be shared (one open connection per database
 * url) while B's `db` must know B's schema.
 *
 * A plain assert script so it runs under either runtime; the sibling
 * `db-relations-reload.test.mjs` wraps it for `node --test`.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { scaffoldApp } from '../../packages/cli/lib/create.js';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const cwd = await mkdtemp(join(tmpdir(), 'webjs-db-relations-'));
const log = console.log;
console.log = () => {};
try {
  await scaffoldApp('a', cwd, { template: 'api', install: false });
  await scaffoldApp('b', cwd, { template: 'api', install: false });
} finally {
  console.log = log;
}
for (const app of ['a', 'b']) await symlink(join(ROOT, 'node_modules'), join(cwd, app, 'node_modules'));

// B's schema gains a table and names it in its relations, the edit an agent
// makes while the dev server runs.
const schemaB = join(cwd, 'b', 'db', 'schema.server.ts');
let src = await readFile(schemaB, 'utf8');
assert.match(src, /defineRelations\(\{ users \}/, 'the scaffold schema has the expected relations line');
src = src.replace(
  /export const relations = defineRelations\(\{ users \}/,
  "export const notes = sqliteTable('notes', { id: integer().primaryKey({ autoIncrement: true }), body: text() });\n"
    + 'export const relations = defineRelations({ users, notes }',
);
await writeFile(schemaB, src);

process.env.DATABASE_URL = join(cwd, 'shared.db');
try {
  const connA = await import(pathToFileURL(join(cwd, 'a', 'db', 'connection.server.ts')).href);
  const connB = await import(pathToFileURL(join(cwd, 'b', 'db', 'connection.server.ts')).href);

  assert.ok(connA.db.query.users, `[${runtime}] the first connection knows its schema`);
  assert.equal(connA.db.query.notes, undefined, `[${runtime}] and not the table it never declared`);
  assert.ok(connB.db.query.notes,
    `[${runtime}] a connection evaluated after a schema edit sees the new table (it got the cached instance before #1664)`);
  assert.ok(connA.db.$client, `[${runtime}] drizzle exposes its driver handle`);
  assert.equal(connB.db.$client, connA.db.$client,
    `[${runtime}] the driver handle is reused, so a reload does not open a second connection`);

  console.log(`[db-relations-reload] a schema edit reaches db.query on ${runtime}`);
} finally {
  delete process.env.DATABASE_URL;
  await rm(cwd, { recursive: true, force: true }).catch(() => {});
}
