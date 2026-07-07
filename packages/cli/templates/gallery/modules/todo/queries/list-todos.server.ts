'use server';
// A READ is a `'use server'` action so the client (and SSR) can call it via the
// normal import (rewritten to a typed RPC stub). `method = 'GET'` rides args in
// the URL, is CSRF-exempt, and its result is SSR-seeded so the component does
// not re-fetch on hydration.
import { desc } from 'drizzle-orm';
import { db } from '#db/connection.server.ts';
import { todos } from '#db/schema.server.ts';
import type { Todo } from '../types.ts';

export const method = 'GET';

export async function listTodos(): Promise<Todo[]> {
  // rc.3 read: the relational query API. Do NOT use `db.select({ col })` (its
  // projection overload trips TS2554 in rc.3). See agent-docs/orm.md.
  const rows = await db.query.todos.findMany({ orderBy: [desc(todos.createdAt)] });
  return rows as Todo[];
}
