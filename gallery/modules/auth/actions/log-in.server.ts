'use server';

import { AuthError } from '@webjsdev/server';
import { signIn } from '../auth.server.ts';

// The action the login <form> is bound to, written the way Auth.js has it in a
// Next.js app. On success signIn sets the session cookie and throws a redirect
// to the dashboard, which a form action answers with a 303, so it works with
// JavaScript off. A wrong password throws CredentialsSignin, an AuthError: the
// catch turns it into a message, and the page re-renders with it on
// actionData. Anything else (the success redirect above all) is rethrown.
export async function logIn(formData: FormData) {
  try {
    await signIn('credentials', formData, { redirectTo: '/features/auth/dashboard' });
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false as const, error: 'Invalid email or password.', values: { email: String(formData.get('email') || '') } };
    }
    throw error;
  }
}
