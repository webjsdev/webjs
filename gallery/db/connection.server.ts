import { isAbsolute, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.server.ts';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = process.env.DATABASE_URL?.replace(/^file:/, '') ?? 'db/dev.db';
const url = raw === ':memory:' || isAbsolute(raw) ? raw : resolve(appRoot, raw);
// Only the DRIVER handle is cached on globalThis (per database url), so a dev
// reload reuses one open connection. The Drizzle wrapper below is rebuilt each
// time this module is evaluated, because it captures schema.relations: caching
// the wrapper kept the first load's relations, so a table added while the dev
// server ran stayed undefined on db.query until a restart (#1664).
const g = globalThis as unknown as { __webjs_db_clients?: Map<string, unknown> };
const clients = (g.__webjs_db_clients ??= new Map());
function cached<T>(open: () => T): T {
  if (!clients.has(url)) clients.set(url, open());
  return clients.get(url) as T;
}

function tune<T extends { exec(sql: string): unknown }>(client: T): T {
  client.exec('PRAGMA busy_timeout = 5000');
  client.exec('PRAGMA journal_mode = WAL');
  return client;
}

async function connect() {
  if ((globalThis as { Bun?: unknown }).Bun) {
    // @ts-expect-error bun:sqlite is a Bun builtin with no Node typings
    const { Database } = await import('bun:sqlite');
    const { drizzle } = await import('drizzle-orm/bun-sqlite');
    return drizzle({ client: cached(() => tune(new Database(url))), relations: schema.relations });
  }
  const { DatabaseSync } = await import('node:sqlite');
  const { drizzle } = await import('drizzle-orm/node-sqlite');
  return drizzle({ client: cached(() => tune(new DatabaseSync(url))), relations: schema.relations });
}

export const db = await connect();
