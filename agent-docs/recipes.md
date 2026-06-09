# Recipes

Copy-paste patterns for the most common webjs tasks. Each recipe is the
canonical shape, follow it rather than inventing a variant. The full API
reference lives in the root `AGENTS.md`.

## Schema-first: from scaffold to product (do this FIRST)

A freshly scaffolded app ships an EXAMPLE `User` model, an example
`app/page.ts`, and an example component. They are starting-point references,
not the product. The first thing to do for a real app is replace the example
schema with the real domain models, then build features on top. This is the
transition agents most often get wrong, so it is the first recipe.

> **Two non-negotiables.** NEVER leave the example `User` model in
> `schema.prisma` if the app does not actually have users (delete or replace
> it). NEVER persist app data in JSON files (`data/todos.json`, `db.json`), in
> a module-scope array or `Map`, or in `localStorage`. Those reset on every
> reload and cannot scale. Every piece of stored data is a Prisma model.

1. **Edit `prisma/schema.prisma`** to the real domain. Replace the example
   `User` model with the models the app needs.

   ```prisma
   // prisma/schema.prisma
   model Post {
     id        String   @id @default(cuid())
     title     String
     body      String
     published Boolean  @default(false)
     createdAt DateTime @default(now())
   }
   ```

   Start the dev server with `npm run dev` (the canonical command), NOT a bare
   `webjs dev`: `npm run dev` runs the `predev` hook (`prisma generate`) first,
   while `webjs dev` skips it and boots against an ungenerated client. A bare
   `webjs dev` will now warn and point you back at `npm run dev`, but use the
   npm script from the start.

2. **Migrate.** Run the npm script (not the `webjs`/`prisma` binary directly,
   so the `predev` / `db:*` hooks fire):

   ```sh
   npm run db:migrate -- --name add_post
   ```

   This creates the migration, applies it to the dev SQLite database, and
   regenerates the Prisma client.

3. **Generate one query and one action per operation**, one exported function
   per file, named after the file, under the feature module. Reads go in
   `queries/`, mutations in `actions/`. Both are `.server.ts` with
   `'use server'`, so their browser imports become typed RPC stubs.

   ```ts
   // modules/posts/queries/list-posts.server.ts
   'use server';
   import { prisma } from '../../../lib/prisma.server.ts';
   export async function listPosts() {
     return prisma.post.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' } });
   }
   ```

   ```ts
   // modules/posts/actions/create-post.server.ts
   'use server';
   import { prisma } from '../../../lib/prisma.server.ts';
   export async function createPost(input: { title: string; body: string }) {
     const title = String(input?.title || '').trim();
     if (!title) return { success: false, error: 'title required', status: 400 };
     const post = await prisma.post.create({ data: { title, body: String(input?.body || '') } });
     return { success: true, data: post };
   }
   ```

4. **Wire it into a page** by calling the query (the page runs on the server,
   so it imports the `.server` query directly and awaits it). Never import
   `@prisma/client` into a page; reach the database through the query.

   ```ts
   // app/posts/page.ts
   import { html } from '@webjsdev/core';
   import { listPosts } from '../../modules/posts/queries/list-posts.server.ts';
   export default async function Posts() {
     const posts = await listPosts();
     return html`<ul>${posts.map((p) => html`<li>${p.title}</li>`)}</ul>`;
   }
   ```

For the write path, pair `create-post.server.ts` with a `<form>` plus a page
`action` or a `route.ts` POST handler (see the form-mutation recipe below), so
it works without JavaScript and the client router upgrades it automatically.

## Add a page

```ts
// app/about/page.ts
import { html } from '@webjsdev/core';
export default function About() {
  return html`<h1>About</h1>`;
}
```

## Add a dynamic route

```ts
// app/users/[id]/page.ts
import { html } from '@webjsdev/core';
export default async function User({ params }: { params: { id: string } }) {
  const user = await fetchUser(params.id); // via a server action, never import the DB directly
  return html`<h1>${user.name}</h1>`;
}
```

## Add a server action (RPC from a client component)

```ts
// modules/users/actions/update-profile.server.ts
'use server';
import { prisma } from '../../../lib/prisma.server.ts';
export async function updateProfile(input: { name: string }) {
  const name = String(input?.name || '').trim();
  if (!name) return { success: false, error: 'name required', status: 400 };
  const row = await prisma.user.update({ where: { id: me.id }, data: { name } });
  return { success: true, data: row };
}
```

