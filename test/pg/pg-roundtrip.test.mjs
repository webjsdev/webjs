/**
 * Postgres prod-engine round-trip (#563). The cross-database abstraction makes
 * the schema, queries, and actions PORTABLE, but migrations and runtime
 * behavior are per-dialect, so the promise that "the same code runs on
 * Postgres" must be proven against a REAL Postgres, not inferred from SQLite.
 * This test builds the unified schema with the Postgres column module
 * (schema.pg.ts -> columns.pg.ts, the pg variant `webjs create --db postgres`
 * materializes), connects with `pg` + drizzle-orm/node-postgres (the scaffold's
 * pg connection), and round-trips the same surface the SQLite blog test covers:
 * insert().returning(), a timestamptz column as a Date, and the relational
 * db.query.* read with a `with` join + object orderBy.
 *
 * Gated on WEBJS_PG_URL so it SKIPS locally and runs only where a Postgres is
 * provisioned (the CI `db-postgres` job's service container). Run locally with:
 *   docker run -d -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=webjs_test -p 55432:5432 postgres:16
 *   WEBJS_PG_URL=postgres://postgres:postgres@localhost:55432/webjs_test \
 *     node --test test/pg/pg-roundtrip.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const PG_URL = process.env.WEBJS_PG_URL;

test(
  'the unified schema round-trips on a real Postgres (insert/returning + relational read + Date) (#563)',
  { skip: !PG_URL && 'set WEBJS_PG_URL to run (CI provisions a Postgres service)' },
  async () => {
    const { default: pg } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');
    const schema = await import('./schema.pg.ts');

    const pool = new pg.Pool({ connectionString: PG_URL });
    try {
      // Fresh tables (the pg DDL for the unified schema; snake_case casing).
      await pool.query('DROP TABLE IF EXISTS posts, users CASCADE');
      await pool.query(`
        CREATE TABLE users (
          id serial PRIMARY KEY,
          email text NOT NULL UNIQUE,
          name text,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE posts (
          id serial PRIMARY KEY,
          slug text NOT NULL UNIQUE,
          title text NOT NULL,
          author_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);

      const db = drizzle({ client: pool, relations: schema.relations });

      // Write path: insert().returning() (Postgres natively supports RETURNING).
      const [user] = await db
        .insert(schema.users)
        .values({ email: 'ada@example.com', name: 'Ada' })
        .returning();
      assert.equal(user.name, 'Ada', 'insert().returning() yields the row on Postgres');
      assert.ok(user.createdAt instanceof Date, 'a timestamptz column round-trips as a Date');

      const [post] = await db
        .insert(schema.posts)
        .values({ slug: 'hello', title: 'Hello', authorId: user.id })
        .returning();
      assert.equal(post.authorId, user.id, 'a foreign key is persisted');

      // Read path: the relational query API with a `with` join + object orderBy.
      const rows = await db.query.posts.findMany({
        orderBy: { createdAt: 'desc' },
        with: { author: { columns: { name: true, email: true } } },
      });
      assert.equal(rows.length, 1, 'the post reads back');
      assert.equal(rows[0].title, 'Hello', 'columns round-trip');
      assert.equal(rows[0].author.name, 'Ada', 'the author relation resolves on Postgres');
    } finally {
      await pool.end();
    }
  },
);
