---
title: "How to Fix Those Ugly ../../../ Import Paths"
date: 2026-06-11T09:30:00+05:30
slug: fix-relative-import-paths
description: "Fix relative import paths for good using a path alias backed by the Node package.json imports field. WebJs aliases every top-level folder with no webpack and no tsconfig paths, resolved at runtime by Node 24+ and Bun with no build step."
tags: imports, path-alias, no-build, dx, nodejs
author: Vivek
---

You have seen this line. You have probably written it today.

```ts
import { db } from '../../../db/connection.server.ts';
```

It works. Then you move the file one folder deeper to tidy things up, and it breaks. Not with a helpful message, just a red squiggle and a count of `../` that no longer adds up. You add one more `../`, guess wrong, add another, and now you are counting directory hops in your head like it is 1998. Every deep relative import is a little piece of your file structure hardcoded into your code, and it rots the moment you rearrange anything.

I got tired of it. So WebJs apps do not use deep relative paths. They use a path alias.


# What a path alias even is

A path alias is a short, stable nickname for a folder. Instead of describing where a file is relative to the file importing it (`../../../db`), you describe where it is relative to the root of your project (`#db`). The import reads the same no matter where the importing file lives, so moving a file never changes the paths inside it.

Here is the same import with the WebJs alias.

```ts
import { db } from '#db/connection.server.ts';
import { Button } from '#components/ui/button.ts';
import { formatDate } from '#lib/utils/date.ts';
import { listPosts } from '#modules/posts/queries/list-posts.server.ts';
```

Every one of those points at a top-level folder from the project root. No counting. Move `button.ts` anywhere and its imports of `#lib` and `#db` stay valid.


# Why this normally needs a bundler

If you have set up path aliases before, you know they usually come with baggage. In a typical React or Next.js project, an alias like `@/components` exists in two places that have to agree. You add `paths` to `tsconfig.json` so the TypeScript language server stops complaining, and you add a matching alias to your bundler config (webpack `resolve.alias`, or the Vite/esbuild equivalent) so the code actually runs.

That second half is the catch. The alias only works because a build tool rewrites it into a real path before the code ever runs. TypeScript `paths` alone is a type-checker hint. It does not change what the runtime sees. So the alias is really a build-time illusion, and you need the build step to make it true.

WebJs has no build step. The `.ts` files you write are the files that run (Node 24+ strips the types in place, no bundler in sight). So a bundler-rewrite trick was never on the table. Instead WebJs leans on a platform feature that already does exactly this.


# The platform already has this: package.json "imports"

Node has a built-in field for private module aliases called `imports`, and it lives right in your `package.json`. Any key that starts with `#` is a subpath import that Node resolves at runtime, no tooling required. This is a real Node feature, not a WebJs invention, and Bun implements it too.

The WebJs scaffold ships one line that does all the work.

```json
{
  "imports": {
    "#*": "./*"
  }
}
```

That single catch-all maps `#anything` to `./anything` from the project root. So `#db/connection.server.ts` resolves to `./db/connection.server.ts`, `#components/ui/button.ts` to `./components/ui/button.ts`, and so on. Add a new top-level folder tomorrow and it is aliased already, with zero config changes. Node 24+ and Bun both resolve it at runtime. No webpack, no tsconfig `paths`, no resolver plugin.


# Two rules that will save you a debugging session

The sigil is `#`, not `@`. A lot of ecosystems use `@/` out of habit, but the Node `imports` field only recognizes keys starting with `#`. Reach for `@` and nothing resolves.

There is no slash after the `#`. Write `#lib/...`, never `#/lib/...`. A `#/`-prefixed key does not resolve on Bun, and WebJs runs on both Node and Bun, so the slash-free form is the one that works everywhere.

Get those two right and the alias just works.


# When to use it, and when not to

The alias is for reaching across your project, not for reaching next door. A same-directory import stays relative.

```ts
import { helper } from './sibling.ts';   // same folder, keep it relative
import { db } from '#db/connection.server.ts';   // deep reach, use the alias
```

The rule I follow: same-directory imports stay `./`, and only the deep relatives (the `../../../` kind) become `#`. A short local `./` path does not rot when you move files, so there is nothing to fix there.

One more boundary worth knowing. The alias addresses a top-level subdirectory (`#lib`, `#components`, `#modules`, `#db`). A bare file sitting at the project root, like `env.ts`, is imported relatively as `./env.ts`. That is because the browser importmap WebJs generates is scoped per directory, so a `#`-imported root file would have no browser mapping in dev. Point the alias at folders, keep root files relative.

And if you ever want to opt out for a single import, just write a plain relative path. Nothing forces the alias on you.


# It is the same map everywhere, so the server boundary still holds

This is the part I like most. Because the alias is a real config value and not a build-time rewrite, WebJs can read the exact same map the runtime reads. The server expands `#*` when it walks your import graph, when it decides which files a browser is allowed to fetch (the auth gate), when it elides display-only components, and when it builds the browser importmap.

The practical payoff: a `#`-aliased `.server.ts` file still trips the server-only boundary. Importing `#db/connection.server.ts` into a client component is caught the same way importing `../../../db/connection.server.ts` would be. The alias is cosmetic to you and fully transparent to the framework. There is no seam where a nicer import path quietly loses a safety guarantee.


# The takeaway

Deep relative imports are fragile because they hardcode your folder layout into every file, and they break the instant you rearrange anything. The usual fix, a bundler alias plus tsconfig `paths`, only works because a build step rewrites it. WebJs has no build step, so it uses Node's native `package.json` `imports` field instead. One catch-all line, `"#*": "./*"`, aliases every top-level folder with no webpack and no tsconfig `paths`, resolved at runtime by Node 24+ and Bun. Use `#lib`, `#components`, `#modules`, `#db` for the deep reaches, keep `./sibling.ts` for the neighbors, remember the sigil is `#` with no slash, and never count `../` again.