Call it from a client component via a normal import. The dev server
rewrites the import to a typed RPC stub.

## Validate a server action's input once, for both call paths (#245)

`validateInput(fn, validate)` attaches an input validator that runs
SERVER-SIDE before the action body on EVERY call path (the RPC path a
client component import takes AND the `expose()` REST route if the action
has one). On failure it returns a structured `ActionResult`
(`{ success: false, fieldErrors, status: 422 }`) the client reads as
`result.fieldErrors`. The framework ships no validation library; the
validator is a plain function (or a three-line zod adapter).

```ts
// modules/posts/actions/create-post.server.ts
'use server';
import { validateInput } from '@webjsdev/core';
import { prisma } from '../../../lib/prisma.server.ts';

export const createPost = validateInput(
  // the action body: runs ONLY when validation passes
  async (input: { title: string; body: string }) => {
    const row = await prisma.post.create({ data: input });
    return { success: true, data: row };
  },
  // the validator: receives the action's FIRST argument
  (input) => {
    const fieldErrors: Record<string, string> = {};
    const title = String(input?.title || '').trim();
    if (!title) fieldErrors.title = 'Title is required';
    if (String(input?.body || '').length < 10) fieldErrors.body = 'Too short';
    if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
    return { success: true, data: { title, body: String(input.body) } }; // coerced input
  },
);
```

Reading the structured failure in a client component is just a property
read on the returned object (an invalid call resolves with the failure
envelope, it does NOT throw):

```ts
// components/post-form.ts (browser)
import { createPost } from '../modules/posts/actions/create-post.server.ts';

const result = await createPost({ title: this.title, body: this.body });
if (!result.success) {
  this.errors = result.fieldErrors ?? {};   // { title: 'Title is required', ... }
  return;
}
// result.data is the created row
```

**Zod adapter (keeps the framework zod-free):** wrap `safeParse` so its
result becomes the contract envelope.

```ts
import { z } from 'zod';
const Schema = z.object({ title: z.string().min(1), body: z.string().min(10) });

export const createPost = validateInput(
  async (input) => { /* ... */ },
  (i) => {
    const r = Schema.safeParse(i);
    return r.success
      ? { success: true, data: r.data }
      : { success: false, fieldErrors: r.error.flatten().fieldErrors };
  },
);
```

To ALSO expose the action as REST with the SAME validator, pass `validate`
to `expose()` instead of using `validateInput`:
`expose('POST /api/posts', fn, { validate })`. A `{ success: false,
fieldErrors }` return becomes a 422 JSON response there; a validator that
THROWS (the classic `Schema.parse` style) becomes a 400, and a non-envelope
return transforms the input (back-compat).

## Add a component

```ts
// components/hello-world.ts
import { WebComponent, html } from '@webjsdev/core';
export class HelloWorld extends WebComponent {
  render() { return html`<p>Hello!</p>`; }
}
HelloWorld.register('hello-world');
```

## Form mutation with server-side validation (no JS required)

