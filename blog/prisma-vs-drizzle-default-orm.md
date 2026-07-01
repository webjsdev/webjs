---
title: "Prisma vs Drizzle: Why We Chose Drizzle as Our Default ORM"
date: 2026-06-28T12:00:00+05:30
slug: prisma-vs-drizzle-default-orm
description: "Prisma vs Drizzle for a no-build framework. Why WebJs picked Drizzle ORM as the scaffold's default ORM, how the buildless, source-is-the-runtime model made the decision, and how to bring your own if you prefer Prisma."
tags: orm, drizzle, prisma, database, defaults
author: Vivek
---

Every full-stack framework has to pick a way to talk to your database. When you scaffold a new WebJs app, you get one already wired up, so you can write features instead of spending your first afternoon comparing libraries. That default is Drizzle.

Before anything else, the honest framing. Drizzle, Tailwind, and SQLite are scaffold **defaults**, not lock-in. WebJs is not coupled to any of them. If you prefer Prisma, or Kysely, or raw SQL, or Postgres over SQLite, you swap the `db/` folder and keep going. Nothing else in the framework knows or cares. This post is the story of why we picked Drizzle as the thing you get for free, not a claim that you are stuck with it.

First, the term. An ORM (object-relational mapper) is a library that lets you talk to your database in code, with functions and objects, instead of hand-writing raw SQL strings. Prisma and Drizzle are both ORMs. Both are good. The question was never "which one is better in the abstract." It was "which one fits a framework that has no build step."

That constraint is the whole story.


# The one constraint that decided it

WebJs has no build step. The `.ts` files you write are the files the runtime serves. There is no `webjs build` command, because there is nothing to compile ahead of time. What you read in `node_modules` is what runs. That single design choice ("source is the runtime") is the lens every dependency gets held up to.

Prisma, for all its strengths, works differently. You write a schema in Prisma's own schema language, then you run `prisma generate`. That command reads your schema and writes out a generated client, a chunk of TypeScript (and native query-engine bindings) that your code then imports. The client is a build artifact. It has to be regenerated every time the schema changes, and it has to exist before your app can run.

A generated client that must be produced by a codegen step, before the app runs, is exactly the kind of thing WebJs is designed not to have. It is a build step wearing a different hat. Adding it back to the one framework whose entire pitch is "no build step" would have been strange.

Drizzle does not have that step. A Drizzle schema is plain TypeScript. Your tables are TypeScript objects, your queries are TypeScript function calls, and the types flow directly from the schema you wrote. There is no generated client sitting between your code and the database. It is just source, which is exactly what the rest of a WebJs app is.

So the decision was not "Drizzle is better than Prisma." It was "Drizzle is shaped like the rest of WebJs, and Prisma is shaped like a build step." For a buildless framework, that fit is the deciding factor.


# What Prisma genuinely does well

I want to be fair here, because Prisma is a genuinely good tool and plenty of teams should reach for it.

Its schema language is lovely to read. A `schema.prisma` file is compact and skimmable, and beginners often find it clearer than a wall of TypeScript table definitions. Prisma Studio, the built-in visual database browser, is excellent. The generated client gives you rich, precise autocomplete because the types were produced from your exact schema. Its migration tooling is mature and well documented. For a team that already has a build pipeline, the codegen step is a non-issue, because everything else in their stack builds too.

None of that is in dispute. The point is fit, not quality. In a framework where every other file is served straight from source, the one dependency that needs a generate step stands out. In a Next.js app that already runs a bundler, it blends right in.


# What the Drizzle default looks like

When you scaffold, the database lives in one folder:

```
db/
  schema.server.ts       table definitions (plain TypeScript)
  columns.server.ts       column-type helpers per dialect
  connection.server.ts    the db client you import everywhere
```

You define a table in `db/schema.server.ts`, no separate schema language, no generate step:

```ts
// db/schema.server.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

Then you query it from a server action or a query module, importing the same `db` client the whole app shares:

```ts
// modules/posts/queries/list-posts.server.ts
'use server';
import { db } from '../../../db/connection.server.ts';

export async function listPosts() {
  return db.query.posts.findMany({ orderBy: { createdAt: 'desc' } });
}
```

That is the entire loop. Edit the schema, and the types update because the schema is the types. No artifact to keep in sync.


# The CLI wraps Drizzle Kit, not a codegen step

WebJs ships a thin database CLI that fronts Drizzle's own tooling (Drizzle Kit):

```sh
webjs db generate   # create a migration from the current schema
webjs db migrate    # apply pending migrations
webjs db push       # push the schema straight to the db (dev)
webjs db studio     # open Drizzle's visual database browser
webjs db seed       # run db/seed.server.ts
```

Note what `webjs db generate` does and does not do. It generates a **migration** (a SQL file describing the schema change), not a client you import. Nothing your app code depends on comes out of a codegen step. Your app imports `db` from `connection.server.ts`, and that file is source you can read. And yes, Drizzle has its own studio, so you do not give up the visual database browser by choosing it.


# Bring your own dialect (and your own ORM)

The default database is SQLite, which means a new app runs with zero setup, no server to install, just a file. When you are ready for Postgres, one flag at scaffold time picks the dialect:

```sh
webjs create my-app --db postgres
```

Here is the part that makes this a default rather than a lock-in. The schema, the queries, and the server actions are **identical across dialects** (the dialect-parity work landed in #563). You do not rewrite your data layer to move from SQLite to Postgres. The `db/columns.server.ts` helper absorbs the per-dialect differences, and the code you wrote against `db.query...` stays the same.

And if you would rather use Prisma, or Kysely, or write raw SQL, that door is open too. The framework's only real contract with the database is "server-only code lives in `.server.ts` files." Whatever you export a `db` client from, and however you built it, WebJs will happily run. Swap the `db/` folder for a Prisma setup, keep `prisma generate` in your own dev script, and the rest of the framework does not change. You lose the buildless purity for that one dependency, which is a trade you are allowed to make.


# The takeaway

Drizzle is the default because it is the same shape as everything else in WebJs: plain TypeScript, served from source, with no codegen artifact sitting between you and the runtime. Prisma is an excellent ORM with a lovely schema language and a great studio, and the only strike against it here is that its `prisma generate` step is a build step, which is the one thing a no-build framework is built to avoid. So this was a fit decision, not a quality verdict. Most important: Drizzle, SQLite, and Tailwind are the batteries the scaffold includes so you can ship on day one, not walls you are trapped behind. Prefer a different ORM, database, or styling approach? Swap it in and keep building. The default just means you do not have to decide before you have written a single feature.
