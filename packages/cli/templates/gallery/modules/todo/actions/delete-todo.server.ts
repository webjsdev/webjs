'use server';
import { eq } from 'drizzle-orm';
import { db } from '#db/connection.server.ts';
import { todos } from '#db/schema.server.ts';
import type { ActionResult } from '@webjsdev/server';

export async function deleteTodo(input: { id: string }): Promise<ActionResult<{ id: string }>> {
  const id = String(input?.id ?? '');
  if (!id) return { success: false, error: 'Missing id.', status: 400 };
  await db.delete(todos).where(eq(todos.id, id));
  return { success: true, data: { id } };
}
