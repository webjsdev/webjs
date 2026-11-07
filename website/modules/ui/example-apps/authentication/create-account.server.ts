'use server';

import type { ActionResult } from '@webjsdev/server';

/**
 * The authentication example's form action (#1666). shadcn's example only
 * fakes a three-second loading state; this one is the WebJs shape of the same
 * form, a server action the form binds, so it submits with JavaScript off.
 * It checks the address and sends nothing: an invalid one re-renders the page
 * with the error and the typed value, a valid one redirects back with a
 * confirmation. A real app would create the account and send the link here.
 */
export async function createAccount(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, fieldErrors: { email: 'Enter a valid email address.' }, values: { email } };
  }
  return { success: true, redirect: '/ui/examples/authentication?sent=1' };
}
