# Recipes

Copy-paste patterns for the most common webjs tasks. Each recipe is the
canonical shape, follow it rather than inventing a variant. The full API
reference lives in the root `AGENTS.md`.

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
| thrown `redirect('/x')` | `307`/`308` (keeps the status `redirect()` was called with) |
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
error blocks. (`values` carries text fields as strings; file uploads are a
separate concern, tracked in #247.)

### Why no `fetch` in a `@click` handler here

Native `<input value=...>` repopulation plus the browser's Constraint
Validation API (`required`, `type="email"`, `minlength`) cover the input
side, and the server action result carries the field-level errors. Reaching
for `fetch` + a JS submit handler would break the no-JS baseline. Use a
`<form>` + a page `action` for any write-path that a form can express.

See `agent-docs/advanced.md` for the client-router side (how the enhanced
303/422 swap works) and the rest of the form-submission behavior.
