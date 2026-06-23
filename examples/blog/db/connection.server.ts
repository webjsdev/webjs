/**
 * The Drizzle connection. The only file that opens the database driver.
 * Runtime-neutral, zero native deps: built-in bun:sqlite on Bun, built-in
 * node:sqlite on Node. Cached on
 * globalThis so a dev-server reload reuses one connection. Imported only by
 * server-only code (queries, actions, route handlers, middleware, the seed).
 */
import { isAbsolute, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.server.ts';

// Resolve a relative SQLite path against the app root (the parent of db/), not
// process.cwd(), so the connection works under `webjs dev` AND when the app is
// embedded via createRequestHandler from a different working directory.
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = process.env.DATABASE_URL?.replace(/^file:/, '') ?? 'db/dev.db';
const url = raw === ':memory:' || isAbsolute(raw) ? raw : resolve(appRoot, raw);
const g = globalThis as unknown as { __webjs_db?: unknown };

async function open() {
  if ((globalThis as { Bun?: unknown }).Bun) {
    const { Database } = await import('bun:sqlite');
    const { drizzle } = await import('drizzle-orm/bun-sqlite');
    return drizzle({ client: new Database(url), relations: schema.relations });
  }
  const { DatabaseSync } = await import('node:sqlite');
  const { drizzle } = await import('drizzle-orm/node-sqlite');
  return drizzle({ client: new DatabaseSync(url), relations: schema.relations });
}

export const db = (g.__webjs_db ??= await open()) as Awaited<ReturnType<typeof open>>;
