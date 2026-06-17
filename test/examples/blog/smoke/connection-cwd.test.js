/**
 * Regression guard: the Drizzle SQLite connection must resolve a relative
 * DATABASE_URL / default path against the APP ROOT, not process.cwd().
 *
 * The blog is booted here via createRequestHandler (the embedded host shape:
 * Express / Fastify / Bun / Deno) from the REPO-ROOT working directory, NOT
 * from examples/blog. A cwd-relative `db/dev.db` resolves to <repo>/db/dev.db,
 * whose directory does not exist, so better-sqlite3 throws "Cannot open
 * database because the directory does not exist" and every DB-backed route
 * 500s. Prisma resolved `file:` URLs relative to the schema location, so it was
 * cwd-robust; the Drizzle connection restores that by resolving against the
 * module's own location (db/connection.server.ts -> app root).
 *
 * Counterfactual: revert db/connection.server.ts to `?? 'db/dev.db'` (no
 * appRoot resolve) and this test goes red (500 on /api/posts), while a run
 * from inside examples/blog would still pass, which is exactly why the bug
 * slipped the spawn-based smoke test (it runs with cwd = examples/blog).
 *
 * Skipped when the blog DB has not been migrated (a fresh clone with no
 * db/dev.db), matching blog-smoke.test.js.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..', '..', '..');
const BLOG_DIR = resolve(ROOT, 'examples', 'blog');

const skip =
  !existsSync(resolve(BLOG_DIR, 'package.json')) ||
  !existsSync(resolve(BLOG_DIR, 'db', 'dev.db'));

describe('Blog connection resolves DB path against the app root, not cwd', { skip: skip && 'blog or its DB not present' }, () => {
  /** @type {(req: Request) => Promise<Response>} */
  let handle;

  before(async () => {
    // Intentionally do NOT chdir into the blog: createRequestHandler runs from
    // the test runner's cwd (the repo root), the embedded-host scenario.
    const app = await createRequestHandler({ appDir: BLOG_DIR, dev: false });
    handle = app.handle;
  });

  test('a DB-backed route returns 200, not a 500 from a misresolved sqlite path', async () => {
    const res = await handle(new Request('http://localhost/api/posts'));
    const body = await res.text();
    assert.equal(
      res.status,
      200,
      `expected /api/posts 200 from a foreign cwd, got ${res.status}: ${body.slice(0, 300)}`,
    );
    assert.doesNotMatch(
      body,
      /directory does not exist|no such table/i,
      'response must not carry a sqlite path-resolution error',
    );
  });
});
