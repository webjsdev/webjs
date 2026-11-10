/**
 * The `authentication` generator, Rails 8's, written the Auth.js way:
 * a hashed password on `users`, `createAuth` with a credentials provider,
 * sign-up and log-in pages with forms bound to actions, a log-out action, a
 * `/dashboard` segment whose `middleware.ts` requires a session (Rails'
 * `require_authentication`), and a test. Password reset by mail is left out,
 * as WebJs ships no mailer.
 */
import { baseColumns } from './fields.js';
import { coreModule, hasExport, addImports, insertBlock, registerTable } from './schema-edit.js';
import { authPageFiles } from './authentication-pages.js';

/**
 * @typedef {import('./index.js').AppContext} AppContext
 * @typedef {import('./index.js').Plan} Plan
 */

/**
 * @param {AppContext} ctx
 * @returns {Plan}
 */
export function planAuthentication(ctx) {
  /** @type {Plan} */
  const plan = { files: [], edits: [], notes: [] };
  const users = usersEdit(ctx, plan.notes);
  if (users.schema !== null) {
    plan.edits.push({ path: 'db/schema.server.ts', content: users.schema });
    plan.migrationName = users.created ? 'create_users' : 'add_password_hash_to_users';
  }
  const hasName = users.hasName;
  plan.files.push(
    { path: 'modules/auth/auth.server.ts', content: authModule(hasName) },
    { path: 'modules/auth/password.server.ts', content: PASSWORD },
    { path: 'modules/auth/actions/log-in.server.ts', content: LOG_IN },
    { path: 'modules/auth/actions/sign-up.server.ts', content: SIGN_UP },
    { path: 'modules/auth/actions/log-out.server.ts', content: LOG_OUT },
    { path: 'modules/auth/queries/current-user.server.ts', content: CURRENT_USER },
    { path: 'app/api/auth/[...path]/route.ts', content: ROUTE },
    ...authPageFiles(ctx),
  );
  plan.notes.push(
    '        note  Set AUTH_SECRET in .env for any deployment (development and tests generate one).',
    '        note  To protect another section, copy app/dashboard/middleware.ts into its folder.',
  );
  return plan;
}

/**
 * Add a password hash to the users table, or create the table when the app
 * has none (the example module was deleted).
 * @param {AppContext} ctx
 * @param {string[]} notes
 * @returns {{ schema: string | null, created: boolean, hasName: boolean }}
 */
function usersEdit(ctx, notes) {
  const src = ctx.schema;
  const start = src.search(/^export const users\s*=\s*\w+Table\(/m);
  if (start >= 0) {
    const close = src.slice(start).match(/^(?:\}\);|\}\s*,)/m);
    if (!close) throw new Error('Could not find the end of the users table in db/schema.server.ts.');
    const end = start + /** @type {number} */ (close.index);
    const body = src.slice(start, end);
    if (!/^\s*email\s*:/m.test(body)) {
      throw new Error('The users table has no email column, which sign-in needs. Add `email: text().notNull().unique()` to it first.');
    }
    const hasName = /^\s*name\s*:/m.test(body);
    if (/^\s*passwordHash\s*:/m.test(body)) {
      notes.push('        skip  users already has passwordHash.');
      return { schema: null, created: false, hasName };
    }
    const withColumn = src.slice(0, end)
      + '  // A scrypt hash written by modules/auth/password.server.ts, never the password.\n'
      + '  passwordHash: text(),\n'
      + src.slice(end);
    return { schema: addImports(withColumn, coreModule(ctx.dialect), ['text']), created: false, hasName };
  }
  if (hasExport(src, 'users')) throw new Error('db/schema.server.ts exports users but not as a table.');
  const base = baseColumns(ctx.dialect);
  const tableFn = ctx.dialect === 'postgres' ? 'pgTable' : 'sqliteTable';
  const block = `export const users = ${tableFn}('users', {
  id: ${base.id},
  email: text().notNull().unique(),
  name: text(),
  // A scrypt hash written by modules/auth/password.server.ts, never the password.
  passwordHash: text(),
  createdAt: ${base.createdAt},
  updatedAt: ${base.updatedAt},
});
${/^export type User\b/m.test(src) ? '' : 'export type User = typeof users.$inferSelect;\n'}`;
  let out = addImports(src, coreModule(ctx.dialect), [tableFn, 'text', ...base.imports]);
  out = insertBlock(out, block);
  out = registerTable(out, 'users') ?? out;
  return { schema: out, created: true, hasName: true };
}

