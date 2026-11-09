// Code typed the way agents write it (#1686): each block below is taken from a
// first draft that an eval build wrote and that failed `webjs typecheck` on a
// WebJs type, not on the agent's own logic. It must compile clean with no
// casts. The rule from now on: an eval typecheck failure caused by a framework
// type adds a block here, beside the fix that made it compile.
import { getRequest, getSession, Credentials, GitHub, cookies, headers, createRequestHandler } from '@webjsdev/server';
import { testRequest, loginAndGetCookies, submitForm } from '@webjsdev/server/testing';
import type { ActionResult, AuthConfig, AuthInstance, Session } from '@webjsdev/server';
import type { LayoutProps, PageProps, RouteHandlerContext } from '@webjsdev/core';

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

// Route props the Next.js 15 way and the Next.js 14 way, and the route-handler
// context written inline as Next documents it. (Plan workstream 3, #1686.)
export async function routePropHabits(
  { params, searchParams }: PageProps<'/rooms/[id]'>,
  layout: LayoutProps,
  untyped: PageProps,
) {
  const { id } = await params;
  const sync: string = params.id;
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const slug: string = untyped.params.slug ?? '';
  return [id, sync, q, slug, layout.children];
}
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json({ id, url: req.url });
}
export async function handlerContextHabit(req: Request, ctx: RouteHandlerContext<'/api/rooms/[id]'>) {
  const { id } = await ctx.params;
  return new Response(id + req.method);
}

// Request-scope readers and the test helpers, as an app's server tests call them.
export async function requestHabits() {
  const ua = getRequest()?.headers.get('user-agent') ?? '';
  const fromHeaders = (await headers()).get('accept') ?? headers().get('accept');
  const theme: string = cookies().get('theme')?.value ?? 'light';
  const app = await createRequestHandler({ appDir: '.', dev: true });
  const res = await testRequest(app.handle, '/');
  const { cookies: jar } = await loginAndGetCookies(app.handle, { email: 'a@b.c', password: 'secret-123' });
  const sent = await submitForm(app.handle, '/rooms/1', { day: '2026-11-10', hours: ['1', '2'] }, { cookies: jar });
  return [ua, fromHeaders, theme, res.status, sent.headers.get('location')];
}
