# Types and mutations: sharing server-derived shapes with the browser

An interactive component that ships to the browser almost always needs the
shape of the data it renders (`Todo`, `Post`, the `ActionResult<T>` envelope a
mutation returns). Those shapes are DERIVED from server-only modules (the
Drizzle schema, the action files), so the reflex is to import them straight from
`db/schema.server.ts` or a `*.server.ts` action. That reflex pins a server
module to a browser closure and breaks the build. This page codifies where the
types live so a shipping component consumes them safely.

The one rule. **A type crossing to the browser is a TYPE, never a runtime
value.** Keep the shape in a browser-safe `modules/<feature>/types.ts` with no
runtime import from a `.server.ts` file or from `db/`. A `import type { ... }`
is erased by the TypeScript stripper before the module reaches the browser, so
it is safe. A plain `import { ... }` (a value import) is NOT erased, so it pins
the server module and trips the `no-server-import-in-browser-module` check.

---

## Why a value import breaks and a type import does not

webjs strips TypeScript at runtime with no bundler. The stripper erases every
`import type` and every type-only specifier, so those imports never exist in the
served JavaScript. A value import survives stripping and becomes a real browser
`import`. When the target is a `.server.ts` module, its browser stub throws at
module load (invariant 1), and the `no-server-import-in-browser-module` check
flags it statically for any module the framework determines actually ships.

```ts
// SAFE: type-only, erased before it reaches the browser.
import type { Post } from '#db/schema.server.ts';

// UNSAFE: a runtime value import of the server schema. Survives stripping,
// pins db/schema.server.ts into the browser closure, throws at load.
import { posts } from '#db/schema.server.ts';
```

The subtle trap is deriving a type from a value with a value import. `typeof
posts.$inferSelect` needs the `posts` binding, and `import { posts }` is a value
import even though you only use it at the type level. Write `import type` (rc.3
schemas already `export type Post = typeof posts.$inferSelect`, so import the
ready-made type), or hand-write the DTO in `types.ts`.

---

## The wrong chain: a types module re-exporting a runtime value

The classic failure is a `types.ts` that looks type-only but carries a runtime
re-export. A browser-shipped page or component imports it, and the whole server
schema is dragged along.

```ts
// modules/posts/types.ts   WRONG
// A star or value re-export carries the runtime `posts`, `users` table
// bindings, not just their types.
export * from '#db/schema.server.ts';           // re-exports VALUES
export { posts } from '#db/schema.server.ts';    // re-exports a VALUE
```

```ts
// components/post-card.ts   (an interactive component, ships to the browser)
import type { Post } from '#modules/posts/types.ts';
// Because types.ts value-re-exports the schema, the browser module graph now
// reaches db/schema.server.ts. no-server-import-in-browser-module fails, and
// at runtime the server stub throws the moment post-card.ts loads.
```

The check fires on the component (a shipping browser module), even though the
mistake is in `types.ts`. The re-export made a server value reachable from a
browser closure.

---

## The right chain: a browser-safe DTO in `types.ts`

Define the wire shape as a plain interface (or a `type`) in `types.ts` with no
runtime import. This is the DTO the query / action returns and the component
consumes. It has zero server dependency, so it crosses the boundary freely.

```ts
// modules/posts/types.ts   RIGHT
// A hand-written DTO. No import from db/ or any *.server.ts. Pure types.
export type PostFormatted = {
  id: number;
  slug: string;
  title: string;
  body: string;
  authorId: number;
  authorName: string | null;
  createdAt: string;   // serialized for the wire
};

export type CreatePostInput = { title: string; body: string };

// The mutation envelope every action returns. Browser-safe, no server import.
export type ActionResult<T> =
  | { success: true; data?: T; redirect?: string }
  | { success: false; error?: string; fieldErrors?: Record<string, string>;
      values?: Record<string, string>; status?: number };
```

```ts
// modules/posts/queries/list-posts.server.ts   (server: may touch db)
import { db } from '#db/connection.server.ts';
import type { PostFormatted } from '#modules/posts/types.ts';
export async function listPosts(): Promise<PostFormatted[]> {
  const rows = await db.query.posts.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(formatPost);   // maps the row to the DTO
}
```

```ts
// components/post-card.ts   (browser: consumes the DTO type only)
import type { PostFormatted } from '#modules/posts/types.ts';
```

If you want the DTO to track the schema automatically rather than restating it,
use a **type-only** derivation and keep it in `types.ts`.

```ts
// modules/posts/types.ts   RIGHT (type-only derivation, still erased)
import type { Post } from '#db/schema.server.ts';   // type-only, erased
export type PostFormatted = Omit<Post, 'createdAt'> & { createdAt: string };
```

Either form ships nothing server-side to the browser. The `import type` is the
seam. A value import is the leak.

---

## Carrier choice: register an interactive component in `layout.ts`

An interactive component reaches the browser because SOME module imports it and
that module ships. A `page.ts` and a `layout.ts` never hydrate, but they DO load
in the browser to register the components they import. When a page's ONLY reason
to ship is registering a component, prefer registering that component in
`app/layout.ts` (or a section layout), not `app/page.ts`.

The reason is elision economics. A `page.ts` whose sole client job is
registering a component is dropped by the framework, and the browser fetches the
component leaf directly (the import-only page optimization). But when you have a
component shared across a section (a header search box, a theme toggle, a cart
button), the layout is the natural single carrier. Register it once there and
every page under it gets the upgraded element with no per-page import.

```ts
// app/layout.ts   RIGHT: the section carrier registers shared interactive UI
import '#components/theme-toggle.ts';   // registers <theme-toggle> for every page
import '#components/ui/dialog.ts';      // registers the Tier-2 <ui-dialog> element

export default function RootLayout({ children }) {
  return html`... <theme-toggle></theme-toggle> ${children} ...`;
}
```

```ts
// app/page.ts   RIGHT: page stays a pure server function, no client import
export default function Home() {
  return html`<h1>Home</h1><theme-toggle></theme-toggle>`;   // tag already registered by the layout
}
```

Register in `page.ts` only when the component is page-specific (used on that one
route). A shared element registered per page duplicates the import intent across
routes and muddies which module is the carrier. Keep pages pure server functions
where you can, and let the nearest layout carry the shared interactive tags.

Cross-references. The server-only boundary and the type-only-import exception
are invariant 1 in the root `AGENTS.md`. The Drizzle query surface that produces
these rows is in `agent-docs/orm.md`. The optimistic mutation flow that consumes
`ActionResult<T>` on the client is in `agent-docs/advanced.md`.