/** @param {boolean} hasName */
function authModule(hasName) {
  return `// The auth configuration: Auth.js's API through createAuth. A server-only
// module (a .server.ts file with no 'use server'), so pages, actions and
// middleware import it on the server and it never reaches the browser.
//
// The session is a signed cookie. AUTH_SECRET signs it: set it in .env for any
// deployment (in development and tests WebJs generates one when it is unset).
import { createAuth, Credentials } from '@webjsdev/server';
import { eq } from 'drizzle-orm';
import { db } from '#db/connection.server.ts';
import { users } from '#db/schema.server.ts';
import { verifyPassword } from './password.server.ts';

export type SessionUser = { id: string; email: string${hasName ? '; name: string | null' : ''} };

export const { auth, signIn, signOut, handlers } = createAuth<SessionUser>({
  providers: [
    Credentials({
      async authorize(credentials: { email: string; password: string }) {
        const email = String(credentials.email ?? '').trim().toLowerCase();
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user?.passwordHash) return null;
        if (!(await verifyPassword(String(credentials.password ?? ''), user.passwordHash))) return null;
        return { id: String(user.id), email: user.email${hasName ? ', name: user.name' : ''} };
      },
    }),
  ],
  // A sign-in that fails outside a bound form lands back on the log-in page.
  pages: { signIn: '/login', error: '/login' },
});
`;
}

const PASSWORD = `// Password hashing with scrypt from node:crypto, built into Node and Bun, so
// there is no dependency. The stored value is "<salt>:<hash>", both hex. Swap
// in argon2 or bcrypt here if you prefer; callers only use these two.
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await scryptAsync(password, salt, 64)).toString('hex');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const expected = Buffer.from(key, 'hex');
  const actual = await scryptAsync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
`;

const LOG_IN = `'use server';

import { AuthError } from '@webjsdev/server';
import { signIn } from '../auth.server.ts';

// Bound by app/login/page.ts as <form action=\${logIn}>, written as Auth.js has
// it in a Next.js app. On success signIn sets the session cookie and throws a
// redirect (a 303 from a form). A wrong email or password throws an AuthError,
// which becomes the message the page re-renders with; anything else, the
// success redirect above all, is rethrown.
export async function logIn(formData: FormData) {
  try {
    await signIn('credentials', formData, { redirectTo: '/dashboard' });
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false as const, error: 'Wrong email or password.', values: { email: String(formData.get('email') ?? '') } };
    }
    throw error;
  }
}
`;

const SIGN_UP = `'use server';

import type { ActionResult } from '@webjsdev/server';
import { db } from '#db/connection.server.ts';
import { users } from '#db/schema.server.ts';
import { hashPassword } from '../password.server.ts';
import { signIn } from '../auth.server.ts';

// Bound by app/signup/page.ts. A failure re-renders the page with a message per
// field and the typed email; a success stores the user with a hashed password,
// then signs them in and redirects to the dashboard.
export async function signUp(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const values = { email };
  const fieldErrors: Record<string, string> = {};
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) fieldErrors.email = 'Enter a valid email address.';
  if (password.length < 8) fieldErrors.password = 'Use at least 8 characters.';
  if (Object.keys(fieldErrors).length > 0) return { success: false, fieldErrors, values, status: 422 };

  // A duplicate email inserts nothing and returns no row.
  const [user] = await db.insert(users).values({ email, passwordHash: await hashPassword(password) })
    .onConflictDoNothing().returning({ id: users.id });
  if (!user) return { success: false, fieldErrors: { email: 'That email is already registered.' }, values, status: 422 };
  await signIn('credentials', { email, password }, { redirectTo: '/dashboard' });
  return { success: true };
}
`;

const LOG_OUT = `'use server';

import { signOut } from '../auth.server.ts';

// Bound by the Log out button on app/dashboard/page.ts. Clears the session
// cookie and redirects home.
export async function logOut() {
  await signOut({ redirectTo: '/' });
}
`;

const CURRENT_USER = `import { auth } from '../auth.server.ts';
import type { SessionUser } from '../auth.server.ts';

// The signed-in user, read from the current request's session cookie, or null.
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user ?? null;
}
`;

const ROUTE = `// The auth endpoints createAuth serves (sign-in, sign-out, the session and any
// OAuth callback). They live under /api/auth, Auth.js's default base path.
import { handlers } from '#modules/auth/auth.server.ts';

export const { GET, POST } = handlers;
`;
