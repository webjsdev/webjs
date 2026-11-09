/**
 * `signIn` / `signOut` from `createAuth` behave like Auth.js v5's inside a
 * server action, so the Next habit works on a bound form with JS off:
 *
 *   try { await signIn('credentials', formData, { redirectTo: '/dashboard' }) }
 *   catch (error) { if (error instanceof AuthError) return { success: false, ... }; throw error }
 *
 * They used to RETURN a Response, so `await signIn(...)` without `return`
 * dropped the session cookie and the action reported success with nobody
 * signed in. An agent building sign-in on the scaffold gave up on createAuth
 * for that reason and hand-rolled sessions.
 *
 * Counterfactual: return `signInFn` from createAuth in place of the new
 * `signIn` wrapper (src/auth.js) and the first case fails with no cookie.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

import { createRequestHandler } from '../../src/dev.js';
import { submitForm } from '../../src/testing.js';
import { createAuth, Credentials } from '../../src/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = (p) => JSON.stringify(pathToFileURL(resolve(__dirname, p)).toString());

async function makeApp() {
  const dir = await mkdtemp(join(tmpdir(), 'webjs-sign-in-action-'));
  for (const d of ['app/login', 'app/caught', 'app/logout', 'modules/auth']) await mkdir(join(dir, d), { recursive: true });
  await writeFile(join(dir, 'modules/auth/auth.server.ts'),
    `import { createAuth, Credentials } from ${url('../../index.js')};
export const { auth, signIn, signOut, handlers } = createAuth({
  secret: 'a-test-secret-that-is-long-enough',
  providers: [Credentials({
    async authorize(c) {
      return c.email === 'ada@example.com' && c.password === 'right' ? { id: '1', email: c.email } : null;
    },
  })],
  pages: { error: '/login' },
});
`);
  await writeFile(join(dir, 'modules/auth/actions.server.ts'),
    `'use server';
import { AuthError } from ${url('../../index.js')};
import { signIn, signOut } from './auth.server.ts';
// The Auth.js docs shape, awaited and not returned.
export async function logIn(formData) {
  await signIn('credentials', formData, { redirectTo: '/dashboard' });
}
export async function logInCaught(formData) {
  try {
    await signIn('credentials', formData, { redirectTo: '/dashboard' });
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: 'Wrong email or password (' + error.type + ')' };
    throw error;
  }
}
export async function logOut() {
  await signOut({ redirectTo: '/' });
}
`);
  const page = (action) => `import { html } from ${url('../../../core/index.js')};
import { ${action} } from '../../modules/auth/actions.server.ts';
export default ({ actionData }) => html\`<form action=\${${action}}><input name="email"><input name="password"></form><p>\${actionData?.error ?? ''}</p>\`;
`;
  await writeFile(join(dir, 'app/login/page.ts'), page('logIn'));
  await writeFile(join(dir, 'app/caught/page.ts'), page('logInCaught'));
  await writeFile(join(dir, 'app/logout/page.ts'), `import { html } from ${url('../../../core/index.js')};
import { logOut } from '../../modules/auth/actions.server.ts';
export default () => html\`<form action=\${logOut}><button>Log out</button></form>\`;
`);
  return dir;
}

let app;
async function handler() {
  if (!app) {
    app = await createRequestHandler({ appDir: await makeApp(), dev: true });
    await app.warmup();
  }
  return app;
}

const authCookie = (res) => res.headers.getSetCookie().find((c) => /webjs\.auth=/.test(c));

test('an awaited signIn in a form action sets the session cookie and redirects', async () => {
  const a = await handler();
  const res = await submitForm(a.handle, '/login', { email: 'ada@example.com', password: 'right' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/dashboard');
  const cookie = authCookie(res);
  assert.ok(cookie && !/webjs\.auth=;/.test(cookie), 'the session cookie rides the redirect');
});

test('a wrong password throws CredentialsSignin, which the action can catch', async () => {
  const a = await handler();
  const res = await submitForm(a.handle, '/caught', { email: 'ada@example.com', password: 'wrong' });
  assert.equal(res.status, 422, 'the caught failure re-renders the page');
  assert.match(await res.text(), /Wrong email or password \(CredentialsSignin\)/);
  assert.equal(authCookie(res), undefined, 'no session on a failed sign-in');
});

test('an uncaught CredentialsSignin redirects to the error page, like the route handler', async () => {
  const a = await handler();
  const res = await submitForm(a.handle, '/login', { email: 'ada@example.com', password: 'wrong' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/login?error=CredentialsSignin');
  assert.equal(authCookie(res), undefined);
});

test('an awaited signOut clears the cookie and redirects', async () => {
  const a = await handler();
  const res = await submitForm(a.handle, '/logout', {});
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/');
  assert.match(authCookie(res) || '', /webjs\.auth=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i, 'the cookie is cleared');
});

test('outside a request signIn still returns the Response the auth routes send', async () => {
  const { signIn } = createAuth({
    secret: 'a-test-secret-that-is-long-enough',
    providers: [Credentials({ async authorize() { return { id: '1' }; } })],
  });
  const res = await signIn('credentials', {}, { redirectTo: '/home' });
  assert.ok(res instanceof Response);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/home');
});
