'use server';
// A 'use server' action IS the API: a client import is rewritten to a typed RPC
// stub POSTing to the server. It may use server-only utilities (they run here,
// server-side), which is why the util above stays off the client.
import { shout } from '../utils/format.server.ts';
import type { ActionResult } from '@webjsdev/server';

export async function greet(input: { name: string }): Promise<ActionResult<{ message: string }>> {
  const name = String(input?.name ?? '').trim();
  if (!name) return { success: false, error: 'Name required.', status: 400 };
  return { success: true, data: { message: shout('hello ' + name) } };
}