This is webjs's progressive-enhancement write-path. A `<form method="POST">`
posts to a page `action` that validates on the server, re-renders the page
with field errors on failure (preserving the user's input), and redirects
on success. It works with JS disabled, and the client router upgrades it to
an in-place swap when JS is on, same UI either way. No form library.

A `page.{js,ts}` may export an `action` next to its default render
function. A non-GET/HEAD submission to the page's own URL runs the action,
wrapped in the page's segment middleware.

```ts
// app/contact/page.ts
import { html } from '@webjsdev/core';
import { sendMessage } from '../../modules/contact/actions/send-message.server.ts';

// Runs only on the server. Receives the already-parsed `formData` plus the
// raw `request`, `params`, `searchParams`, and `url`.
export async function action({ formData }: { formData: FormData }) {
  const email = String(formData.get('email') || '').trim();
  const body = String(formData.get('body') || '').trim();
  const values = { email, body };
  const fieldErrors: Record<string, string> = {};
  if (!email.includes('@')) fieldErrors.email = 'Enter a valid email';
  if (body.length < 10) fieldErrors.body = 'Message is too short';
  if (Object.keys(fieldErrors).length) {
    return { success: false, fieldErrors, values, status: 422 };
  }
  await sendMessage({ email, body });
  return { success: true, redirect: '/contact/thanks' };
}

export default function Contact({ actionData }: {
  actionData?: { fieldErrors?: Record<string, string>; values?: Record<string, string> };
}) {
  const errors = actionData?.fieldErrors || {};
  const values = actionData?.values || {};
  return html`
    <form method="POST" class="flex flex-col gap-3">
      <input name="email" type="email" value=${values.email || ''} required>
      ${errors.email ? html`<p class="text-sm text-red-600">${errors.email}</p>` : ''}
      <textarea name="body" required>${values.body || ''}</textarea>
      ${errors.body ? html`<p class="text-sm text-red-600">${errors.body}</p>` : ''}
      <button type="submit">Send</button>
    </form>
  `;
}
```

### How the result is interpreted (server side)

| Action outcome | HTTP response |
|---|---|
| success result (see the failure rule below) | `303 See Other` to a same-site `redirect` if present, else the page's own path (Post/Redirect/Get) |
| thrown `redirect('/x')` | `307` (method-preserving, the action default since it is a POST), or the explicit status if `redirect('/x', 308)` / `redirect('/x', { status })` was used. A redirect thrown during a plain GET page render instead defaults to `302`. |
| thrown `notFound()` | `404` rendered via `not-found.{js,ts}` |
| failure result (`success: false`, or `fieldErrors`, or an `error`) | re-SSR the SAME page with `status` (default `422`) and the result on `ctx.actionData` |

**Failure detection is robust.** A result is treated as a FAILURE (re-render)
when ANY of these hold, so an error is never swallowed just because the author
omitted a literal `success: false`:

- `result.success === false`, OR
- `result.fieldErrors` is present, OR
- `result.error` is present AND `result.success !== true`.

Everything else is a success (explicit `success: true`, or a bare value /
`undefined` / `null` with no error markers), which PRG-redirects.

**`result.redirect` must be a same-site local path.** It is honored only when
it begins with a single `/` (a relative path like `/login` or `/a?b=1#c`). A
protocol-relative `//host` and any absolute `scheme://host` URL are rejected and
the redirect falls back to the page's own path, because a user-controlled
redirect target is an open-redirect vector. For a legitimate EXTERNAL redirect,
throw `redirect(absoluteUrl)` (the nav sentinel, author-controlled) instead of
returning it as `result.redirect`.

### The `ActionResult` shape

The envelope is additive over the existing `{ success, data, error, status }`:

```ts
type ActionResult<T> =
  | { success: true; data?: T; redirect?: string }  // redirect MUST be a same-site local path
  | {
      success: false;
      error?: string;
      fieldErrors?: Record<string, string>; // per-field messages, keyed by input `name`
      values?: Record<string, string>;       // the submitted values (text fields), to repopulate inputs
      status?: number;                        // defaults to 422 on the re-render
    };
```

The page reads `ctx.actionData?.fieldErrors?.<name>` for the message and
`ctx.actionData?.values?.<name>` to set a native `value=`. On a plain GET
render `actionData` is `undefined`, so the page renders empty inputs and no
error blocks. (`values` carries text fields as strings; for a file upload see
the "Receive and persist an uploaded file" recipe below.)

### Why no `fetch` in a `@click` handler here

Native `<input value=...>` repopulation plus the browser's Constraint
Validation API (`required`, `type="email"`, `minlength`) cover the input
side, and the server action result carries the field-level errors. Reaching
for `fetch` + a JS submit handler would break the no-JS baseline. Use a
`<form>` + a page `action` for any write-path that a form can express.

See `agent-docs/advanced.md` for the client-router side (how the enhanced
303/422 swap works) and the rest of the form-submission behavior.

## Receive and persist an uploaded file

A file upload is just a `<form enctype="multipart/form-data">` posting to a page
`action`. With JS disabled it is a native round-trip; with JS the client router
upgrades it in place. No upload library, no `fetch`. The bytes are STREAMED to
storage via the file-storage primitive (`getFileStore()`), never buffered whole,
and a `route.{js,ts}` serves them back through a signed URL.

```ts
// app/avatar/page.ts
import { html } from '@webjsdev/core';
import { saveAvatar } from '../../modules/avatar/actions/save-avatar.server.ts';

export async function action({ formData }: { formData: FormData }) {
  const file = formData.get('avatar');               // a web `File`
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, fieldErrors: { avatar: 'Choose an image' }, status: 422 };
  }
  const result = await saveAvatar(file);             // persists + returns the key
  if (!result.success) return result;
  return { success: true, redirect: '/avatar' };
}

export default function Avatar({ actionData }: {
  actionData?: { fieldErrors?: Record<string, string> };
}) {
  const errors = actionData?.fieldErrors || {};
  return html`
    <form method="POST" enctype="multipart/form-data" class="flex flex-col gap-3">
      <input name="avatar" type="file" accept="image/*" required>
      ${errors.avatar ? html`<p class="text-sm text-red-600">${errors.avatar}</p>` : ''}
      <button type="submit">Upload</button>
    </form>
  `;
}
```

The action delegates to a `.server` action that streams the file to storage with
a generated, traversal-safe key and persists that key on the DB row. Never use
the user-supplied filename as a key; `generateKey` makes an opaque one.

```ts
// modules/avatar/actions/save-avatar.server.ts
'use server';
import { getFileStore, generateKey } from '@webjsdev/server';
import { prisma } from '../../../lib/prisma.server.ts';

export async function saveAvatar(file: File) {
  const key = generateKey(file.name);                // <uuid>.<ext>, safe
  const { size, contentType } = await getFileStore().put(key, file); // streams to disk
  if (size > 5 * 1024 * 1024) {                      // app-level policy check
    await getFileStore().delete(key);
    return { success: false, fieldErrors: { avatar: 'Max 5 MB' }, status: 422 };
  }
  await prisma.user.update({ where: { id: 'me' }, data: { avatarKey: key } });
  return { success: true, data: { key, contentType } };
}
```

Serve the stored file from a `route.{js,ts}`, streaming `get(key)` and (optionally)
gating it behind a signed URL so the object is not world-readable by key alone.

```ts
// app/files/[key]/route.ts
import { getFileStore, verifySignedUrl } from '@webjsdev/server';

export async function GET(request: Request, { params }: { params: { key: string } }) {
  const check = verifySignedUrl(new URL(request.url).searchParams, process.env.AUTH_SECRET!);
  if (!check.valid || check.key !== params.key) {
    return new Response('Forbidden', { status: 403 });
  }
  const handle = await getFileStore().get(params.key);
  if (!handle) return new Response('Not Found', { status: 404 });
  return new Response(handle.body, {            // streams; never reads the file into memory
    headers: {
      'content-type': handle.contentType,
      'content-length': String(handle.size),
      // SECURITY (do NOT drop these for user-uploaded bytes). The stored
      // content-type came from the UPLOAD, which is client-controlled, so an
      // attacker can upload HTML/SVG tagged `text/html` under an innocent key.
      // `nosniff` stops the browser MIME-sniffing it into HTML, and
      // `attachment` forces a download instead of rendering it in your origin,
      // which is what turns an upload into stored XSS.
      'x-content-type-options': 'nosniff',
      'content-disposition': 'attachment',
    },
  });
}
```

Mint the signed URL where you render the link (a page or component):

```ts
import { signedUrl } from '@webjsdev/server';
const href = signedUrl(user.avatarKey, { secret: process.env.AUTH_SECRET!, expiresIn: 3600 });
```

> **Serving user uploads safely (the canonical upload vulnerability).** The
> content-type a store records is the one the BROWSER sent at upload time, so it
> is attacker-controlled. Serving it inline lets an attacker run script in your
> origin (stored XSS) via an HTML or `image/svg+xml` payload under an innocent
> key. ALWAYS send `X-Content-Type-Options: nosniff`, and prefer
> `Content-Disposition: attachment` for anything a user uploaded. Only serve a
> user upload INLINE (no `attachment`) when you have validated the bytes
> server-side and are emitting a content-type from a strict inert allowlist
> (e.g. `image/png`, `image/jpeg`), never reflecting `text/html` or
> `image/svg+xml`. Best of all, serve user uploads from a SEPARATE origin / cookieless
> subdomain so even a sniffing bypass cannot reach your session.

For a public asset you control, you may drop the signature and serve
`getFileStore().get(key)` directly, but keep `nosniff` + `attachment` for
anything a user supplied. To point storage at a custom directory or an
S3-compatible backend, call `setFileStore(diskStore({ dir, baseUrl }))` (or a
custom adapter) once at startup; the call sites above do not change. The default
uploads directory is `<cwd>/.webjs/uploads`, which the app should `.gitignore`.
See the "File storage" section in `agent-docs/built-ins.md` for the full
interface and the traversal-safety + signed-URL guarantees.
