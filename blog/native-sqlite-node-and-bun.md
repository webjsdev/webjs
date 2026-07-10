---
title: "Dropping better-sqlite3 for Native SQLite on Node and Bun"
date: 2026-06-03T11:00:00+05:30
slug: native-sqlite-node-and-bun
description: "WebJs dropped the better-sqlite3 native addon for the runtime's built-in SQLite: node:sqlite on Node 24+ and bun:sqlite on Bun. No node-gyp, no compile step, no prebuilt-binary roulette, and a pure Bun Docker image with no Node toolchain."
tags: sqlite, drizzle, nodejs, bun, database
author: Vivek
---

I bumped a project from one Node major to the next, ran the app, and it would not boot. Not my code. The SQLite driver refused to load, because the binary it compiled against the old Node was the wrong shape for the new one. So I reinstalled, watched it churn through a C++ compile for a minute, and got back to where I had been twenty minutes earlier. The driver had not run a single query in all of that. If you have used SQLite in Node you have met better-sqlite3, and you have probably lost that same afternoon to it.

WebJs shipped better-sqlite3 too, for a while. I pulled it out and switched to the SQLite the runtime already carries. On Node that is `node:sqlite`, on Bun it is `bun:sqlite`. Nothing to compile at install, nothing to rebuild when Node moves a version.

# Why a native addon is fragile in the first place

better-sqlite3 is not JavaScript. It is a wrapper around SQLite's C library, and that C code has to become a machine binary your exact Node build can load. There are two ways to get there and both have sharp edges.

One is compiling on your machine at install time, through a toolchain called node-gyp. That needs a working C++ compiler, Python, and the right platform headers on every machine that runs `npm install`. Your laptop, a teammate's laptop, a CI runner, a Docker image. Miss one, or have the wrong version of one, and the install dies in a wall of compiler output that has nothing to do with the app you are building.

The other is downloading a binary someone prebuilt for your platform. Faster, right up until there is no binary for your exact mix of operating system, CPU architecture, and Node version, at which point you fall back to the node-gyp compile without really being told. And a native binary is pinned to a Node ABI (application binary interface), so a new Node major is a new compile. That is the coupling that got me: my database driver was tied to my runtime version, and moving one broke the other.

# The runtime already ships SQLite

The fix is almost boring. Node 24 and up has `node:sqlite`, a stable built-in. Bun has `bun:sqlite`, compiled straight into the binary. Both are C SQLite that already lives inside the runtime you are running, so importing them costs nothing at install. No node-gyp, no Python, no prebuilt-binary gaps, no recompile on an upgrade. WebJs picks the right one for whatever runtime you booted and hands it to the ORM.

That ORM is Drizzle, the scaffold default, so you never touch `node:sqlite` or `bun:sqlite` by hand. You write a plain TypeScript schema and Drizzle sits on the runtime's driver.

```ts
// db/schema.server.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

You read it from a query module, pulling in the shared `db` client:

```ts
// modules/posts/queries/list-posts.server.ts
'use server';
import { db } from '#db/connection.server.ts';

export async function listPosts() {
  return db.query.posts.findMany({ orderBy: { createdAt: 'desc' } });
}
```

Migrations are the normal Drizzle Kit loop through the CLI:

```sh
webjs db generate   # create a migration from the current schema
webjs db migrate    # apply pending migrations
```

Nothing in there compiles a binary. The migration is a SQL file, and the driver under it is already part of the runtime.

Because Drizzle is the layer you actually write against, the SQLite-or-Postgres choice is a single flag at scaffold time, and the schema, queries, and actions read the same across both dialects.

```sh
webjs create my-app --db postgres
```

SQLite is the default because a fresh app then runs with zero setup, no server to stand up, just a file on disk. Outgrow that and you move to Postgres without rewriting the data layer.

# Where deleting it pays the most: Docker

The install-time compile is a nuisance on a laptop. In a container image it is genuinely expensive, because you end up shipping a whole C++ toolchain just so a database driver can build itself. Dropping the native addon is what let the Bun scaffold use a pure `oven/bun:1` Dockerfile with no Node in it at all.

Two things have to be true for that to hold. SQLite is built into Bun, so there is nothing to compile, and `webjs db migrate` became npx-free, so the migration step needs no Node either. Remove the addon and remove the npx dependency and the image no longer needs a Node runtime or a compiler sitting inside it. Smaller image, faster build, less that can go wrong at deploy time.

I keep coming back to how little I had to give up for all of this. SQLite in Node used to mean a native addon compiling C++ at install, with node-gyp failures, prebuilt-binary gaps, and a forced recompile on every Node major. Now it means an `import` of something the runtime already contains. The specific driver barely matters. The pattern is the thing worth carrying to the next dependency: when the platform grows the capability you were reaching for a fragile package to get, delete the package and use the platform.
