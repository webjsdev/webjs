'use server';
// A read is a 'use server' action with `method = 'GET'`: args ride the URL
// and it is CSRF-exempt. No `cache` export, so the response is no-store (the
// verb marks the read safe; `cache` is what makes it cacheable).
import { db } from '#db/connection.server.ts';
import type { Todo } from '../types.ts';

export const method = 'GET';

export async function listTodos(): Promise<Todo[]> {
  // rc.3: the relational query API with the object-form `orderBy`. An array
  // form with an imported column mis-compiles to a bad SQL alias, and
  // `db.select({ col })` trips TS2554; `db.select().from(todos)` is fine.
  const rows = await db.query.todos.findMany({ orderBy: { createdAt: 'desc' } });
  return rows as Todo[];
}
