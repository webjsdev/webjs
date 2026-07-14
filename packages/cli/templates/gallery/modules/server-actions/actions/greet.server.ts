'use server';
// A 'use server' action IS the API: a client import is rewritten to a typed RPC
// stub POSTing to the server. It may use server-only utilities (they run here,
// server-side), which is why the shout() util stays off the client.
import { shout } from '../utils/format.server.ts';
import { actionContext, actionSignal } from '@webjsdev/server';
import type { ActionResult } from '@webjsdev/server';
import { requireAuth, type AuthUser } from '../middleware/require-auth.server.ts';

// `export const middleware` is a reserved sibling config export the framework
// reads statically (the same way a page declares `export const revalidate`). The
// chain runs around greet() on every boundary: requireAuth either short-circuits
// (the action never runs) or stashes the caller on the request context.
export const middleware = [requireAuth];

export async function greet(input: { name: string; signedOut?: boolean }): Promise<ActionResult<{ message: string }>> {
  // Non-empty and typed: requireAuth guaranteed a user before greet() ran (a
  // signed-out request short-circuited and never reached here), so no optional
  // chaining, the middleware contract owns the type. NOTE actionContext() is only
  // populated on a boundary that runs the chain; a direct server-to-server greet()
  // call skips middleware and would read an empty context, so a server-internal
  // caller should pass the caller in explicitly rather than rely on it.
  const who = (actionContext().user as AuthUser).name;

  const name = String(input?.name ?? '').trim();
  if (!name) return { success: false, error: 'Name required.', status: 400 };

  // actionSignal() is the request's AbortSignal (fires on a client disconnect or a
  // superseded render). Thread it into the awaited work and re-check AFTER, so a
  // slow action stops wasted work. This is the real use: a guard BEFORE any await
  // can never have fired yet, since nothing has been awaited.
  const message = await compose(name, who, actionSignal());
  if (actionSignal().aborted) return { success: false, error: 'Request cancelled.', status: 499 };

  return { success: true, data: { message } };
}

// A private (non-exported) stand-in for a slow lookup or upstream fetch that
// honours the signal (a real fetch would pass { signal }). Not exported, so the
// file still has exactly one action (the one-action-per-configured-file rule).
async function compose(name: string, who: string, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw new Error('aborted');
  return shout('hello ' + name) + ' (greeted by ' + who + ')';
}
