'use server';

import { cookies } from '@webjsdev/server';
import { getUserByToken, SESSION_COOKIE } from '#lib/session.server.ts';
import type { PublicUser } from '#modules/auth/types.ts';

/**
 * Resolve the currently-logged-in user from the in-flight Request's
 * session cookie. Relies on `cookies()` from @webjsdev/server which reads
 * the AsyncLocalStorage-backed request context.
 */
export async function currentUser(): Promise<PublicUser | null> {
  const token = cookies().get(SESSION_COOKIE);
  const user = await getUserByToken(token);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}
