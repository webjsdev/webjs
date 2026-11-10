/**
 * Cross-runtime proof that `signIn` / `signOut` behave like Auth.js v5's in a
 * form-bound server action on Node and Bun. Run from the repo root:
 *
 *   node test/bun/auth-sign-in-action.mjs
 *   bun  test/bun/auth-sign-in-action.mjs
 *
 * The path crosses surfaces the runtimes implement separately: the request
 * AsyncLocalStorage the cookie store hangs off, `Headers.getSetCookie`, the
 * HMAC behind the session token, and the form dispatcher's thrown-redirect
 * handling.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRequestHandler } from '../../packages/server/src/dev.js';
import { submitForm } from '../../packages/server/src/testing.js';

const runtime = process.versions.bun ? 'bun' : 'node';
const here = dirname(fileURLToPath(import.meta.url));
const url = (p) => JSON.stringify(pathToFileURL(resolve(here, p)).toString());

const dir = mkdtempSync(join(tmpdir(), 'webjs-sign-in-bun-'));
for (const d of ['app/login', 'app/caught', 'app/logout', 'modules/auth']) mkdirSync(join(dir, d), { recursive: true });
writeFileSync(join(dir, 'modules/auth/auth.server.ts'), `import { createAuth, Credentials } from ${url('../../packages/server/index.js')};
export const { signIn, signOut } = createAuth({
  secret: 'a-test-secret-that-is-long-enough',
  providers: [Credentials({ async authorize(c) { return c.password === 'right' ? { id: '1', email: c.email } : null; } })],
  pages: { error: '/login' },
});
`);
writeFileSync(join(dir, 'modules/auth/actions.server.ts'), `'use server';
import { AuthError } from ${url('../../packages/server/index.js')};
import { signIn, signOut } from './auth.server.ts';
export async function logIn(formData) { await signIn('credentials', formData, { redirectTo: '/dashboard' }); }
export async function logInCaught(formData) {
  try { await signIn('credentials', formData, { redirectTo: '/dashboard' }); }
  catch (error) { if (error instanceof AuthError) return { success: false, error: 'bad:' + error.type }; throw error; }
}
export async function logOut() { await signOut({ redirectTo: '/' }); }
`);
const page = (action, body) => `import { html } from ${url('../../packages/core/index.js')};
import { ${action} } from '../../modules/auth/actions.server.ts';
export default ({ actionData }) => html\`<form action=\${${action}}>${body}</form><p>\${actionData?.error ?? ''}</p>\`;
`;
writeFileSync(join(dir, 'app/login/page.ts'), page('logIn', '<input name="email"><input name="password">'));
writeFileSync(join(dir, 'app/caught/page.ts'), page('logInCaught', '<input name="email"><input name="password">'));
writeFileSync(join(dir, 'app/logout/page.ts'), page('logOut', '<button>Log out</button>'));

try {
  const app = await createRequestHandler({ appDir: dir, dev: true });
  const auth = (res) => res.headers.getSetCookie().find((c) => /webjs\.auth=/.test(c)) || '';

  const ok = await submitForm(app.handle, '/login', { email: 'a@b.co', password: 'right' });
  assert.equal(ok.status, 303, `[${runtime}] signed in`);
  assert.equal(ok.headers.get('location'), '/dashboard', `[${runtime}] redirected`);
  assert.match(auth(ok), /webjs\.auth=[^;]+/, `[${runtime}] session cookie set`);

  const caught = await submitForm(app.handle, '/caught', { email: 'a@b.co', password: 'wrong' });
  assert.equal(caught.status, 422, `[${runtime}] caught failure re-renders`);
  assert.match(await caught.text(), /bad:CredentialsSignin/, `[${runtime}] the AuthError type reached the action`);

  const uncaught = await submitForm(app.handle, '/login', { email: 'a@b.co', password: 'wrong' });
  assert.equal(uncaught.headers.get('location'), '/login?error=CredentialsSignin', `[${runtime}] uncaught failure lands on the error page`);

  const out = await submitForm(app.handle, '/logout', {});
  assert.equal(out.status, 303, `[${runtime}] signed out`);
  assert.match(auth(out), /webjs\.auth=;|Max-Age=0|Expires=Thu, 01 Jan 1970/i, `[${runtime}] cookie cleared`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`[auth-sign-in-action] Auth.js-style signIn/signOut OK on ${runtime}`);
