## Build an app (full-stack template)

### Build steps

Everything a typical app needs (pages, forms, validation, auth, owner-scoped
CRUD, a component, Drizzle) is in this file, so build straight from it instead
of exploring. Write in a few large steps (one shell heredoc or one write per
group of files), not one file per turn.

1. Branch, clear the demo gallery, and add the UI kit, in one command:
   `git checkout -b feat/<name> && npm run gallery:clear && npx webjsdev ui add button input label textarea native-select card badge`.
   The gallery (`app/features/`, `app/examples/`, the demo `modules/`) is only a
   demo: never read it, everything it teaches is below.
2. Write `db/schema.server.ts` (replace the whole file: its `users` table is a
   placeholder), then `npm run db:generate && npm run db:migrate`.
3. Write every `modules/` file (auth, queries, actions, components, utils).
4. Write `app/layout.ts` and `app/page.ts` (replace both whole; no need to
   read them first), every other page, `app/not-found.ts`, and
   `test/<feature>/*.test.ts`.
5. `npm run check && npm run typecheck && npm run test:server`, and fix what
   they report.
6. Walk the app once in a real browser. `curl` cannot submit a bound form
   (the form carries a hidden action field), so use Playwright, which is
   installed (if Chromium is missing: `npx playwright install chromium`).
   First write one script, `walk.mjs` in the app folder, that signs up and
   drives each feature once with `page.getByLabel(...)` and
   `page.getByRole('button', { name })`. With JavaScript on, a submit is
   applied in place, so wait for its outcome (`await page.waitForURL(...)` or
   `await page.getByText('...').waitFor()`), never a fixed timeout. Save a
   phone-width and a desktop-width screenshot under `/tmp`. Then start
   `PORT=<port> npm run dev > dev.log 2>&1 &` (`*.log` is gitignored), run
   `node walk.mjs`, look at the screenshots, fix what the walk shows in the
   app, stop the server you started, and delete `walk.mjs`.
7. Commit (see Git below).

### How WebJs works

- **Pages and layouts run only on the server.** They return `html` and never
  hydrate: an `@click` in a page does nothing. Interactivity lives in a
  `WebComponent` custom element; a page imports the component file to
  register it and writes its tag.
- **`*.server.ts` is the server boundary.** With `'use server';` as the first
  line, its exported async functions are server actions: a page calls them
  directly on the server, a component calls them over RPC (the import becomes
  a typed stub). WITHOUT `'use server'` the file is a server-only utility (the
  DB, secrets, `node:*`, `createAuth`): import it only from other `.server.ts`
  files, `route.ts` or `middleware.ts`, never from a page, layout or component
  (it crashes the browser). So a page reaches data and the session only
  through `'use server'` queries.
- **Forms post to actions.** `<form action=${someAction}>` is the whole wiring
  (no `method`, no `fetch`, works without JavaScript; with JavaScript the router
  applies the result in place). The action receives the `FormData` and returns:
  `{ success: true, redirect: '/path' }` (a 303 to that path), or
  `{ success: false, error?, fieldErrors?, status? }`, which re-renders the
  same page (422) with the result on the page's `actionData`;
  `actionData.values` already holds every submitted text field. A returned
  `Response` (for example from `signIn`) is sent as is.
- **Control flow:** `notFound()` and `redirect(url)` from `@webjsdev/core`
  throw; use them in pages, layouts and form actions. In a `route.ts` return a
  `Response` instead, and in an action called over RPC return
  `{ success: false, error }` instead of throwing.

### File map

```
app/layout.ts                 root layout: the only file that writes <head> content
app/page.ts                   /
app/<seg>/[id]/page.ts        dynamic route; params.id is a string
app/<seg>/[id]/edit/page.ts   nested route
app/not-found.ts              the 404 page, also rendered by notFound()
app/<path>/route.ts           HTTP endpoint: export async function GET(req, { params })
modules/<feature>/queries/<verb-noun>.server.ts   reads, 'use server', one function per file
modules/<feature>/actions/<verb-noun>.server.ts   writes, 'use server', one function per file
modules/<feature>/components/<tag>.ts             one custom element per file
modules/<feature>/utils/*.ts, types.ts            pure browser-safe helpers and types
lib/utils/*.ts                app-wide browser-safe helpers
db/schema.server.ts           tables; `db` is in db/connection.server.ts
test/<feature>/*.test.ts      server tests (node:test), run by `npm run test:server`
```

