/**
 * The Drizzle connection. The only file that opens the database driver.
 * Runtime-neutral: native bun:sqlite on Bun, better-sqlite3 on Node. Cached on
 * globalThis so a dev-server reload reuses one connection. Imported only by
 * server-only code (queries, actions, route handlers, middleware, the seed).
 */
import * as schema from './schema.server.ts';

const url = process.env.DATABASE_URL?.replace(/^file:/, '') ?? 'db/dev.db';
const g = globalThis as unknown as { __webjs_db?: unknown };

async function open() {
  if ((globalThis as { Bun?: unknown }).Bun) {
    const { Database } = await import('bun:sqlite');
    const { drizzle } = await import('drizzle-orm/bun-sqlite');
    return drizzle({ client: new Database(url), relations: schema.relations });
  }
  const { default: Database } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  return drizzle({ client: new Database(url), relations: schema.relations });
}

export const db = (g.__webjs_db ??= await open()) as Awaited<ReturnType<typeof open>>;
