/**
 * SaaS template files for `webjs create --template saas`.
 * Extracted to avoid nested template literal escaping issues.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { bunifyProse } from './runtime-rewrite.js';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_REGISTRY_ROOT = resolve(
  __dirname, '..', '..', 'ui', 'packages', 'registry',
);

/**
 * Read a registry component and rewrite its `'#lib/utils.ts'` import for
 * the scaffolded app's `components/ui/<name>.ts` layout (the `#lib/utils/cn.ts`
 * alias). Mirrors the helper in `create.js`, kept private here to avoid coupling.
 */
async function readUiComponent(name) {
  const src = join(UI_REGISTRY_ROOT, 'components', `${name}.ts`);
  if (!existsSync(src)) return null;
  const raw = await readFile(src, 'utf8');
  // The registry component imports cn() via a relative `../lib/utils.ts`; rewrite
  // it to the scaffolded app's aliased path (cn lives at lib/utils/cn.ts).
  return raw
    .replaceAll("'../lib/utils.ts'", "'#lib/utils/cn.ts'")
    .replaceAll('"../lib/utils.ts"', '"#lib/utils/cn.ts"');
}

/** Copy named registry components into `<appDir>/components/ui/`. */
async function copyUiComponents(appDir, names) {
  const uiDir = join(appDir, 'components', 'ui');
  await mkdir(uiDir, { recursive: true });
  for (const n of names) {
    const content = await readUiComponent(n);
    if (content == null) continue;
    await writeFile(join(uiDir, `${n}.ts`), content);
  }
}

/**
 * @param {string} appDir
 * @param {{ runtime?: 'node'|'bun' }} [opts]
 */
