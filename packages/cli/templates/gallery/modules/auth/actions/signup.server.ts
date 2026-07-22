'use server';

import { db } from '#db/connection.server.ts';
import { users } from '#db/schema.server.ts';
import { hash } from '../password.server.ts';
import { signIn } from '../auth.server.ts';

// Creates the account, then signs the new user in and lands on the dashboard.
// signIn returns a 302 Response carrying the session cookie; the signup page
// action returns that Response as-is (a page action may return a Response).
// signIn lives in the server-only auth module, imported here server-to-server,
// so it never reaches the browser (the signup page only imports this action's
// RPC stub).
export async function signup(input: { name: string; email: string; password: string }) {
  const exists = await db.query.users.findFirst({ where: { email: input.email }, columns: { id: true } });
  if (exists) return { success: false as const, error: 'Email already registered', status: 409 };
  await db.insert(users).values({ name: input.name, email: input.email, passwordHash: await hash(input.password) });
  return signIn('credentials', { email: input.email, password: input.password }, { redirectTo: '/features/auth/dashboard' });
}
