/**
 * The authentication generator's pages and test: log in, sign up, and a
 * `/dashboard` segment whose `middleware.ts` requires a session.
 */
import { uiClasses } from './scaffold-pages.js';

/** @typedef {import('./index.js').AppContext} AppContext */

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
      <form action=\${logIn} class="grid gap-4">
${field('email', 'Email', "type=\"email\" autocomplete=\"email\" value=${actionData?.values?.email ?? ''}", false)}
${field('password', 'Password', 'type="password" autocomplete="current-password"', false)}
        <button ${cls.button} type="submit">Log in</button>
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
      <form action=\${signUp} class="grid gap-4">
${field('email', 'Email', "type=\"email\" autocomplete=\"email\" value=${actionData?.values?.email ?? ''}", true)}
${field('password', 'Password', 'type="password" autocomplete="new-password" minlength="8"', true)}
        <button ${cls.button} type="submit">Create account</button>
      </form>
      <p class="text-sm text-muted-foreground m-0">Already have an account? <a class="underline" href="/login">Log in</a></p>
    </section>
  \`;
}
`;

  const dashboard = `import { html } from '@webjsdev/core';
${ctx.ui.button ? "import { buttonClass } from '#components/ui/button.ts';\n" : ''}import { currentUser } from '#modules/auth/queries/current-user.server.ts';
import { logOut } from '#modules/auth/actions/log-out.server.ts';

export const metadata = { title: 'Dashboard' };

// Signed in only: middleware.ts beside this page sends a signed-out visitor to
// /login before this renders.
export default async function DashboardPage() {
  const user = await currentUser();
  return html\`
    <section class="mx-auto max-w-sm grid gap-6 py-10">
      <h1 class="text-2xl font-semibold m-0">Dashboard</h1>
      <p class="m-0">Signed in as \${user?.email}.</p>
      <form action=\${logOut}>
        <button ${cls.outline} type="submit">Log out</button>
      </form>
    </section>
  \`;
}
`;

  const middleware = `import { auth } from '#modules/auth/auth.server.ts';

// Rails' require_authentication, the Next.js way: a segment middleware.ts runs
// before every page under /dashboard, so a signed-out visitor goes to /login
// before anything renders. Copy this file into any folder to protect it.
export default async function middleware(request: Request) {
  if (!(await auth(request))) return Response.redirect(new URL('/login', request.url), 302);
}
`;

  const files = [
    { path: 'app/login/page.ts', content: login },
    { path: 'app/signup/page.ts', content: signup },
    { path: 'app/dashboard/page.ts', content: dashboard },
    { path: 'app/dashboard/middleware.ts', content: middleware },
  ];
  if (!ctx.skipTests) files.push({ path: 'test/auth/auth.test.ts', content: TEST });
  return files;
}

const TEST = `// The authentication generator's test: sign up, log in and out, and the
// protected dashboard, each through the real request handler and the forms a
// browser with JavaScript off submits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRequestHandler } from '@webjsdev/server';
import { submitForm, testRequest, getSetCookies, cookiesToHeader } from '@webjsdev/server/testing';

const app = await createRequestHandler({ appDir: fileURLToPath(new URL('../..', import.meta.url)), dev: true });
const email = 'ada-' + Date.now() + '@example.com';
const password = 'correct horse battery';
const pathOf = (res: Response) => new URL(res.headers.get('location') ?? '', 'http://localhost').pathname;

test('the dashboard sends a signed-out visitor to log in', async () => {
  const res = await testRequest(app.handle, '/dashboard');
  assert.equal(res.status, 302);
  assert.equal(pathOf(res), '/login');
});

test('sign up, see the dashboard, log out, then log in again', async () => {
  const signedUp = await submitForm(app.handle, '/signup', { email, password });
  assert.equal(signedUp.status, 303);
  assert.equal(pathOf(signedUp), '/dashboard');
  const cookies = cookiesToHeader(getSetCookies(signedUp));

  const dashboard = await testRequest(app.handle, '/dashboard', { headers: { cookie: cookies } });
  assert.equal(dashboard.status, 200);
  assert.ok((await dashboard.text()).includes(email));

  const loggedOut = await submitForm(app.handle, '/dashboard', {}, { cookies });
  assert.equal(loggedOut.status, 303);

  const wrong = await submitForm(app.handle, '/login', { email, password: 'not the password' });
  assert.equal(wrong.status, 422);
  assert.match(await wrong.text(), /Wrong email or password/);

  const right = await submitForm(app.handle, '/login', { email, password });
  assert.equal(right.status, 303);
  assert.equal(pathOf(right), '/dashboard');
});

test('a second sign-up with the same email is refused', async () => {
  const again = await submitForm(app.handle, '/signup', { email, password });
  assert.equal(again.status, 422);
  assert.match(await again.text(), /already registered/);
});
`;