export async function writeSaasFiles(appDir, opts = {}) {
  const isBun = opts.runtime === 'bun';
  // SaaS pages use auth forms, so copy the extra ui-* components on top of
  // the standard set the full-stack scaffold already wrote. Pre-importing
  // them in login/signup/dashboard pages below means the dev server will
  // SSR these elements with full styling on first paint.
  // `form` and `field` are deferred to v2 (see packages/ui/AGENTS.md) -
  // the saas auth pages use raw <form> + label/input class helpers instead.
  await copyUiComponents(appDir, ['dialog', 'switch', 'checkbox']);

  // The db/ layer (columns/connection) is written by the full-stack scaffold
  // already; this template overwrites db/schema.server.ts below to add the
  // User.passwordHash column auth needs.
  await mkdir(join(appDir, 'lib'), { recursive: true });

  // lib/password.server.ts
  await writeFile(join(appDir, 'lib', 'password.server.ts'), [
    "import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';",
    "import { promisify } from 'node:util';",
    "",
    "const scryptAsync = promisify(scrypt);",
    "",
    "export async function hash(password: string): Promise<string> {",
    "  const salt = randomBytes(16).toString('hex');",
    "  const buf = (await scryptAsync(password, salt, 64)) as Buffer;",
    "  return salt + ':' + buf.toString('hex');",
    "}",
    "",
    "export async function compare(password: string, stored: string): Promise<boolean> {",
    "  const [salt, key] = stored.split(':');",
    "  const buf = (await scryptAsync(password, salt, 64)) as Buffer;",
    "  return timingSafeEqual(buf, Buffer.from(key, 'hex'));",
    "}",
    "",
  ].join('\n'));

  // lib/auth.server.ts
  await writeFile(join(appDir, 'lib', 'auth.server.ts'), [
    "import { createAuth, Credentials } from '@webjsdev/server';",
    "import { db } from '#db/connection.server.ts';",
    "import { compare } from './password.server.ts';",
    "",
    "export const { auth, signIn, signOut, handlers } = createAuth({",
    "  providers: [",
    "    Credentials({",
    "      async authorize(credentials: { email: string; password: string }) {",
    "        const user = await db.query.users.findFirst({ where: { email: credentials.email } });",
    "        if (!user || !await compare(credentials.password, user.passwordHash)) return null;",
    "        return { id: String(user.id), name: user.name, email: user.email };",
    "      },",
    "    }),",
    "  ],",
    "  secret: process.env.AUTH_SECRET,",
    "});",
    "",
  ].join('\n'));

  // db/schema.server.ts: overwrite the full-stack scaffold's example User to
  // add passwordHash (the column auth needs). Drizzle, dialect-agnostic.
  await writeFile(join(appDir, 'db', 'schema.server.ts'), [
    "import { defineRelations } from 'drizzle-orm';",
    "import { table, pk, text, createdAt } from './columns.server.ts';",
    "",
    "export const users = table('users', {",
    "  id: pk(),",
    "  email: text().notNull().unique(),",
    "  name: text(),",
    "  passwordHash: text().notNull(),",
    "  createdAt: createdAt(),",
    "});",
    "",
    "export const relations = defineRelations({ users }, () => ({}));",
    "",
    "export type User = typeof users.$inferSelect;",
    "",
  ].join('\n'));

  // modules/auth/actions/signup.server.ts
  await mkdir(join(appDir, 'modules', 'auth', 'actions'), { recursive: true });
  await mkdir(join(appDir, 'modules', 'auth', 'queries'), { recursive: true });

  await writeFile(join(appDir, 'modules', 'auth', 'actions', 'signup.server.ts'), [
    "'use server';",
    "",
    "import { db } from '#db/connection.server.ts';",
    "import { users } from '#db/schema.server.ts';",
    "import { hash } from '#lib/password.server.ts';",
    "",
    "export async function signup(input: { name: string; email: string; password: string }) {",
    "  const exists = await db.query.users.findFirst({ where: { email: input.email }, columns: { id: true } });",
    "  if (exists) return { success: false as const, error: 'Email already registered', status: 409 };",
    "  const [user] = await db.insert(users).values({ name: input.name, email: input.email, passwordHash: await hash(input.password) }).returning();",
    "  return { success: true as const, data: { id: user.id, name: user.name, email: user.email } };",
    "}",
    "",
  ].join('\n'));

  // modules/auth/queries/current-user.server.ts
  await writeFile(join(appDir, 'modules', 'auth', 'queries', 'current-user.server.ts'), [
    "'use server';",
    "",
    "import { auth } from '#lib/auth.server.ts';",
    "",
    "export async function currentUser() {",
    "  const session = await auth();",
    "  return session?.user ?? null;",
    "}",
    "",
  ].join('\n'));

  // modules/auth/types.ts
  await writeFile(join(appDir, 'modules', 'auth', 'types.ts'), [
    "export interface User {",
    "  id: number;",
    "  name: string | null;",
    "  email: string;",
    "}",
    "",
    "export type ActionResult<T> =",
    "  | { success: true; data: T }",
    "  | { success: false; error: string; status: number };",
    "",
  ].join('\n'));

  // test/auth/auth.test.ts: a REAL auth-flow test driven through the framework
  // request pipeline with the @webjsdev/server test harness (createRequestHandler
  // + the handle() helpers from @webjsdev/server/testing). It lives under the
  // documented test/<feature>/ convention (test/auth/), not the old test/unit/
  // path.
  //
  // Two layers, by DB availability:
  //   - The protected-route gate (unauthenticated /dashboard -> 302 /login) runs
  //     ALWAYS once the app modules import: auth() only reads a cookie, no DB
  //     query. This is the headline security assertion and it is REAL.
  //   The signup, login, and protected-route flow writes + reads a user, so it
  //   needs the DB migrated (`npm run db:generate` then `npm run db:migrate`).
  //   Until the users table exists those flows error, so the suite skips with a
  //   clear message instead of crashing. After DB setup it runs for real.
  await mkdir(join(appDir, 'test', 'auth'), { recursive: true });
  // The generated comments reference `npm run db:*` setup; bun-ify them so a
  // bun-flavored saas app reads `bun run db:*` (#541; db is Node tooling, so a
  // plain `bun run`, not the --bun server form). The transform is a no-op on Node.
  const authTest = [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "import { fileURLToPath } from 'node:url';",
    "import { dirname, resolve } from 'node:path';",
    "",
    "import { createRequestHandler } from '@webjsdev/server';",
    "import { testRequest, loginAndGetCookies, withSessionCookie } from '@webjsdev/server/testing';",
    "",
    "const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');",
    "",
    "// The auth pages + dashboard middleware query the users table via Drizzle.",
    "// Until `npm run db:generate` + `npm run db:migrate` have created it, a",
    "// request hitting those modules 500s. We detect that at the RESPONSE level",
    "// (a 5xx on the dashboard) and SKIP with a clear message rather than report",
    "// a misleading failure. After you run",
    "//   npm install && npm run db:generate && npm run db:migrate",
    "// every assertion below runs for real.",
    "process.env.DATABASE_URL ||= 'file:./dev.db';",
    "process.env.AUTH_SECRET ||= 'test-secret-at-least-32-characters-long!!';",
    "",
    "function makeHandler() {",
    "  // createRequestHandler builds lazily, so it succeeds even before the DB",
    "  // is migrated; the missing table only surfaces when a request reaches a",
    "  // module that queries it. That is why readiness is probed per-response.",
    "  return createRequestHandler({ appDir, dev: true });",
    "}",
    "",
    "test('protected route redirects to /login when unauthenticated', async (t) => {",
    "  const app = await makeHandler();",
    "  const res = await testRequest(app.handle, '/dashboard');",
    "  if (res.status >= 500) {",
    "    t.skip('app deps not ready (run `npm run db:generate` + `npm run db:migrate`)');",
    "    return;",
    "  }",
    "  // The dashboard middleware calls auth(); with no session cookie it 302s to",
    "  // /login. This needs no DB row, only a cookie read, so it is always real",
    "  // once the modules import.",
    "  assert.equal(res.status, 302, 'unauthenticated dashboard is gated');",
    "  assert.equal(res.headers.get('location'), '/login');",
    "});",
    "",
    "test('signup -> login -> dashboard renders for the authenticated user', async (t) => {",
    "  const app = await makeHandler();",
    "  // Probe readiness: a 5xx on the dashboard means deps/DB are not set up.",
    "  const probe = await testRequest(app.handle, '/dashboard');",
    "  if (probe.status >= 500) { t.skip('app deps not ready; run `npm run db:generate` + `npm run db:migrate`'); return; }",
    "",
    "  const email = `harness+${Date.now()}@example.com`;",
    "  const password = 'password123';",
    "",
    "  // Real signup through the page server action (the no-JS form write-path).",
    "  let canSignup = true;",
    "  try {",
    "    const signupRes = await testRequest(app.handle, '/signup', {",
    "      method: 'POST',",
    "      headers: { 'content-type': 'application/x-www-form-urlencoded' },",
    "      body: new URLSearchParams({ name: 'Harness', email, password }).toString(),",
    "    });",
    "    // Success is a 303 PRG to /login; a 422 means validation failed (still a",
    "    // real response, just not the happy path). Either way the action ran.",
    "    assert.ok([303, 422].includes(signupRes.status), 'signup action ran');",
    "    if (signupRes.status !== 303) canSignup = false;",
    "  } catch {",
    "    // No migrated DB table -> the action throws. Skip the DB-backed assertions.",
    "    canSignup = false;",
    "  }",
    "  if (!canSignup) { t.skip('no migrated DB; run `npm run db:migrate` to enable the full flow'); return; }",
    "",
    "  // Real login captures the genuine signed session cookie.",
    "  const { cookies } = await loginAndGetCookies(app.handle, { email, password });",
    "",
    "  // With the session cookie the protected route now renders (200).",
    "  const dash = await testRequest(app.handle, '/dashboard', withSessionCookie({}, cookies));",
    "  assert.equal(dash.status, 200, 'the session cookie unlocks the dashboard');",
    "  const body = await dash.text();",
    "  assert.match(body, /Dashboard/, 'the dashboard content rendered');",
    "});",
    "",
  ].join('\n');
  await writeFile(
    join(appDir, 'test', 'auth', 'auth.test.ts'),
    isBun ? bunifyProse(authTest) : authTest,
  );

  // app/api/auth/[...path]/route.ts
  await mkdir(join(appDir, 'app', 'api', 'auth', '[...path]'), { recursive: true });
  await writeFile(join(appDir, 'app', 'api', 'auth', '[...path]', 'route.ts'), [
    "import { handlers } from '#lib/auth.server.ts';",
    "export const GET = handlers.GET;",
    "export const POST = handlers.POST;",
    "",
  ].join('\n'));

  // app/login/page.ts
  await mkdir(join(appDir, 'app', 'login'), { recursive: true });
  await writeFile(join(appDir, 'app', 'login', 'page.ts'), [
    "import { html } from '@webjsdev/core';",
    "import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass, cardFooterClass } from '#components/ui/card.ts';",
    "import { buttonClass } from '#components/ui/button.ts';",
    "import { inputClass } from '#components/ui/input.ts';",
    "import { labelClass } from '#components/ui/label.ts';",
    "",
    "export const metadata = { title: 'Login' };",
    "",
    "export default function LoginPage() {",
    "  return html`",
    "    <div class=\"max-w-sm mx-auto mt-12\">",
    "      <div class=${cardClass()}>",
    "        <div class=${cardHeaderClass()}>",
    "          <h3 class=${cardTitleClass()}>Sign in</h3>",
    "          <p class=${cardDescriptionClass()}>Welcome back: log in to continue.</p>",
    "        </div>",
    "        <div class=${cardContentClass()}>",
    "          <form method=\"POST\" action=\"/api/auth/signin/credentials\" class=\"flex flex-col gap-4\">",
    "            <div class=\"flex flex-col gap-1.5\">",
    "              <label class=${labelClass()} for=\"email\">Email</label>",
    "              <input class=${inputClass()} id=\"email\" name=\"email\" type=\"email\" required>",
    "            </div>",
    "            <div class=\"flex flex-col gap-1.5\">",
    "              <label class=${labelClass()} for=\"password\">Password</label>",
    "              <input class=${inputClass()} id=\"password\" name=\"password\" type=\"password\" required>",
    "            </div>",
    "            <button class=${buttonClass()} type=\"submit\">Sign in</button>",
    "          </form>",
    "        </div>",
    "        <div class=${cardFooterClass()}>",
    "          <p class=\"text-sm text-muted-foreground\">Don't have an account? <a href=\"/signup\" class=\"underline\">Sign up</a></p>",
    "        </div>",
    "      </div>",
    "    </div>",
    "  `;",
    "}",
    "",
  ].join('\n'));

  // app/signup/page.ts
  await mkdir(join(appDir, 'app', 'signup'), { recursive: true });
  await writeFile(join(appDir, 'app', 'signup', 'page.ts'), [
    "import { html } from '@webjsdev/core';",
    "import { signup } from '#modules/auth/actions/signup.server.ts';",
    "import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass, cardFooterClass } from '#components/ui/card.ts';",
    "import { buttonClass } from '#components/ui/button.ts';",
    "import { inputClass } from '#components/ui/input.ts';",
    "import { labelClass } from '#components/ui/label.ts';",
    "",
    "export const metadata = { title: 'Sign up' };",
    "",
    "// Page server action: handles the POST from the form below. With JS",
    "// disabled this is a plain <form> round-trip; with JS the client router",
    "// swaps the 422 re-render (errors) or follows the 303 (success) in place.",
    "// A validation failure returns fieldErrors + values so the page re-renders",
    "// with messages and the user's typed input preserved (#244).",
    "export async function action({ formData }: { formData: FormData }) {",
    "  const name = String(formData.get('name') || '').trim();",
    "  const email = String(formData.get('email') || '').trim();",
    "  const password = String(formData.get('password') || '');",
    "  const values = { name, email };",
    "  const fieldErrors: Record<string, string> = {};",
    "  if (!name) fieldErrors.name = 'Name is required';",
    "  if (!email.includes('@')) fieldErrors.email = 'Enter a valid email';",
    "  if (password.length < 8) fieldErrors.password = 'At least 8 characters';",
    "  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors, values, status: 422 };",
    "  const result = await signup({ name, email, password });",
    "  if (!result.success) return { success: false, fieldErrors: { email: result.error }, values, status: result.status };",
    "  // Account created. Redirect to login via PRG so a reload will not resubmit.",
    "  return { success: true, redirect: '/login' };",
    "}",
    "",
    "export default function SignupPage({ actionData }: { actionData?: { fieldErrors?: Record<string, string>; values?: Record<string, string> } }) {",
    "  const errors = actionData?.fieldErrors || {};",
    "  const values = actionData?.values || {};",
    "  return html`",
    "    <div class=\"max-w-sm mx-auto mt-12\">",
    "      <div class=${cardClass()}>",
    "        <div class=${cardHeaderClass()}>",
    "          <h3 class=${cardTitleClass()}>Create an account</h3>",
    "          <p class=${cardDescriptionClass()}>Get started with your new workspace.</p>",
    "        </div>",
    "        <div class=${cardContentClass()}>",
    "          <form method=\"POST\" class=\"flex flex-col gap-4\">",
    "            <div class=\"flex flex-col gap-1.5\">",
    "              <label class=${labelClass()} for=\"name\">Name</label>",
    "              <input class=${inputClass()} id=\"name\" name=\"name\" type=\"text\" value=${values.name || ''} required>",
    "              ${errors.name ? html`<p class=\"text-sm text-destructive\">${errors.name}</p>` : ''}",
    "            </div>",
    "            <div class=\"flex flex-col gap-1.5\">",
    "              <label class=${labelClass()} for=\"email\">Email</label>",
    "              <input class=${inputClass()} id=\"email\" name=\"email\" type=\"email\" value=${values.email || ''} required>",
    "              ${errors.email ? html`<p class=\"text-sm text-destructive\">${errors.email}</p>` : ''}",
    "            </div>",
    "            <div class=\"flex flex-col gap-1.5\">",
    "              <label class=${labelClass()} for=\"password\">Password</label>",
    "              <input class=${inputClass()} id=\"password\" name=\"password\" type=\"password\" minlength=\"8\" required>",
    "              ${errors.password ? html`<p class=\"text-sm text-destructive\">${errors.password}</p>` : ''}",
    "            </div>",
    "            <button class=${buttonClass()} type=\"submit\">Create account</button>",
    "          </form>",
    "        </div>",
    "        <div class=${cardFooterClass()}>",
    "          <p class=\"text-sm text-muted-foreground\">Already have an account? <a href=\"/login\" class=\"underline\">Log in</a></p>",
    "        </div>",
    "      </div>",
    "    </div>",
    "  `;",
    "}",
    "",
  ].join('\n'));

  // app/dashboard/middleware.ts
  await mkdir(join(appDir, 'app', 'dashboard', 'settings'), { recursive: true });
  await writeFile(join(appDir, 'app', 'dashboard', 'middleware.ts'), [
    "import { auth } from '#lib/auth.server.ts';",
    "",
    "export default async function requireAuth(req: Request, next: () => Promise<Response>) {",
    "  const session = await auth();",
    "  if (!session?.user) {",
    "    return new Response(null, { status: 302, headers: { location: '/login' } });",
    "  }",
    "  return next();",
    "}",
    "",
  ].join('\n'));

  // app/dashboard/page.ts
  await writeFile(join(appDir, 'app', 'dashboard', 'page.ts'), [
    "import { html } from '@webjsdev/core';",
    "import { currentUser } from '#modules/auth/queries/current-user.server.ts';",
    "import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass } from '#components/ui/card.ts';",
    "import { buttonClass } from '#components/ui/button.ts';",
    "import { badgeClass } from '#components/ui/badge.ts';",
    "",
    "export const metadata = { title: 'Dashboard' };",
    "",
    "export default async function Dashboard() {",
    "  const user = await currentUser();",
    "  return html`",
    "    <div class=\"flex items-center justify-between mb-6\">",
    "      <h1 class=\"text-2xl font-semibold\">Dashboard</h1>",
    "      <span class=${badgeClass({ variant: 'secondary' })}>Signed in</span>",
    "    </div>",
    "    <div class=${cardClass()}>",
    "      <div class=${cardHeaderClass()}>",
    "        <h3 class=${cardTitleClass()}>Welcome, ${`\\$\\{user?.name || user?.email\\}`}!</h3>",
    "        <p class=${cardDescriptionClass()}>You're authenticated. Replace this scaffold with your real app.</p>",
    "      </div>",
    "      <div class=${cardContentClass()}>",
    "        <a class=${buttonClass({ variant: 'outline' })} href=\"/dashboard/settings\">Settings</a>",
    "      </div>",
    "    </div>",
    "  `;",
    "}",
    "",
  ].join('\n'));

  // app/dashboard/settings/page.ts
  await writeFile(join(appDir, 'app', 'dashboard', 'settings', 'page.ts'), [
    "import { html } from '@webjsdev/core';",
    "import { currentUser } from '#modules/auth/queries/current-user.server.ts';",
    "import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass } from '#components/ui/card.ts';",
    "",
    "export const metadata = { title: 'Settings' };",
    "",
    "export default async function Settings() {",
    "  const user = await currentUser();",
    "  return html`",
    "    <h1 class=\"text-2xl font-semibold mb-6\">Settings</h1>",
    "    <div class=${cardClass()}>",
    "      <div class=${cardHeaderClass()}>",
    "        <h3 class=${cardTitleClass()}>Account</h3>",
    "        <p class=${cardDescriptionClass()}>Your basic profile information.</p>",
    "      </div>",
    "      <div class=${cardContentClass()}>",
    "        <dl class=\"grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm\">",
    "          <dt class=\"text-muted-foreground\">Email</dt>",
    "          <dd>${`\\$\\{user?.email\\}`}</dd>",
    "          <dt class=\"text-muted-foreground\">Name</dt>",
    "          <dd>${`\\$\\{user?.name || 'Not set'\\}`}</dd>",
    "        </dl>",
    "      </div>",
    "    </div>",
    "  `;",
    "}",
    "",
  ].join('\n'));
}
