// Code typed the way agents write it (#1686): each block below is taken from a
// first draft that an eval build wrote and that failed `webjs typecheck` on a
// WebJs type, not on the agent's own logic. It must compile clean with no
// casts. The rule from now on: an eval typecheck failure caused by a framework
// type adds a block here, beside the fix that made it compile.
import { createAuth, notFound, forbidden, getRequest, getSession, Credentials, GitHub, cookies, headers, createRequestHandler, revalidateTag } from '@webjsdev/server';
import { testRequest, loginAndGetCookies, submitForm } from '@webjsdev/server/testing';
import type { ActionResult, AuthConfig, AuthInstance, Session } from '@webjsdev/server';
import type { GenerateMetadata, LayoutProps, PageProps, RouteHandlerContext } from '@webjsdev/core';
import { defaultConverter, notEqual, WebComponent, prop } from '@webjsdev/core';

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

// Auth.js's session and jwt callbacks written with no annotations, as the
// Auth.js docs write them: every parameter is typed from the config. (Inbox
// eval build, #1686.)
export const callbackHabits = createAuth({
  providers: [Credentials({ authorize: async (c) => (c.email ? { id: '1', email: String(c.email) } : null) })],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      return { ...session, user: { ...session.user, id: String(token.id ?? token.sub) } };
    },
    signIn({ user }) {
      return Boolean(user.email);
    },
  },
});

// ActionResult the way the inbox eval builds wrote it (#1686): a shared bare
// `ActionResult` failure returned from a typed action, and the failure fields
// read before narrowing on `success`.
const NOT_FOUND: ActionResult = { success: false, error: 'Not found.', status: 404 };
export async function typedAction(found: boolean): Promise<ActionResult<{ id: number }>> {
  if (!found) return NOT_FOUND;
  return { success: true, data: { id: 1 } };
}
export function readFailure(result: ActionResult<{ id: number }>): string | undefined {
  const id: number | undefined = result.success ? result.data?.id : undefined;
  return id === undefined ? result.error ?? result.fieldErrors?.body : undefined;
}

// notFound() / forbidden() imported from the server package in a server
// action, where an agent writing server code reaches first (#1686).
export async function guardedAction(found: boolean, allowed: boolean): Promise<string> {
  if (!found) notFound();
  if (!allowed) forbidden();
  return 'ok';
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
  // headers() is read-only, as Next's is: a write is a type error, not a runtime surprise.
  // @ts-expect-error set is not on ReadonlyHeaders
  headers().set('x-a', '1');
  for (const [k] of headers()) void k;
  const theme: string = cookies().get('theme')?.value ?? 'light';
  const app = await createRequestHandler({ appDir: '.', dev: true });
  const res = await testRequest(app.handle, '/');
  const { cookies: jar } = await loginAndGetCookies(app.handle, { email: 'a@b.c', password: 'secret-123' });
  const sent = await submitForm(app.handle, '/rooms/1', { day: '2026-11-10', hours: ['1', '2'] }, { cookies: jar });
  return [ua, fromHeaders, theme, res.status, sent.headers.get('location')];
}

// Next.js 16 passes a cache-life profile to revalidateTag; the one-argument
// form is what Next.js 15 taught. Both compile.
export async function revalidateHabits() {
  await revalidateTag('posts', 'max');
  await revalidateTag('posts', { expire: 3600 });
  await revalidateTag('posts');
}

// Lit's defaultConverter and notEqual, imported from @webjsdev/core as from
// lit: a converter that delegates to the default, and a custom hasChanged.
export const litHelperHabits = {
  converter: {
    fromAttribute: (value: string | null) => (value ? new Date(value) : defaultConverter.fromAttribute(value, String)),
  },
  hasChanged: (value: unknown, old: unknown) => notEqual(value, old),
};

// generateMetadata written the Next.js way, typed through GenerateMetadata.
export const generateMetadataHabit: GenerateMetadata = async ({ params }, parent) => {
  const images = (await parent).openGraph?.images ?? [];
  return { title: params.slug ?? 'Not found', openGraph: { images } };
};

// Internal state with no default is undefined until set, as Lit's
// `@state() error?: string` (#1686, the micro-eval todos draft): clearing it
// with undefined type-checks, while a default makes it a plain string.
export class StateHabit extends WebComponent({
  todoId: prop(Number, { attribute: 'todo-id' }),
  error: prop<string>({ state: true }),
  label: prop<string>({ state: true, default: '' }),
}) {
  clear() {
    this.error = undefined;
    const id: number = this.todoId;
    const text: string = this.label;
    // @ts-expect-error a state prop with a default is never undefined
    this.label = undefined;
    return [id, text];
  }
}
