/**
 * The authentication generator's pages, gate and test: log in, sign up, log
 * out, and the `app/middleware.ts` that requires a session on every route but
 * its public list.
 */
/** @typedef {import('./index.js').AppContext} AppContext */

const PLAIN_INPUT = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm';
const PLAIN_LABEL = 'text-sm font-medium';
const PLAIN_BUTTON = 'inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground';
const PLAIN_OUTLINE = 'inline-flex items-center rounded-md border border-input px-4 py-2 text-sm font-medium';
// While a bound form submits, the client router sets aria-busy on it; its
// submit button dims and ignores a second click. Unused with JavaScript off.
const PENDING = 'group-aria-busy:opacity-50 group-aria-busy:pointer-events-none';

/**
 * The `class=...` attribute for each control: the UI kit helper when the app
 * has it, plain Tailwind otherwise.
 * @param {AppContext} ctx
 * @returns {Record<'input'|'label'|'submit'|'submitOutline', string>}
 */
function uiClasses(ctx) {
  return {
    input: ctx.ui.input ? 'class=${inputClass()}' : `class="${PLAIN_INPUT}"`,
    label: ctx.ui.label ? 'class=${labelClass()}' : `class="${PLAIN_LABEL}"`,
    submit: ctx.ui.button ? `class="\${buttonClass()} ${PENDING}"` : `class="${PLAIN_BUTTON} ${PENDING}"`,
    submitOutline: ctx.ui.button ? `class="\${buttonClass({ variant: 'outline' })} ${PENDING}"` : `class="${PLAIN_OUTLINE} ${PENDING}"`,
  };
}

/**
 * @param {AppContext} ctx
 * @returns {{ path: string, content: string }[]}
 */
