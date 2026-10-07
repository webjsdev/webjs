## Build an app (full-stack template)

Everything a typical app needs is in this file: build straight from it, in a
few large writes (one heredoc per group of files), without exploring.

### Build steps

1. One command: `git checkout -b feat/<name> && npm run gallery:clear && npx webjsdev ui add button input label textarea native-select card badge`.
   The gallery is a demo for people; never read it.
2. Replace `db/schema.server.ts` whole, then `npm run db:generate && npm run db:migrate`.
3. Write every `modules/` file, then `app/layout.ts`, `app/page.ts` (replace
   both whole, no need to read them), the other pages, `app/not-found.ts`, and
   a `test/<feature>/*.test.ts` for the validation helpers.
4. `npm run check && npm run typecheck && npm run test:server`; fix what they say.
5. Walk it once in a browser (`curl` cannot submit a bound form: it carries a
   hidden action field). Write `walk.mjs` in the app folder FIRST (Playwright is
   installed: `import { chromium } from 'playwright'`), then start
   `PORT=<port> npm run dev > dev.log 2>&1 &` (writing files while it runs
   triggers reloads). In the script: `page.on('dialog', (d) => d.accept())` for
   `confirm()`, `getByRole('button', { name, exact: true })`, and wait for each
   outcome with `waitForURL(...)` or `getByText(...).waitFor()` (a submit is
   applied in place, no full load), never a fixed timeout. Save a phone and a
   desktop screenshot under `/tmp` and look at them. Then stop the server and
   delete `walk.mjs`.
6. Commit once (see Git).

### How WebJs works

- Pages and layouts run only on the server and never hydrate (`@click` in a
  page does nothing). Interactivity is a `WebComponent` custom element; the
  page imports its file and writes its tag.
- `*.server.ts` with `'use server';` first: its exported async functions are
  actions, called directly by pages and over RPC by components. Without
  `'use server'` it is server-only (DB, secrets, `node:*`, `createAuth`):
  import it only from other `.server.ts` files, `route.ts` or `middleware.ts`,
  never from a page, layout or component.
- `<form action=${someAction}>` is the whole form wiring (no method, no fetch,
  works without JS). The action gets the `FormData` and returns
  `{ success: true, redirect: '/path' }` (303), or
  `{ success: false, error?, fieldErrors?, status? }`: the same page re-renders
  (422) with it as `actionData`, and `actionData.values` holds every submitted
  text field. A returned `Response` (from `signIn`) is sent as is.
- `notFound()` and `redirect(url)` from `@webjsdev/core` throw: pages, layouts,
  form actions. In `route.ts` return a `Response`; in an RPC action return
  `{ success: false, error }`.

### Files

```
app/layout.ts  app/page.ts  app/not-found.ts      root layout, /, 404
app/<seg>/[id]/page.ts, app/<seg>/[id]/edit/page.ts   params.id is a string
app/<path>/route.ts            export async function GET(req, { params })
modules/<f>/queries/*.server.ts, modules/<f>/actions/*.server.ts   'use server', one function per file
modules/<f>/components/<tag>.ts, modules/<f>/utils/*.ts, modules/<f>/types.ts   browser-safe
lib/utils/*.ts                 app-wide browser-safe helpers
db/schema.server.ts            tables; `db` is exported by db/connection.server.ts
```

Imports use the `#` alias with `.ts`: `import { db } from '#db/connection.server.ts'`.

### Worked example: signed-in, owner-scoped CRUD

Whole files; rename `posts` to your resource. A child resource (a project's
tasks) references its parent with `onDelete: 'cascade'`, and every query and
action checks the parent belongs to the user.

```ts
// db/schema.server.ts
import { defineRelations } from 'drizzle-orm';
import { table, pk, text, integer, createdAt, index } from './columns.server.ts';
import { POST_STATUSES } from '#modules/posts/types.ts';
export const users = table('users', {
  id: pk(), email: text().notNull().unique(), passwordHash: text().notNull(), createdAt: createdAt(),
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
export type Post = typeof posts.$inferSelect;

// modules/posts/types.ts (browser-safe; components never import the schema)
export const POST_STATUSES = ['draft', 'review', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
```

