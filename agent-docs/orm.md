# ORM: the Drizzle query surface (rc.3)

The scaffold pins **`drizzle-orm@^1.0.0-rc.3`** (`db/columns.server.ts` header
records this, research #562). rc.3 is the 1.0 release candidate with the new
Relational Query Builder v2 (RQBv2) wired up in `db/connection.server.ts` via
`drizzle({ client, relations })`. Several method overloads that older Drizzle
tutorials rely on do NOT exist in rc.3, so training-data patterns from
Drizzle 0.29 through 0.36 trip real TypeScript errors here. This page codifies
the shapes that compile against the installed version.

Ground rules for this version.

1. **Reads go through the relational query API** (`db.query.<table>.findFirst`
   / `.findMany`), not `db.select().from()`. Relations are pre-registered in
   `db/connection.server.ts`, so `with` joins work with zero boilerplate.
2. **`db.select()` takes no argument in rc.3.** The projection overload
   (`db.select({ ... })`) was removed. Passing a projection object is a
   `TS2554` compile error.
3. **`.returning()` takes no argument in rc.3.** It always returns the full
   inserted / updated / deleted rows (columns only, no relations). Passing a
   field object is a `TS2554` compile error.

All examples assume the scaffold imports.

```ts
import { eq, and, inArray, desc } from 'drizzle-orm';
import { db } from '#db/connection.server.ts';
import { posts, users } from '#db/schema.server.ts';
```

These belong in a `*.server.ts` query or action (never a page or component,
invariant 1). Reads live in `modules/<feature>/queries/*.server.ts`, mutations
in `modules/<feature>/actions/*.server.ts`, one function per file.

---

## Reads: use the relational query API

`db.query.<table>` reads a whole row by default, filters with a **plain object**
`where` (the RQBv2 shape, not a `sql` expression), orders with an `orderBy`
object, and pulls relations with `with`. This is the shape every scaffold query
uses.

```ts
// RIGHT: single row by a unique column
const post = await db.query.posts.findFirst({
  where: { slug: input.slug },
  with: { author: { columns: { name: true, email: true } } },
});

// RIGHT: a list, newest first, with a projected column set
const rows = await db.query.posts.findMany({
  orderBy: { createdAt: 'desc' },
  where: { authorId: me.id },
  columns: { id: true, slug: true, title: true },
  with: { author: { columns: { name: true } } },
});

// RIGHT: existence check, pull only the id
const exists = await db.query.posts.findFirst({
  where: { slug },
  columns: { id: true },
});
```

The `where` object supports equality directly (`{ slug }`), nested operators
(`{ createdAt: { gt: cutoff } }`), and `AND` by listing multiple keys. Reach for
the imported `eq` / `and` / `inArray` operators only on the `db.select` /
`db.delete` / `db.update` builders below, where the `.where()` clause is an SQL
expression rather than the RQBv2 object.

### Pitfall: the `db.select({ ... })` projection overload is gone

Older Drizzle let you project columns by passing an object to `select`. rc.3
removed that overload, so the argument no longer type-checks.

```ts
// WRONG (rc.3): TS2554 "Expected 0 arguments, but got 1"
const rows = await db
  .select({ id: posts.id, title: posts.title })
  .from(posts);
```

If you genuinely need the query-builder (a manual join, a `groupBy`, an
aggregate the RQB does not express), call `select` with **no arguments** to get
the full row, then narrow in JS.

```ts
// RIGHT: full-row select, no projection argument
const rows = await db.select().from(posts).where(eq(posts.authorId, me.id));
```

For anything the relational API covers (by-id lookups, ordered lists, relation
joins, column subsets), prefer `db.query.*`. It is the shorter, typed,
relation-aware path and it sidesteps the removed overload entirely.

---

## Mutations: `insert` / `update` / `delete` with a no-arg `.returning()`

Mutations use the query-builder, filter with the imported SQL operators, and
read back rows with `.returning()`. In rc.3 `.returning()` has **only the
no-argument overload**, so it yields the full row set every time.

```ts
// RIGHT: insert, read back the created row
const [row] = await db
  .insert(posts)
  .values({ title, body, slug, authorId: me.id })
  .returning();

// RIGHT: update by id, read back the updated row
const [row] = await db
  .update(posts)
  .set({ title, body })
  .where(eq(posts.id, id))
  .returning();

// RIGHT: delete by id (no read-back needed)
await db.delete(posts).where(eq(posts.id, id));
```

### Pitfall: `.returning({ ... })` with a field argument

The older field-selecting `.returning({ id: posts.id })` overload does not exist
in rc.3.

```ts
// WRONG (rc.3): TS2554 "Expected 0 arguments, but got 1"
const [row] = await db
  .insert(posts)
  .values({ title, body, slug, authorId: me.id })
  .returning({ id: posts.id, slug: posts.slug });
```

Call `.returning()` bare and destructure or map the fields you need in JS.

```ts
// RIGHT: full row back, then pick fields
const [row] = await db.insert(posts).values({ ... }).returning();
const created = { id: row.id, slug: row.slug };
```

### `.returning()` yields columns only, never relations

A `.returning()` row is the table's own columns. It does NOT carry `with`
relations the way a `db.query.*` read does. When the caller expects a joined
shape (an author name alongside the post), insert then re-read, or splice the
already-known related value in by hand.

```ts
// RIGHT: insert returns columns; add the known author locally
const [row] = await db.insert(posts).values({ title, body, slug, authorId: me.id }).returning();
return { success: true, data: { ...formatPost(row), authorName: me.name } };
```

---

## Column helpers live in `db/columns.server.ts` (the one dialect seam)

The schema is written against helpers (`table`, `pk`, `uuidPk`, `uuid`, `bool`,
`json`, `timestamp`, `createdAt`, `updatedAt`, `index`) rather than raw drizzle
builders, so the same `db/schema.server.ts` runs on SQLite and Postgres. Only
`db/columns.server.ts` differs per dialect. Two of those helpers exist because
rc.3 has not yet exposed a stable no-arg overload.

- **`table`** wraps `sqliteTableCreator((name) => name, 'snake_case')`. In rc.3
  the snake_case casing lives on the table factory, so column keys map to
  snake_case SQL names automatically. Do not restate a `snake_case` casing
  option on `drizzle()`.
- **`index(...cols)`** wraps rc.3's `index(name)`, which still requires a name
  argument the runtime auto-fills. The helper synthesizes drizzle-kit's own
  collision-free name, so schema authors call `index(t.createdAt)` with no name.
  Replace it with a bare `index()` once 1.0 stable ships the no-arg overload.
- **`json<T>()`** persists a structured value (an array or object) as JSON,
  typed by `T` so reads and writes are narrowed instead of `unknown`. It is
  `text({ mode: 'json' }).$type<T>()` on SQLite and `jsonb().$type<T>()` on
  Postgres, so `board: json<Cell[]>()` or `settings: json<{ theme?: string }>()`
  works unchanged on both dialects. Reach for it whenever a column holds
  structured data rather than a scalar (a board, a tag list, a settings blob).

When you add a table, use the helpers (`pk()` for an integer autoincrement id,
`uuidPk()` for an app-generated uuid string id, `createdAt()` for a
default-to-now timestamp) rather than reaching for raw `integer(...).primaryKey(...)`
call sites, so the Postgres swap stays a one-file change.

---

## Where each query shape belongs

| Task | API | File |
|---|---|---|
| Row by unique column | `db.query.t.findFirst({ where })` | `queries/*.server.ts` |
| Ordered / filtered list | `db.query.t.findMany({ orderBy, where, with })` | `queries/*.server.ts` |
| Manual join / aggregate | `db.select().from(t)` (no projection arg) | `queries/*.server.ts` |
| Create | `db.insert(t).values(...).returning()` | `actions/*.server.ts` |
| Update | `db.update(t).set(...).where(eq(...)).returning()` | `actions/*.server.ts` |
| Delete | `db.delete(t).where(eq(...))` | `actions/*.server.ts` |

Cross-references. Derived row TYPES and the `ActionResult<T>` envelope belong in
a browser-safe `modules/<feature>/types.ts` (see `agent-docs/types-and-mutations.md`).
Full page / action / query recipes live in `agent-docs/recipes.md`. The
server-only boundary that keeps `db` off the client is in the root `AGENTS.md`
(invariant 1).