export function authPageFiles(ctx) {
  const cls = uiClasses(ctx);
  const imports = [
    ctx.ui.button ? "import { buttonClass } from '#components/ui/button.ts';" : '',
    ctx.ui.input ? "import { inputClass } from '#components/ui/input.ts';" : '',
    ctx.ui.label ? "import { labelClass } from '#components/ui/label.ts';" : '',
  ].filter(Boolean).join('\n');
  const field = (/** @type {string} */ name, /** @type {string} */ label, /** @type {string} */ attrs, /** @type {boolean} */ errors) => `        <div class="grid gap-2">
          <label ${cls.label} for="${name}">${label}</label>
          <input ${cls.input} id="${name}" name="${name}" ${attrs} required${errors ? `
            aria-invalid=\${errors.${name} ? 'true' : nothing} aria-describedby=\${errors.${name} ? '${name}-error' : nothing}>
          \${errors.${name} ? html\`<p id="${name}-error" role="alert" class="text-sm text-destructive m-0">\${errors.${name}}</p>\` : nothing}` : '>'}
        </div>`;

  const login = `import { html, nothing } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
${imports}
import { logIn } from '#modules/auth/actions/log-in.server.ts';

export const metadata = { title: 'Log in' };

// A wrong password re-renders this page with the action's message on
// actionData. ?error= comes from a sign-in that failed outside this form.
export default function LogInPage({ actionData, searchParams }: PageProps<'/login'>) {
  const error = actionData?.error ?? (searchParams.error ? 'Wrong email or password.' : null);
  return html\`
    <section class="mx-auto max-w-sm grid gap-6 py-10">
      <h1 class="text-2xl font-semibold m-0">Log in</h1>
      \${error ? html\`<p role="alert" class="text-sm text-destructive m-0">\${error}</p>\` : nothing}
      <form action=\${logIn} class="group grid gap-4">
${field('email', 'Email', "type=\"email\" autocomplete=\"email\" value=${actionData?.values?.email ?? ''}", false)}
${field('password', 'Password', 'type="password" autocomplete="current-password"', false)}
        <button ${cls.submit} type="submit">Log in</button>
      </form>
      <p class="text-sm text-muted-foreground m-0">No account yet? <a class="underline" href="/signup">Sign up</a></p>
    </section>
  \`;
}
`;

  const signup = `import { html, nothing } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
${imports}
import { signUp } from '#modules/auth/actions/sign-up.server.ts';

export const metadata = { title: 'Sign up' };

// A failed sign-up re-renders this page with a message per field and the typed
// email on actionData.
export default function SignUpPage({ actionData }: PageProps<'/signup'>) {
  const errors = actionData?.fieldErrors ?? {};
  return html\`
    <section class="mx-auto max-w-sm grid gap-6 py-10">
      <h1 class="text-2xl font-semibold m-0">Sign up</h1>
      <form action=\${signUp} class="group grid gap-4">
${field('email', 'Email', "type=\"email\" autocomplete=\"email\" value=${actionData?.values?.email ?? ''}", true)}
${field('password', 'Password', 'type="password" autocomplete="new-password" minlength="8"', true)}
        <button ${cls.submit} type="submit">Create account</button>
      </form>
      <p class="text-sm text-muted-foreground m-0">Already have an account? <a class="underline" href="/login">Log in</a></p>
    </section>
  \`;
}
`;

  const logout = `import { html } from '@webjsdev/core';
${ctx.ui.button ? "import { buttonClass } from '#components/ui/button.ts';\n" : ''}import { currentUser } from '#modules/auth/queries/current-user.server.ts';
import { logOut } from '#modules/auth/actions/log-out.server.ts';

export const metadata = { title: 'Log out' };

// Link here from your layout (<a href="/logout">), or put this same form in
// it: any form bound to logOut logs out. Signed in only, like every page
// app/middleware.ts does not list as public.
export default async function LogOutPage() {
  const user = await currentUser();
  return html\`
    <section class="mx-auto max-w-sm grid gap-6 py-10">
      <h1 class="text-2xl font-semibold m-0">Log out</h1>
      <p class="m-0">Signed in as \${user?.email}.</p>
      <form action=\${logOut} class="group">
        <button ${cls.submitOutline} type="submit">Log out</button>
      </form>
    </section>
  \`;
}
`;

  const files = [
    { path: 'app/login/page.ts', content: login },
    { path: 'app/signup/page.ts', content: signup },
    { path: 'app/logout/page.ts', content: logout },
    { path: 'app/middleware.ts', content: MIDDLEWARE },
  ];
  if (!ctx.skipTests) files.push({ path: 'test/auth/auth.test.ts', content: TEST });
  return files;
}

/**
 * The root segment's middleware: it wraps every page, form post and route.ts
 * handler in the app, and nothing else (static files, /__webjs/ and metadata
 * routes are served before segment middleware), so the public list never
 * needs an asset in it.
 */
export const MIDDLEWARE = `import { auth, signedInPath } from '#modules/auth/auth.server.ts';

// Rails' require_authentication, the Next.js way. A middleware.ts at the root
// of app/ runs before every page, form post and route.ts handler, so a
// signed-out visitor goes to /login before anything renders. Gate here rather
// than in a layout: a page renders before its layouts, and a client navigation
// skips the layouts the browser already has. Static files, the client runtime
// (/__webjs/) and metadata routes (robots.txt, sitemap.xml, icons) never pass
// through it. Neither does an action a component calls directly, so check
// await currentUser() inside an action that needs a user.

// What anyone may open signed out, Rails' allow_unauthenticated_access. Each
// entry matches that path and every path below it ('/api/auth' covers
// /api/auth/session); '/' matches the home page alone. Add your own public
// pages here: '/' for a landing page, '/about', '/blog'.
const publicPaths = ['/login', '/signup', '/api/auth'];

const isPublic = (path: string) =>
  publicPaths.some((p) => path === p || (p !== '/' && path.startsWith(p + '/')));

export default async function middleware(request: Request) {
  const path = new URL(request.url).pathname.replace(/(.)\\/+$/, '$1');
  if (isPublic(path)) {
    // A signed-in visitor has no use for the log-in and sign-up pages.
    if (request.method === 'GET' && (path === '/login' || path === '/signup') && (await auth(request))) {
      return Response.redirect(new URL(signedInPath, request.url), 302);
    }
    return;
  }
  if (!(await auth(request))) return Response.redirect(new URL('/login', request.url), 302);
}
`;

const TEST = `// The authentication generator's test: the sign-in gate, sign up, log out and
// in again, each through the real request handler and the forms a browser with
// JavaScript off submits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { submitForm, testRequest, getSetCookies, cookiesToHeader } from '@webjsdev/server/testing';
import { signedInPath } from '#modules/auth/auth.server.ts';

const app = await createRequestHandler({ appDir: fileURLToPath(new URL('../..', import.meta.url)), dev: true });
const email = 'ada-' + Date.now() + '@example.com';
const password = 'correct horse battery';
const pathOf = (res: Response) => new URL(res.headers.get('location') ?? '', 'http://localhost').pathname;
const withCookie = (cookie: string) => ({ headers: { cookie } });
// Any form bound to logOut, whether it sits on /logout or in a layout: the
// value of its action field ends in /logOut.
const logOutForm = { match: '/logOut"', index: 0 };

test('a signed-out visitor is sent to log in, except on the public pages', async () => {
  // Once '/' is public (a landing page in publicPaths), probe a page that is not.
  const home = await testRequest(app.handle, '/');
  assert.equal(home.status, 302);
  assert.equal(pathOf(home), '/login');
  assert.equal((await testRequest(app.handle, '/login')).status, 200);
  assert.equal((await testRequest(app.handle, '/signup')).status, 200);
});

test('sign up, see the app, log out, then log in again', async () => {
  const signedUp = await submitForm(app.handle, '/signup', { email, password });
  assert.equal(signedUp.status, 303);
  assert.equal(pathOf(signedUp), signedInPath);
  const cookies = cookiesToHeader(getSetCookies(signedUp));

  assert.equal((await testRequest(app.handle, signedInPath, withCookie(cookies))).status, 200);
  const backToApp = await testRequest(app.handle, '/login', withCookie(cookies));
  assert.equal(backToApp.status, 302, 'a signed-in visitor skips the log-in page');
  assert.equal(pathOf(backToApp), signedInPath);

  const loggedOut = await submitForm(app.handle, '/logout', {}, { cookies, ...logOutForm });
  assert.equal(loggedOut.status, 303);
  assert.equal(pathOf(loggedOut), '/login');
  const after = await testRequest(app.handle, '/', withCookie(cookiesToHeader(getSetCookies(loggedOut))));
  assert.equal(after.status, 302, 'the cleared cookie is signed out');

  const wrong = await submitForm(app.handle, '/login', { email, password: 'not the password' });
  assert.equal(wrong.status, 422);
  assert.match(await wrong.text(), /Wrong email or password/);

  const right = await submitForm(app.handle, '/login', { email, password });
  assert.equal(right.status, 303);
  assert.equal(pathOf(right), signedInPath);
});

test('a second sign-up with the same email is refused', async () => {
  const again = await submitForm(app.handle, '/signup', { email, password });
  assert.equal(again.status, 422);
  assert.match(await again.text(), /already registered/);
});
`;