Import app files through the `#` root alias with the `.ts` extension:
`import { db } from '#db/connection.server.ts'`.

### Worked example: a signed-in CRUD feature

Each block is a whole file. Copy the shape and rename (`posts` becomes your
resource). Child resources (a project's tasks) follow the same pattern: the
child table references the parent with `onDelete: 'cascade'`, and every query
and action checks that the parent belongs to the signed-in user.

```ts
// db/schema.server.ts (columns.server.ts provides table, pk, text, integer, createdAt, index)
import { defineRelations } from 'drizzle-orm';
import { table, pk, text, integer, createdAt, index } from './columns.server.ts';
import { POST_STATUSES } from '#modules/posts/types.ts';

export const users = table('users', {
  id: pk(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  createdAt: createdAt(),
});
export const posts = table('posts', {
  id: pk(),
  ownerId: integer().notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text().notNull(),
  body: text().notNull().default(''),
  status: text({ enum: POST_STATUSES }).notNull().default('draft'),
  publishOn: text(), // 'YYYY-MM-DD' from <input type="date">, or null
  createdAt: createdAt(),
}, (t) => [index(t.ownerId)]);
export const relations = defineRelations({ users, posts }, () => ({}));
export type User = typeof users.$inferSelect;
export type Post = typeof posts.$inferSelect;
```

```ts
// modules/posts/types.ts (browser-safe: components import this, never the schema)
export const POST_STATUSES = ['draft', 'review', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
export interface StatusCounts { draft: number; review: number; published: number; total: number }
```

```ts
// lib/utils/form.ts
import { html } from '@webjsdev/core';
import { labelClass } from '#components/ui/label.ts';
import { inputClass } from '#components/ui/input.ts';

/** What a failed form action hands back to the page as `actionData`. */
export interface FormState { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
export const toId = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

/** A labelled input with its server error under it and the typed value kept. */
export function field(o: { label: string; name: string; type?: string; value?: string; error?: string; required?: boolean }) {
  return html`
    <div class="grid gap-1.5">
      <label for=${o.name} class=${labelClass()}>${o.label}</label>
      <input id=${o.name} name=${o.name} type=${o.type ?? 'text'} value=${o.value ?? ''} ?required=${o.required}
        aria-invalid=${o.error ? 'true' : 'false'} class=${inputClass()}>
      ${o.error ? html`<p class="text-sm text-destructive">${o.error}</p>` : ''}
    </div>`;
}
```

Auth uses the built-in `createAuth` (a signed session cookie) and `node:crypto`
scrypt. No extra package is needed.

```ts
// modules/auth/password.server.ts
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scryptAsync = promisify(scrypt);
export async function hashPassword(pw: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + ((await scryptAsync(pw, salt, 64)) as Buffer).toString('hex');
}
export async function verifyPassword(pw: string, stored: string) {
  const [salt, key] = stored.split(':');
  return timingSafeEqual((await scryptAsync(pw, salt, 64)) as Buffer, Buffer.from(key, 'hex'));
}
```

```ts
// modules/auth/auth.server.ts (server-only: no 'use server')
import { createAuth, Credentials } from '@webjsdev/server';
import { db } from '#db/connection.server.ts';
import { verifyPassword } from './password.server.ts';

const secret = process.env.AUTH_SECRET;
if (!secret) throw new Error('AUTH_SECRET is not set');
export const { auth, signIn, signOut } = createAuth({
  secret,
  pages: { signIn: '/signin', error: '/signin' },
  providers: [Credentials({
    async authorize(c: { email: string; password: string }) {
      const user = await db.query.users.findFirst({ where: { email: c.email } });
      if (!user || !(await verifyPassword(c.password, user.passwordHash))) return null;
      return { id: String(user.id), email: user.email };
    },
  })],
});
export interface SessionUser { id: number; email: string }
export async function getUser(): Promise<SessionUser | null> {
  const u = (await auth())?.user;
  return u?.id ? { id: Number(u.id), email: String(u.email) } : null;
}
```

```ts
// modules/auth/queries/current-user.server.ts (for the layout and public pages)
'use server';
import { getUser, type SessionUser } from '../auth.server.ts';
export async function currentUser(): Promise<SessionUser | null> {
  return getUser();
}

// modules/auth/queries/require-user.server.ts (call first in every signed-in page)
'use server';
import { redirect } from '@webjsdev/core';
import { getUser, type SessionUser } from '../auth.server.ts';
export async function requireUser(): Promise<SessionUser> {
  return (await getUser()) ?? redirect('/signin');
}
```

```ts
// modules/auth/actions/sign-up.server.ts
'use server';
import { db } from '#db/connection.server.ts';
import { users } from '#db/schema.server.ts';
import { isEmail, str } from '#lib/utils/form.ts';
import { hashPassword } from '../password.server.ts';
import { signIn } from '../auth.server.ts';

export async function signUp(fd: FormData) {
  const email = str(fd, 'email').toLowerCase();
  const password = String(fd.get('password') ?? '');
  const fieldErrors: Record<string, string> = {};
  if (!isEmail(email)) fieldErrors.email = 'Enter a valid email address.';
  if (password.length < 8) fieldErrors.password = 'Password must be at least 8 characters.';
  if (!fieldErrors.email && (await db.query.users.findFirst({ where: { email } }))) {
    fieldErrors.email = 'An account with this email already exists.';
  }
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
  await db.insert(users).values({ email, passwordHash: await hashPassword(password) });
  return signIn('credentials', { email, password }, { redirectTo: '/posts' }); // sets the cookie, 302
}
```

Sign-in is the same shape: look the user up, `verifyPassword`, return
`{ success: false, error: 'Invalid email or password.' }` on a mismatch, else
`return signIn('credentials', { email, password }, { redirectTo: '/posts' })`.
Sign-out is an action bound to a form in the layout:

```ts
// modules/auth/actions/sign-out.server.ts
'use server';
import { signOut } from '../auth.server.ts';
export async function signOutUser(_fd: FormData) {
  return signOut({ redirectTo: '/signin' }); // clears the cookie, 302
}
```

```ts
// modules/posts/utils/validate-post.ts (pure: shared by create and update, unit-tested)
import { str } from '#lib/utils/form.ts';
import { POST_STATUSES, type PostStatus } from '../types.ts';
export interface PostInput { title: string; body: string; status: PostStatus; publishOn: string | null }
export function validatePost(fd: FormData) {
  const values = { title: str(fd, 'title'), body: str(fd, 'body'), status: str(fd, 'status') || 'draft', publishOn: str(fd, 'publishOn') };
  const fieldErrors: Record<string, string> = {};
  if (!values.title) fieldErrors.title = 'Title is required.';
  if (!(POST_STATUSES as readonly string[]).includes(values.status)) fieldErrors.status = 'Pick a status.';
  if (values.publishOn && !/^\d{4}-\d{2}-\d{2}$/.test(values.publishOn)) fieldErrors.publishOn = 'Use a valid date.';
  if (Object.keys(fieldErrors).length) return { ok: false as const, fieldErrors, values };
  const data: PostInput = { ...values, status: values.status as PostStatus, publishOn: values.publishOn || null };
  return { ok: true as const, data };
}
```

Reads use the relational API (`db.query.<table>.findMany/findFirst` with an
object `where` and `orderBy`) and always filter by the owner:

```ts
// modules/posts/queries/get-post.server.ts (list-posts.server.ts is the same with findMany + orderBy: { createdAt: 'desc' })
'use server';
import { db } from '#db/connection.server.ts';
import type { Post } from '#db/schema.server.ts';
import { getUser } from '#modules/auth/auth.server.ts';
import { toId } from '#lib/utils/form.ts';

/** The post when it exists AND belongs to the signed-in user, else null (the page throws notFound()). */
export async function getPost(id: string): Promise<Post | null> {
  const user = await getUser();
  const postId = toId(id);
  if (!user || !postId) return null;
  return (await db.query.posts.findFirst({ where: { id: postId, ownerId: user.id } })) ?? null;
}
```

```ts
// modules/posts/queries/count-posts.server.ts (one grouped query, never one per row)
'use server';
import { count, eq } from 'drizzle-orm';
import { db } from '#db/connection.server.ts';
import { posts } from '#db/schema.server.ts';
import { getUser } from '#modules/auth/auth.server.ts';
import type { StatusCounts } from '../types.ts';

export async function countPosts(): Promise<StatusCounts> {
  const c: StatusCounts = { draft: 0, review: 0, published: 0, total: 0 };
  const user = await getUser();
  if (!user) return c;
  const rows = await db.select({ status: posts.status, n: count() }).from(posts)
    .where(eq(posts.ownerId, user.id)).groupBy(posts.status);
  for (const r of rows) { c[r.status] = r.n; c.total += r.n; }
  return c;
}
```

Writes use the query builder with `eq` / `and`, and put the owner in the
`where` so another user's id changes nothing. `create-post.server.ts` is
`validatePost`, then `db.insert(posts).values({ ...v.data, ownerId: user.id }).returning()`,
then `{ success: true, redirect: '/posts/' + post.id }`. `delete-post.server.ts`
reads the id from a hidden input and returns `{ success: true, redirect: '/posts' }`.

```ts
// modules/posts/actions/update-post.server.ts
'use server';
import { and, eq } from 'drizzle-orm';
import { db } from '#db/connection.server.ts';
import { posts } from '#db/schema.server.ts';
import { getUser } from '#modules/auth/auth.server.ts';
import { toId } from '#lib/utils/form.ts';
import { validatePost } from '../utils/validate-post.ts';

export async function updatePost(fd: FormData) {
  const user = await getUser();
  const id = toId(fd.get('id'));
  if (!user || !id) return { success: false, error: 'Not found.', status: 404 };
  const v = validatePost(fd);
  if (!v.ok) return { success: false, fieldErrors: v.fieldErrors, values: v.values };
  const rows = await db.update(posts).set(v.data).where(and(eq(posts.id, id), eq(posts.ownerId, user.id))).returning();
  if (!rows.length) return { success: false, error: 'Not found.', status: 404 };
  return { success: true, redirect: `/posts/${id}` };
}
```

An action a component calls over RPC takes a typed object, checks it, and
returns a result (it never throws or redirects):

```ts
// modules/posts/actions/set-post-status.server.ts
'use server';
import { and, eq } from 'drizzle-orm';
import { db } from '#db/connection.server.ts';
import { posts } from '#db/schema.server.ts';
import { getUser } from '#modules/auth/auth.server.ts';
import { POST_STATUSES, type PostStatus } from '../types.ts';

export interface SetStatusInput { id: number; status: PostStatus }
export async function setPostStatus(input: SetStatusInput) {
  const user = await getUser();
  if (!user) return { success: false, error: 'Sign in first.', status: 401 };
  if (!POST_STATUSES.includes(input.status)) return { success: false, error: 'Bad status.', status: 400 };
  const rows = await db.update(posts).set({ status: input.status })
    .where(and(eq(posts.id, Number(input.id)), eq(posts.ownerId, user.id))).returning();
  return rows.length ? { success: true } : { success: false, error: 'Not found.', status: 404 };
}
```

A component declares reactive properties in the `WebComponent({...})` factory
(attributes arrive kebab-cased: `postId` is `post-id`), keeps local state in
signals, and binds events with an unquoted `@event=${fn}`:

```ts
// modules/posts/components/post-status.ts
import { WebComponent, html, signal } from '@webjsdev/core';
import { setPostStatus } from '../actions/set-post-status.server.ts';
import { POST_STATUSES, type PostStatus } from '../types.ts';
import { labelClass } from '#components/ui/label.ts';
import { nativeSelectClass } from '#components/ui/native-select.ts';

/** Status select that saves on change over RPC, with no page reload. */
export class PostStatusSelect extends WebComponent({ postId: Number, status: String }) {
  note = signal('');
  async onChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const before = this.status;
    this.status = select.value;
    const res = await setPostStatus({ id: this.postId, status: select.value as PostStatus });
    if (res.success) this.note.set('Saved');
    else { this.status = before; select.value = before; this.note.set(res.error ?? 'Could not save'); }
  }
  render() {
    const id = `status-${this.postId}`;
    return html`
      <div class="flex items-center gap-2">
        <label for=${id} class=${labelClass()}>Status</label>
        <select id=${id} class=${nativeSelectClass()} @change=${(e: Event) => this.onChange(e)}>
          ${POST_STATUSES.map((s) => html`<option value=${s} ?selected=${s === this.status}>${s}</option>`)}
        </select>
        <span class="text-xs text-muted-foreground" aria-live="polite">${this.note.get()}</span>
      </div>`;
  }
}
PostStatusSelect.register('post-status');
```

```ts
// app/layout.ts
import { html, asset } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
import { currentUser } from '#modules/auth/queries/current-user.server.ts';
import { signOutUser } from '#modules/auth/actions/sign-out.server.ts';

export const metadata = { title: { default: 'Posts', template: '%s | Posts' } };
export default async function RootLayout({ children }: LayoutProps) {
  const user = await currentUser();
  return html`
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href=${asset('/public/tailwind.css')}>
    <script>if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');</script>
    <style>
      :root {
        color-scheme: light dark;
        --background: light-dark(#ffffff, #14161a); --foreground: light-dark(#17191c, #e6e8eb);
        --card: light-dark(#f7f8fa, #1c1f24); --card-foreground: var(--foreground);
        --primary: light-dark(#2f5bd3, #8fb0ff); --primary-foreground: light-dark(#ffffff, #0b1530);
        --secondary: light-dark(#eef0f3, #2a2e34); --secondary-foreground: var(--foreground);
        --muted: light-dark(#f1f3f5, #23272d); --muted-foreground: light-dark(#5b626b, #9aa1aa);
        --accent: light-dark(#e9edf5, #2a3140); --accent-foreground: var(--foreground);
        --border: light-dark(#e2e5e9, #343a42); --input: var(--border); --ring: light-dark(#8aa4e8, #5b78c4);
        --destructive: light-dark(#c0362c, #f28b82);
      }
      body { margin: 0; background: var(--background); color: var(--foreground); font: 15px/1.6 system-ui, sans-serif; }
    </style>
    <header class="fixed inset-x-0 top-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur">
      <nav class="mx-auto flex h-full max-w-4xl items-center gap-4 px-4">
        <a href="/" class="font-semibold text-foreground no-underline">Posts</a>
        ${user ? html`
          <span class="ml-auto hidden text-sm text-muted-foreground sm:inline">${user.email}</span>
          <form action=${signOutUser} class="ml-auto sm:ml-0"><button class=${buttonClass({ variant: 'outline', size: 'sm' })}>Sign out</button></form>`
        : html`<a href="/signin" class="ml-auto text-sm">Sign in</a>`}
      </nav>
    </header>
    <main class="mx-auto min-h-dvh max-w-4xl px-4 pb-16 pt-20 text-foreground">${children}</main>`;
}
```

```ts
// app/page.ts
import { redirect } from '@webjsdev/core';
import { currentUser } from '#modules/auth/queries/current-user.server.ts';
export default async function Home() {
  redirect((await currentUser()) ? '/posts' : '/signin');
}
```

A page with a form reads `actionData` (typed with `FormState`). The sign-in
and sign-up pages are this shape too, with `if (await currentUser()) redirect('/posts');`
first and `actionData.error` shown above the fields.

```ts
// app/posts/page.ts
import { html } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
import { cardClass } from '#components/ui/card.ts';
import { field, type FormState } from '#lib/utils/form.ts';
import { requireUser } from '#modules/auth/queries/require-user.server.ts';
import { listPosts } from '#modules/posts/queries/list-posts.server.ts';
import { countPosts } from '#modules/posts/queries/count-posts.server.ts';
import { createPost } from '#modules/posts/actions/create-post.server.ts';

export const metadata = { title: 'Your posts' };
export default async function PostsPage({ actionData }: PageProps<'/posts'> & { actionData?: FormState }) {
  await requireUser();
  const [items, counts] = await Promise.all([listPosts(), countPosts()]);
  const e = actionData?.fieldErrors ?? {};
  const v = actionData?.values ?? {};
  return html`
    <h1 class="text-2xl font-semibold">Your posts</h1>
    <p class="mt-1 text-sm text-muted-foreground">${counts.total} total, ${counts.published} published</p>
    <form action=${createPost} class="${cardClass()} mt-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
      ${field({ label: 'Title', name: 'title', value: v.title, error: e.title, required: true })}
      <button class=${buttonClass()}>Create post</button>
    </form>
    <ul class="mt-6 grid gap-3 sm:grid-cols-2">
      ${items.map((p) => html`
        <li class="${cardClass()} p-4">
          <a href="/posts/${p.id}" class="font-medium text-foreground">${p.title}</a>
          <p class="mt-1 text-sm text-muted-foreground">${p.status}</p>
        </li>`)}
    </ul>
    ${items.length ? '' : html`<p class="mt-6 text-muted-foreground">No posts yet.</p>`}`;
}
```

```ts
// app/posts/[id]/page.ts
import { html, notFound } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
import { requireUser } from '#modules/auth/queries/require-user.server.ts';
import { getPost } from '#modules/posts/queries/get-post.server.ts';
import { deletePost } from '#modules/posts/actions/delete-post.server.ts';
import '#modules/posts/components/post-status.ts'; // registers <post-status>

export default async function PostPage({ params }: PageProps<'/posts/[id]'>) {
  await requireUser();
  const post = await getPost(params.id);
  if (!post) notFound();
  return html`
    <h1 class="text-2xl font-semibold">${post.title}</h1>
    ${post.body ? html`<p class="mt-3 whitespace-pre-line">${post.body}</p>` : ''}
    <div class="mt-6 flex flex-wrap items-center gap-3">
      <post-status post-id=${post.id} status=${post.status}></post-status>
      <a href="/posts/${post.id}/edit" class=${buttonClass({ variant: 'outline', size: 'sm' })}>Edit</a>
      <form action=${deletePost} onsubmit="return confirm('Delete this post?')">
        <input type="hidden" name="id" value=${post.id}>
        <button class=${buttonClass({ variant: 'destructive', size: 'sm' })}>Delete</button>
      </form>
    </div>`;
}
```

The edit page loads the row the same way, pre-fills from it
(`const v = actionData?.values ?? { title: post.title, ... }`), and posts a
hidden `id` to `updatePost`. A `<textarea class=${textareaClass()}>` holds its
value as text content; a `<select class=${nativeSelectClass()}>` marks the
current option with `?selected=${s === v.status}`. Both need a `<label for>`.

```ts
// app/not-found.ts
import { html } from '@webjsdev/core';
export default function NotFound() {
  return html`<h1 class="text-2xl font-semibold">Not found</h1><p class="mt-2 text-muted-foreground"><a href="/">Go home</a></p>`;
}
```

```ts
// test/posts/validate-post.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePost } from '#modules/posts/utils/validate-post.ts';
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
test('a post needs a title', () => {
  const r = validatePost(fd({ title: '  ' }));
  assert.equal(r.ok ? '' : r.fieldErrors.title, 'Title is required.');
});
```

### Look and the UI kit

- The palette is the token block in the layout's `<style>`, each colour
  written once as `light-dark(LIGHT, DARK)`; `public/input.css` maps the tokens
  into Tailwind. Pick values that fit the product, and style only with token
  utilities:
  `bg-background text-foreground bg-card text-card-foreground bg-primary
  text-primary-foreground bg-muted text-muted-foreground border-border
  text-destructive ring-ring`. Never a raw colour such as `bg-blue-600`.
- Pin the header with `position: fixed` (never `sticky`) and offset the
  content by its height, as the layout above does. Mobile first: one column
  that widens at `sm:` / `md:`.
- The kit copies class helpers into `components/ui/` (you own them; no need to
  open them): `buttonClass({ variant?: 'default' | 'destructive' | 'outline' |
  'secondary' | 'ghost' | 'link', size?: 'default' | 'xs' | 'sm' | 'lg' |
  'icon' })`, `inputClass()`, `textareaClass()`, `labelClass()`,
  `nativeSelectClass()`, `cardClass({ size?: 'default' | 'sm' })`,
  `badgeClass({ variant?: 'default' | 'secondary' | 'destructive' | 'outline' })`.
  Use them as `class=${buttonClass({ variant: 'outline' })}` on native
  elements. Stateful widgets (dialog, tabs, dropdown menu, tooltip, toasts) are
  custom elements: `npx webjsdev ui add dialog`, then `npx webjsdev ui view dialog`
  for the tags.

### Commands

```sh
npm run dev                    # dev server; PORT=<port> to choose the port
npm run db:generate && npm run db:migrate   # after every schema change
npm run check                  # framework rules (boundaries, forms, components)
npm run typecheck              # TypeScript
npm run test:server            # node:test files under test/
npm run ci                     # every gate, before you push
npx webjsdev ui add <name>     # copy a UI kit primitive into components/ui/
```
