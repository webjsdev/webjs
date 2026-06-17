/**
 * Run the cross-runtime blog Drizzle DB round-trip proof (#551 / #563) under
 * WHICHEVER runtime executes the suite. Picked up by the root `node --test`
 * runner (so `npm test` exercises the Node / better-sqlite3 path); the CI `bun`
 * job also runs `bun test/bun/blog-db.mjs` for the Bun / bun:sqlite path. The
 * proof is a plain assert script (`blog-db.mjs`, not `*.test.mjs`, so the runner
 * does not double-run it); importing it runs it and throws on any failure.
 *
 * Skipped when the blog migration has not been generated yet (a fresh clone
 * with no db/migrations), matching the blog smoke tests.
 */
import { test } from 'node:test';
import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIG = resolve(HERE, '..', '..', 'examples', 'blog', 'db', 'migrations');
const skip = !existsSync(MIG) || !readdirSync(MIG).some((d) => /^\d/.test(d));

test(
  'blog Drizzle DB round-trips (insert/returning + relational read + Date) on this runtime (#551/#563)',
  { skip: skip && 'blog migration not generated' },
  async () => {
    await import('./blog-db.mjs');
  },
);
