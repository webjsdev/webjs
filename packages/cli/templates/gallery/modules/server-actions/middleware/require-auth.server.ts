// Per-action middleware. An action opts in with `export const middleware =
// [requireAuth]` (a reserved sibling config export), and the framework runs this
// around the action on EVERY boundary (the RPC stub and a route.ts adapter). The
// signature is `async (ctx, next) => result`, where ctx = { request, args,
// signal, context }. Whatever it writes onto ctx.context is exactly what the
// action reads back via actionContext(). This is a server-only utility (a
// .server.ts with NO 'use server'): the action imports it server-side; it never
// ships to the browser.
import type { ActionResult } from '@webjsdev/server';

export interface AuthUser {
  id: string;
  name: string;
}

// The context object the framework passes each middleware. `context` is the
// shared mutable bag actionContext() returns to the action; `args` is the
// action's argument list; `signal` is the request AbortSignal.
interface ActionMiddlewareCtx {
  request: Request;
  args: unknown[];
  signal: AbortSignal;
  context: Record<string, unknown>;
}

export async function requireAuth(ctx: ActionMiddlewareCtx, next: () => Promise<unknown>): Promise<unknown> {
  // A REAL guard reads the signed session or JWT off ctx.request, because auth
  // belongs to the request, not the payload. This gallery has no login backend on
  // the action path, so to keep BOTH branches exercisable the demo treats the
  // caller as signed in UNLESS the request asks to simulate a signed-out visitor
  // (the checkbox in the component sends { signedOut: true } in the action input).
  const [input] = ctx.args as [{ signedOut?: boolean } | undefined];
  const user: AuthUser | null = input?.signedOut ? null : { id: 'u_1', name: 'Ada' };

  // Short-circuit: return an ActionResult WITHOUT calling next(), so the action
  // never runs. On the RPC boundary the short-circuit rides as the result with its
  // status inside the envelope, and a denied call is served no-store (never cached).
  if (!user) return { success: false, error: 'Sign in to continue.', status: 401 } satisfies ActionResult<never>;

  ctx.context.user = user; // what actionContext().user reads inside the action
  return next(); // run the next middleware, ending at the action
}
