/**
 * SaaS template files for `webjs create --template saas`.
 * Extracted to avoid nested template literal escaping issues.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_REGISTRY_ROOT = resolve(
  __dirname, '..', '..', 'ui', 'packages', 'registry',
);

/**
 * Read a registry component and rewrite its `'../lib/utils.ts'` import for
 * the scaffolded app's `components/ui/<name>.ts` layout (two-up to lib/).
 * Mirrors the helper in `create.js`, kept private here to avoid coupling.
 */
async function readUiComponent(name) {
  const src = join(UI_REGISTRY_ROOT, 'components', `${name}.ts`);
  if (!existsSync(src)) return null;
  const raw = await readFile(src, 'utf8');
  return raw
    .replaceAll("'../lib/utils.ts'", "'../../lib/utils.ts'")
    .replaceAll('"../lib/utils.ts"', '"../../lib/utils.ts"');
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
 */
export async function writeSaasFiles(appDir) {
  // SaaS pages use auth forms, so copy the extra ui-* components on top of
  // the standard set the full-stack scaffold already wrote. Pre-importing
  // them in login/signup/dashboard pages below means the dev server will
  // SSR these elements with full styling on first paint.
  // `form` and `field` are deferred to v2 (see packages/ui/AGENTS.md) -
  // the saas auth pages use raw <form> + label/input class helpers instead.
  await copyUiComponents(appDir, ['dialog', 'switch', 'checkbox']);

  // lib/server/prisma.ts (overrides the simpler version create.js wrote
  // for full-stack/api, since saas needs the same singleton plus a known
  // sibling import path for lib/server/auth.ts below).
  await mkdir(join(appDir, 'lib', 'server'), { recursive: true });
  await writeFile(join(appDir, 'lib', 'server', 'prisma.ts'), [
    "import { PrismaClient } from '@prisma/client';",
    "",
    "const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };",
    "export const prisma = globalForPrisma.prisma || new PrismaClient();",
    "if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;",
    "",
  ].join('\n'));

  // lib/server/password.ts
  await writeFile(join(appDir, 'lib', 'server', 'password.ts'), [
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

  // lib/server/auth.ts
  await writeFile(join(appDir, 'lib', 'server', 'auth.ts'), [
    "import { createAuth, Credentials } from '@webjskit/server';",
    "import { prisma } from './prisma.ts';",
    "import { compare } from './password.ts';",
    "",
    "export const { auth, signIn, signOut, handlers } = createAuth({",
    "  providers: [",
    "    Credentials({",
    "      async authorize(credentials: { email: string; password: string }) {",
    "        const user = await prisma.user.findUnique({ where: { email: credentials.email } });",
    "        if (!user || !await compare(credentials.password, user.passwordHash)) return null;",
    "        return { id: String(user.id), name: user.name, email: user.email };",
    "      },",
    "    }),",
    "  ],",
    "  secret: process.env.AUTH_SECRET,",
    "});",
    "",
  ].join('\n'));

  // prisma/schema.prisma
  await mkdir(join(appDir, 'prisma'), { recursive: true });
  await writeFile(join(appDir, 'prisma', 'schema.prisma'), [
    'datasource db {',
    '  provider = "sqlite"',
    '  url      = env("DATABASE_URL")',
    '}',
    '',
    'generator client {',
    '  provider = "prisma-client-js"',
    '}',
    '',
    'model User {',
    '  id           Int      @id @default(autoincrement())',
    '  email        String   @unique',
    '  name         String?',
    '  passwordHash String',
    '  createdAt    DateTime @default(now())',
    '}',
    '',
  ].join('\n'));

  // modules/auth/actions/signup.server.ts
  await mkdir(join(appDir, 'modules', 'auth', 'actions'), { recursive: true });
  await mkdir(join(appDir, 'modules', 'auth', 'queries'), { recursive: true });

  await writeFile(join(appDir, 'modules', 'auth', 'actions', 'signup.server.ts'), [
    "'use server';",
    "",
    "import { prisma } from '../../../lib/server/prisma.ts';",
    "import { hash } from '../../../lib/server/password.ts';",
    "",
    "export async function signup(input: { name: string; email: string; password: string }) {",
    "  const exists = await prisma.user.findUnique({ where: { email: input.email } });",
    "  if (exists) return { success: false as const, error: 'Email already registered', status: 409 };",
    "  const user = await prisma.user.create({",
    "    data: { name: input.name, email: input.email, passwordHash: await hash(input.password) },",
    "  });",
    "  return { success: true as const, data: { id: user.id, name: user.name, email: user.email } };",
    "}",
    "",
  ].join('\n'));

  // modules/auth/queries/current-user.server.ts
  await writeFile(join(appDir, 'modules', 'auth', 'queries', 'current-user.server.ts'), [
    "'use server';",
    "",
    "import { auth } from '../../../lib/server/auth.ts';",
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

  // test/unit/auth.test.ts: minimal stub so the scaffold passes
  // `webjs check` (tests-exist) and `webjs test` runs cleanly out of the
  // box. The signup/current-user functions import from lib/server/prisma.ts
  // and lib/server/auth.ts, both of which need `prisma generate` to have run before
  // they can be imported, so we deliberately test only the runtime-
  // dependency-free types.ts here. Replace with real tests once Prisma
  // is set up (run `npm install && npx prisma migrate dev --name init`).
  await writeFile(join(appDir, 'test', 'unit', 'auth.test.ts'), [
    "import { test } from 'node:test';",
    "import assert from 'node:assert/strict';",
    "",
    "import type { User, ActionResult } from '../../modules/auth/types.ts';",
    "",
    "test('User shape: id is numeric, email is required', () => {",
    "  const u: User = { id: 1, name: 'Test', email: 'test@example.com' };",
    "  assert.equal(typeof u.id, 'number');",
    "  assert.equal(typeof u.email, 'string');",
    "});",
    "",
    "test('ActionResult: success envelope carries data', () => {",
    "  const r: ActionResult<User> = {",
    "    success: true,",
    "    data: { id: 1, name: 'Test', email: 'test@example.com' },",
    "  };",
    "  assert.equal(r.success, true);",
    "  if (r.success) assert.equal(r.data.email, 'test@example.com');",
    "});",
    "",
    "test('ActionResult: failure envelope carries error + status', () => {",
    "  const r: ActionResult<User> = {",
    "    success: false,",
    "    error: 'Email already registered',",
    "    status: 409,",
    "  };",
    "  assert.equal(r.success, false);",
    "  if (!r.success) {",
    "    assert.equal(r.status, 409);",
    "    assert.ok(r.error.length > 0);",
    "  }",
    "});",
    "",
    "// TODO: once you've run `npm install && npx prisma migrate dev` you can",
    "// import { signup } from '../../modules/auth/actions/signup.server.ts'",
    "// and { currentUser } from '../../modules/auth/queries/current-user.server.ts'",
    "// and write real integration tests against a test SQLite DB.",
    "",
  ].join('\n'));

  // app/api/auth/[...path]/route.ts
  await mkdir(join(appDir, 'app', 'api', 'auth', '[...path]'), { recursive: true });
  await writeFile(join(appDir, 'app', 'api', 'auth', '[...path]', 'route.ts'), [
    "import { handlers } from '../../../../../lib/server/auth.ts';",
    "export const GET = handlers.GET;",
    "export const POST = handlers.POST;",
    "",
  ].join('\n'));

  // app/login/page.ts
  await mkdir(join(appDir, 'app', 'login'), { recursive: true });
  await writeFile(join(appDir, 'app', 'login', 'page.ts'), [
    "import { html } from '@webjskit/core';",
    "import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass, cardFooterClass } from '../../components/ui/card.ts';",
    "import { buttonClass } from '../../components/ui/button.ts';",
    "import { inputClass } from '../../components/ui/input.ts';",
    "import { labelClass } from '../../components/ui/label.ts';",
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
    "          <form method=\"POST\" action=\"/api/auth/callback/credentials\" class=\"flex flex-col gap-4\">",
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
    "import { html } from '@webjskit/core';",
    "import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass, cardFooterClass } from '../../components/ui/card.ts';",
    "import { buttonClass } from '../../components/ui/button.ts';",
    "import { inputClass } from '../../components/ui/input.ts';",
    "import { labelClass } from '../../components/ui/label.ts';",
    "",
    "export const metadata = { title: 'Sign up' };",
    "",
    "export default function SignupPage() {",
    "  return html`",
    "    <div class=\"max-w-sm mx-auto mt-12\">",
    "      <div class=${cardClass()}>",
    "        <div class=${cardHeaderClass()}>",
    "          <h3 class=${cardTitleClass()}>Create an account</h3>",
    "          <p class=${cardDescriptionClass()}>Get started with your new workspace.</p>",
    "        </div>",
    "        <div class=${cardContentClass()}>",
    "          <form id=\"signup-form\" class=\"flex flex-col gap-4\">",
    "            <div class=\"flex flex-col gap-1.5\">",
    "              <label class=${labelClass()} for=\"name\">Name</label>",
    "              <input class=${inputClass()} id=\"name\" name=\"name\" type=\"text\" required>",
    "            </div>",
    "            <div class=\"flex flex-col gap-1.5\">",
    "              <label class=${labelClass()} for=\"email\">Email</label>",
    "              <input class=${inputClass()} id=\"email\" name=\"email\" type=\"email\" required>",
    "            </div>",
    "            <div class=\"flex flex-col gap-1.5\">",
    "              <label class=${labelClass()} for=\"password\">Password</label>",
    "              <input class=${inputClass()} id=\"password\" name=\"password\" type=\"password\" required>",
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
    "import { auth } from '../../lib/server/auth.ts';",
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
    "import { html } from '@webjskit/core';",
    "import { currentUser } from '../../modules/auth/queries/current-user.server.ts';",
    "import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass } from '../../components/ui/card.ts';",
    "import { buttonClass } from '../../components/ui/button.ts';",
    "import { badgeClass } from '../../components/ui/badge.ts';",
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
    "import { html } from '@webjskit/core';",
    "import { currentUser } from '../../../modules/auth/queries/current-user.server.ts';",
    "import { cardClass, cardHeaderClass, cardTitleClass, cardDescriptionClass, cardContentClass } from '../../../components/ui/card.ts';",
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
