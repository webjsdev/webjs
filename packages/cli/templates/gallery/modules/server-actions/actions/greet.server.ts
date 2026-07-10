'use server';
// A 'use server' action IS the API: a client import is rewritten to a typed RPC
// stub POSTing to the server. It may use server-only utilities (they run here,
// server-side), which is why the util above stays off the client.
import { shout } from '../utils/format.server.ts';
import { actionContext, actionSignal } from '@webjsdev/server';
import type { ActionResult } from '@webjsdev/server';

export async function greet(input: { name: string }): Promise<ActionResult<{ message: string }>> {
  // actionSignal() is the request's AbortSignal (fires on client disconnect or a
  // superseded render); bail early on long work instead of finishing wasted work.
  if (actionSignal().aborted) return { success: false, error: 'Request cancelled.', status: 499 };
  // actionContext() is the per-action middleware context (e.g. actionContext().user
  // set by an auth middleware via `export const middleware`). Empty here, no middleware.
  const who = (actionContext().user as { name?: string } | undefined)?.name;

  const name = String(input?.name ?? who ?? '').trim();
  if (!name) return { success: false, error: 'Name required.', status: 400 };
  return { success: true, data: { message: shout('hello ' + name) } };
}
