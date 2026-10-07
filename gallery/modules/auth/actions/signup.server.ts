'use server';

import { db } from '#db/connection.server.ts';
import { users } from '#db/schema.server.ts';
import { hash } from '../password.server.ts';
import { signIn } from '../auth.server.ts';

// The signup form's action, so it receives the FormData and validates here. A
// failure returns fieldErrors and values (a 422 re-render with the typed input
// kept); a success returns signIn's 302 Response carrying the session cookie,
// which the framework honors verbatim.
export async function signup(formData: FormData) {
  const name = String(formData.get('name') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const values = { name, email };
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Name is required';
  if (!email.includes('@')) fieldErrors.email = 'Enter a valid email';
  if (password.length < 8) fieldErrors.password = 'At least 8 characters';
  if (Object.keys(fieldErrors).length) return { success: false as const, fieldErrors, values, status: 422 };

  const exists = await db.query.users.findFirst({ where: { email }, columns: { id: true } });
  if (exists) {
    return { success: false as const, fieldErrors: { email: 'Email already registered' }, values, status: 409 };
  }
  await db.insert(users).values({ name, email, passwordHash: await hash(password) });
  return signIn('credentials', { email, password }, { redirectTo: '/features/auth/dashboard' });
}
