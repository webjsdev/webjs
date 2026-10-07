import { auth } from '#modules/auth/auth.server.ts';

// The protected-route gate: a per-segment middleware runs for every request
// under this folder and 302s to login before the page renders. auth(req) is a
// cookie read, no database query.
export default async function requireAuth(req: Request, next: () => Promise<Response>) {
  const session = await auth(req);
  if (!session?.user) {
    return new Response(null, { status: 302, headers: { location: '/features/auth/login' } });
  }
  return next();
}
