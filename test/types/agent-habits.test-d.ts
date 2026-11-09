// Code typed the way agents write it (#1686): each block below is taken from a
// first draft that an eval build wrote and that failed `webjs typecheck` on a
// WebJs type, not on the agent's own logic. It must compile clean with no
// casts. The rule from now on: an eval typecheck failure caused by a framework
// type adds a block here, beside the fix that made it compile.
import { getRequest, getSession, Credentials, GitHub } from '@webjsdev/server';
import type { ActionResult, AuthConfig, AuthInstance, Session } from '@webjsdev/server';
import type { PageProps } from '@webjsdev/core';

// getSession() reads the request in scope, the way cookies() and headers() do.
// Agents also chained the two WebJs calls, getSession(getRequest()), and
// getRequest() is nullable outside a request, so the parameter accepts it.
// (Replay r3-before-pollster2: a page and two actions.)
export function sessionHabits(): Session[] {
  const a = getSession();
  const b = getSession(getRequest());
  a.flash('manage', { slug: 'x', key: 'k' });
  return [a, b];
}

// actionData.fieldErrors read into the agent's own Record<string, string>: the
// page cannot see the action's return type, so the field is as loose as data.
// (Replay r4-after-roomly2: two pages.)
export function fieldErrorHabits({ actionData }: PageProps<'/rooms/[id]'>): string {
  const errors: Record<string, string> = actionData?.fieldErrors ?? {};
  const values = actionData?.values ?? {};
  return (errors.day ?? '') + (values.day ?? '');
}

// Auth.js's signIn redirects by throwing, so an action returns it as is, and
// redirect: false (in the options or in the data) yields the target url.
// (Replay r3-before-roomly3: a sign-up action.)
export async function signInHabits(
  signIn: AuthInstance['signIn'],
  signOut: AuthInstance['signOut'],
  form: FormData,
): Promise<ActionResult | Response> {
  const url: string = await signIn('credentials', form, { redirect: false });
  const url2: string = await signIn('credentials', { email: 'a@b.c', redirect: false });
  const out: string = await signOut({ redirect: false });
  void [url, url2, out];
  if (form.has('x')) return signOut({ redirectTo: '/' });
  return signIn('credentials', { email: 'a@b.c' }, { redirectTo: '/rooms' });
}

// Auth.js's auth as middleware and as a middleware wrapper, with the
// authorized callback and a provider passed uncalled. (Auth.js habits, #1686.)
export function authMiddlewareHabits(instance: AuthInstance) {
  const middleware = instance.auth;
  const wrapped = instance.auth((req) => {
    if (!req.auth) return Response.redirect(new URL('/login', req.url));
    return undefined;
  });
  const config: AuthConfig = {
    providers: [GitHub, Credentials({ authorize: async () => null })],
    callbacks: { authorized: ({ auth }) => !!auth },
  };
  return [middleware, wrapped, config];
}