```ts
// lib/utils/form.ts
import { html } from '@webjsdev/core';
import { labelClass } from '#components/ui/label.ts';
import { inputClass } from '#components/ui/input.ts';
export interface FormState { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
export const toId = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };
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

Auth is the built-in `createAuth` (a signed session cookie). Hash passwords in
`modules/auth/password.server.ts` with `node:crypto` `scrypt`, a random salt
stored as `salt:hash`, and `timingSafeEqual` (`hashPassword`, `verifyPassword`).

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

// modules/auth/queries/current-user.server.ts: 'use server' + export async function currentUser() { return getUser(); }

// modules/auth/queries/require-user.server.ts (first line of every signed-in page)
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
  if (!fieldErrors.email && (await db.query.users.findFirst({ where: { email } }))) fieldErrors.email = 'An account with this email already exists.';
  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
  await db.insert(users).values({ email, passwordHash: await hashPassword(password) });
  return signIn('credentials', { email, password }, { redirectTo: '/posts' }); // cookie + 302
}
```

Sign-in: look the user up, `verifyPassword`, return
`{ success: false, error: 'Invalid email or password.' }` on a mismatch, else
the same `return signIn(...)`. Sign-out: an action
`export async function signOutUser(_fd: FormData) { return signOut({ redirectTo: '/signin' }); }`
bound to a form in the layout.

```ts
// modules/posts/utils/validate-post.ts (pure, shared by create and update, unit-tested)
import { str } from '#lib/utils/form.ts';
import { POST_STATUSES, type PostStatus } from '../types.ts';
export function validatePost(fd: FormData) {
  const values = { title: str(fd, 'title'), body: str(fd, 'body'), status: str(fd, 'status') || 'draft', publishOn: str(fd, 'publishOn') };
  const fieldErrors: Record<string, string> = {};
  if (!values.title) fieldErrors.title = 'Title is required.';
  if (!(POST_STATUSES as readonly string[]).includes(values.status)) fieldErrors.status = 'Pick a status.';
  if (values.publishOn && !/^\d{4}-\d{2}-\d{2}$/.test(values.publishOn)) fieldErrors.publishOn = 'Use a valid date.';
  if (Object.keys(fieldErrors).length) return { ok: false as const, fieldErrors, values };
  return { ok: true as const, data: { ...values, status: values.status as PostStatus, publishOn: values.publishOn || null } };
}
```

Reads use `db.query.<table>.findFirst/findMany` with an object `where` and
`orderBy`, always filtered by the owner; counts are one grouped query.

```ts
// modules/posts/queries/get-post.server.ts (list-posts: findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } }))
'use server';
import { db } from '#db/connection.server.ts';
import type { Post } from '#db/schema.server.ts';
import { getUser } from '#modules/auth/auth.server.ts';
import { toId } from '#lib/utils/form.ts';
export async function getPost(id: string): Promise<Post | null> {
  const user = await getUser();
  const postId = toId(id);
  if (!user || !postId) return null;
  return (await db.query.posts.findFirst({ where: { id: postId, ownerId: user.id } })) ?? null;
}

// modules/posts/queries/count-posts.server.ts (inside the function, after the user check)
const rows = await db.select({ status: posts.status, n: count() }).from(posts) // count, eq from 'drizzle-orm'
  .where(eq(posts.ownerId, user.id)).groupBy(posts.status);
```

Writes use the query builder with `eq` / `and` and put the owner in the
`where`, so another user's id changes nothing:

```ts
// modules/posts/actions/update-post.server.ts ('use server'; create and delete are the same shape)
export async function updatePost(fd: FormData) {
  const user = await getUser();
  const id = toId(fd.get('id'));
  if (!user || !id) return { success: false, error: 'Not found.', status: 404 };
  const v = validatePost(fd);
  if (!v.ok) return { success: false, fieldErrors: v.fieldErrors, values: v.values };
  const rows = await db.update(posts).set(v.data).where(and(eq(posts.id, id), eq(posts.ownerId, user.id))).returning();
  return rows.length ? { success: true, redirect: `/posts/${id}` } : { success: false, error: 'Not found.', status: 404 };
}
// create: const [post] = await db.insert(posts).values({ ...v.data, ownerId: user.id }).returning(); then redirect to `/posts/${post.id}`
```

A component calls an RPC action with a typed object; the action checks the
user and the input and returns a result (never throws or redirects), for
example `setPostStatus(input: { id: number; status: PostStatus })` returning
`{ success: true }` or `{ success: false, error }`. Reactive properties are
declared in the `WebComponent({...})` factory (`postId` arrives as the
`post-id` attribute), local state is a signal, events are unquoted `@event=${fn}`:

