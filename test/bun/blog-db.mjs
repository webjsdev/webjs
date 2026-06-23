/**
 * Cross-runtime proof that the blog's Drizzle DB layer round-trips under
 * WHICHEVER runtime runs it (#551 / #563). webjs runs on Node 24+ OR Bun, and
 * the connection (examples/blog/db/connection.server.ts) branches on the
 * runtime to pick the built-in SQLite + its drizzle adapter: bun:sqlite +
 * drizzle-orm/bun-sqlite on Bun, node:sqlite + drizzle-orm/node-sqlite on
 * Node. That driver/adapter seam plus the relational query API are the surface
 * most likely to diverge across runtimes, so this script exercises them
 * directly against a throwaway DB built from the blog's REAL schema:
 *
 *   node test/bun/blog-db.mjs
 *   bun  test/bun/blog-db.mjs
 *
 * It mirrors the connection's runtime branch, applies the committed migration
 * DDL (the same `webjs db migrate` produces), then asserts the three things a
 * blog request relies on: insert().returning() yields the row, a timestamp_ms
 * column round-trips as a Date, and the relational read (db.query.* with `with`
 * + object orderBy) resolves the author relation. Run from the repo root so the
 * bare specifiers resolve to the workspace packages.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../../examples/blog/db/schema.server.ts';

const runtime = process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
const HERE = dirname(fileURLToPath(import.meta.url));
const BLOG = resolve(HERE, '..', '..', 'examples', 'blog');

// The committed migration DDL, the exact tables `webjs db migrate` applies.
const migDir = join(BLOG, 'db', 'migrations');
const sub = readdirSync(migDir).find((d) => /^\d/.test(d));
assert.ok(sub, 'a committed migration directory exists');
const ddl = readFileSync(join(migDir, sub, 'migration.sql'), 'utf8');

const dir = mkdtempSync(join(tmpdir(), 'webjs-blogdb-x-'));
const file = join(dir, 'rt.db');
try {
  // Mirror connection.server.ts's runtime branch.
  let db;
  let close;
  if (process.versions.bun) {
    const { Database } = await import('bun:sqlite');
    const { drizzle } = await import('drizzle-orm/bun-sqlite');
    const client = new Database(file);
    client.exec(ddl);
    db = drizzle({ client, relations: schema.relations });
    close = () => client.close();
  } else {
    const { DatabaseSync } = await import('node:sqlite');
    const { drizzle } = await import('drizzle-orm/node-sqlite');
    const client = new DatabaseSync(file);
    client.exec(ddl);
    db = drizzle({ client, relations: schema.relations });
    close = () => client.close();
  }

  // Write path: insert().returning() (the create-and-return shape the actions use).
  const [user] = await db
    .insert(schema.users)
    .values({ email: 'ada@example.com', passwordHash: 'x', name: 'Ada' })
    .returning();
  assert.equal(user.name, 'Ada', 'insert().returning() yields the inserted row');
  assert.ok(user.createdAt instanceof Date, 'a timestamp_ms column round-trips as a Date');

  const [post] = await db
    .insert(schema.posts)
    .values({ slug: 'hello', title: 'Hello', body: 'Body', authorId: user.id })
    .returning();
  assert.equal(post.authorId, user.id, 'a foreign key is persisted');

  // Read path: the relational query API with a `with` join + object orderBy.
  const rows = await db.query.posts.findMany({
    orderBy: { createdAt: 'desc' },
    with: { author: { columns: { name: true, email: true } } },
  });
  assert.equal(rows.length, 1, 'the post reads back');
  assert.equal(rows[0].title, 'Hello', 'columns round-trip');
  assert.equal(rows[0].author.name, 'Ada', 'the author relation resolves');

  close();
  console.log(`OK  webjs blog Drizzle DB round-trip passed on ${runtime} (insert/returning + relational read + Date column)`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
