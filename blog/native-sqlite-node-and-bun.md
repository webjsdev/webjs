---
title: "Dropping better-sqlite3 for Native SQLite on Node and Bun"
date: 2026-06-03T11:00:00+05:30
slug: native-sqlite-node-and-bun
description: "WebJs dropped the better-sqlite3 native addon for the runtime's built-in SQLite: node:sqlite on Node 24+ and bun:sqlite on Bun. No node-gyp, no compile step, no prebuilt-binary roulette, and a pure Bun Docker image with no Node toolchain."
tags: sqlite, drizzle, nodejs, bun, database
author: Vivek
---

You clone a project, run the install, and it sits there compiling C++ for a while. Then you upgrade to a new Node major and the same package refuses to load, because the binary it built last month was compiled against a different version. You reinstall, it recompiles, and you have lost twenty minutes to a database driver that never ran a single query. If you have used SQLite in Node, you have met better-sqlite3, and you have probably met this exact afternoon.

WebJs used to ship better-sqlite3 too. In #670 I pulled it out entirely and switched to the SQLite the runtime already includes. On Node that is `node:sqlite`, on Bun it is `bun:sqlite`. No native addon, no compile, nothing to rebuild when Node bumps a version.


# What a native addon is, and why compiling at install is fragile

better-sqlite3 is a native addon, which means it is not JavaScript. It is a wrapper around SQLite's C library, and that C code has to be turned into a machine binary your specific Node build can load. Two ways that happens, and both have sharp edges.

The first is compiling on your machine at install time, using a toolchain called node-gyp. That needs a working C++ compiler, Python, and the right platform headers present on whatever machine runs `npm install`, your laptop, a teammate's laptop, a CI runner, a Docker image. When one of them is missing or the wrong version, the install fails with a wall of compiler output that has nothing to do with your app.

The second is downloading a prebuilt binary that someone compiled ahead of time for your platform. That is faster, until a binary for your exact combination of operating system, CPU architecture, and Node version does not exist, and you silently fall back to the node-gyp path anyway. Worse, a native binary is pinned to a Node ABI (application binary interface), so a fresh Node major means a fresh compile. The driver works, then you upgrade Node, and it stops loading until it rebuilds. That coupling between your database driver and your runtime version is the whole class of pain.


# Use the SQLite the runtime already has

The fix is almost boring. Modern runtimes ship SQLite in the box, so there is no addon to compile at all.

Node 24+ has `node:sqlite`, a stable built-in module. Bun has `bun:sqlite`, built into the binary. Both are C SQLite already compiled into the runtime you are running, so importing them costs nothing at install time. No node-gyp, no Python, no prebuilt-binary roulette, no recompile on a Node upgrade. WebJs picks the right one for whichever runtime you are on and hands it to the ORM.

That ORM is Drizzle, the scaffold default. You do not touch `node:sqlite` or `bun:sqlite` directly. You write a plain TypeScript schema and Drizzle sits on top of the runtime's driver.

```ts
// db/schema.server.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

You query it from a server action or a query module, importing the shared `db` client:

```ts
// modules/posts/queries/list-posts.server.ts
'use server';
import { db } from '#db/connection.server.ts';

export async function listPosts() {
  return db.query.posts.findMany({ orderBy: { createdAt: 'desc' } });
}
```

The migration loop is the usual Drizzle Kit flow through the WebJs CLI:

```sh
webjs db generate   # create a migration from the current schema
webjs db migrate    # apply pending migrations
```

Nothing in that loop compiles a binary. The migration is a SQL file, and the driver underneath it is already part of the runtime.


# It also works the other direction: Postgres, same code

Because Drizzle is the layer you write against, the SQLite-vs-Postgres choice is one flag at scaffold time, and the schema, queries, and actions are identical across both dialects (the dialect-parity work landed in #563).

```sh
webjs create my-app --db postgres
```

SQLite is the default because a new app then runs with zero setup, no server to install, just a file on disk. When you outgrow that, you move to Postgres without rewriting your data layer.


# The payoff shows up hardest in Docker

The install-time compile is annoying on your laptop and genuinely expensive in a container image, where you would otherwise ship a C++ toolchain just so a database driver could build. Dropping the native addon is what let the Bun scaffold use a pure `oven/bun:1` Dockerfile (#595, #596) with no Node in it at all.

That only works because two things are true at once. SQLite is built into Bun, so there is nothing to compile, and `webjs db migrate` became npx-free in #570, so the migration step needs no Node either. Remove the native addon and remove the npx dependency, and the image no longer needs a Node runtime or a compiler toolchain sitting in it. It is a smaller image that builds faster and has less to go wrong.


# The takeaway

SQLite in Node used to mean a native addon that compiled C++ at install time, with node-gyp failures, prebuilt-binary gaps, and a forced recompile on every Node major. WebJs dropped better-sqlite3 (#670) and uses the runtime's own SQLite instead, `node:sqlite` on Node 24+ and `bun:sqlite` on Bun, so there is no compile step and no binary pinned to your runtime version. Drizzle sits on top and keeps the same code across SQLite and Postgres. The lesson generalizes past this one driver. When the platform grows a capability you were pulling in a fragile dependency for, delete the dependency and use the platform.