```ts
// modules/posts/components/post-status.ts
import { WebComponent, html, signal } from '@webjsdev/core';
import { setPostStatus } from '../actions/set-post-status.server.ts';
import { POST_STATUSES, type PostStatus } from '../types.ts';
import { labelClass } from '#components/ui/label.ts';
import { nativeSelectClass } from '#components/ui/native-select.ts';
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
      :root { color-scheme: light dark;
        --background: light-dark(#fff, #14161a); --foreground: light-dark(#17191c, #e6e8eb); --card: light-dark(#f7f8fa, #1c1f24);
        --card-foreground: var(--foreground); --primary: light-dark(#2f5bd3, #8fb0ff); --primary-foreground: light-dark(#fff, #0b1530);
        --muted: light-dark(#f1f3f5, #23272d); --muted-foreground: light-dark(#5b626b, #9aa1aa); --accent: light-dark(#e9edf5, #2a3140);
        --border: light-dark(#e2e5e9, #343a42); --input: var(--border); --ring: light-dark(#8aa4e8, #5b78c4); --destructive: light-dark(#c0362c, #f28b82); }
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
    <main class="mx-auto min-h-dvh max-w-4xl px-4 pb-16 pt-20">${children}</main>`;
}
```

`app/page.ts`: `export default async function Home() { redirect((await currentUser()) ? '/posts' : '/signin'); }`.
`app/not-found.ts` default-exports a function returning the 404 `html`.

A page with a form reads `actionData` typed as `FormState`. Sign-in and
sign-up pages are this shape too, starting with
`if (await currentUser()) redirect('/posts');` and showing `actionData.error`.

```ts
// app/posts/page.ts
import { html } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { buttonClass } from '#components/ui/button.ts';
import { cardClass } from '#components/ui/card.ts';
import { field, type FormState } from '#lib/utils/form.ts';
import { requireUser } from '#modules/auth/queries/require-user.server.ts';
import { listPosts } from '#modules/posts/queries/list-posts.server.ts';
import { createPost } from '#modules/posts/actions/create-post.server.ts';
export const metadata = { title: 'Your posts' };
export default async function PostsPage({ actionData }: PageProps<'/posts'> & { actionData?: FormState }) {
  await requireUser();
  const items = await listPosts();
  const e = actionData?.fieldErrors ?? {};
  const v = actionData?.values ?? {};
  return html`
    <h1 class="text-2xl font-semibold">Your posts</h1>
    <form action=${createPost} class="${cardClass()} mt-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
      ${field({ label: 'Title', name: 'title', value: v.title, error: e.title, required: true })}
      <button class=${buttonClass()}>Create post</button>
    </form>
    <ul class="mt-6 grid gap-3 sm:grid-cols-2">
      ${items.map((p) => html`<li class="${cardClass()} p-4"><a href="/posts/${p.id}" class="font-medium">${p.title}</a></li>`)}
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
current option with `?selected=${s === v.status}`; each has a `<label for>`.

Tests are `node:test` files: `import { test } from 'node:test'`,
`import assert from 'node:assert/strict'`, build a `FormData` and assert on
`validatePost(fd)`.

### Look and the UI kit

- The palette is the token block in the layout, one `light-dark(LIGHT, DARK)`
  per colour; `public/input.css` maps the tokens into Tailwind. Choose values
  for the product, and style only with token utilities (`bg-background
  text-foreground bg-card bg-primary text-primary-foreground bg-muted
  text-muted-foreground border-border text-destructive`), never a raw colour
  such as `bg-blue-600`.
- The header is `position: fixed` (never `sticky`) with the content offset by
  its height. Mobile first: one column that widens at `sm:` / `md:`.
- UI kit helpers in `components/ui/` (no need to open them):
  `buttonClass({ variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link', size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon' })`,
  `inputClass()`, `textareaClass()`, `labelClass()`, `nativeSelectClass()`,
  `cardClass()`, `badgeClass({ variant?: 'default' | 'secondary' | 'destructive' | 'outline' })`,
  used as `class=${buttonClass({ variant: 'outline' })}`. Dialogs, tabs, menus
  and toasts are custom elements: `npx webjsdev ui add dialog`, then
  `npx webjsdev ui view dialog`.

### Commands

`npm run dev` (PORT=<port>), `npm run db:generate && npm run db:migrate`,
`npm run check`, `npm run typecheck`, `npm run test:server`, `npm run ci`
(every gate, before you push), `npx webjsdev ui add <name>`.
