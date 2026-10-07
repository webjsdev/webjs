# AGENTS.md for {{APP_NAME}}

This is a WebJs app: server-rendered pages, web components for interactivity,
server actions, Drizzle, and no build step. WebJs is its own framework, not
React, Next.js or Lit, so write it from the patterns in this file rather than
from that memory. Read this whole file before you edit anything.

{{PLAYBOOK}}

## Rules that hold everywhere

- **Type every boundary from its source.** A row is
  `typeof posts.$inferSelect` (exported from `db/schema.server.ts`, carried
  into browser code with `import type`), an action's input is a named
  `interface`, a routing file uses `PageProps<'/posts/[id]'>` / `LayoutProps` /
  `RouteHandlerContext` from `@webjsdev/core`, and a component prop that holds
  an object is `prop<Post>(Object)`. Never reach for `any` or `as any`, and
  keep `unknown` for an untrusted payload you narrow on the next line.
- **Server-only code stays behind `.server.ts`.** A file WITH `'use server'`
  exposes its exported async functions as actions; a file WITHOUT it is a
  server-only utility that only other server code may import. Never add
  `'use server'` to a file only server code imports (the DB connection, the
  schema).
- **Store data with Drizzle** in the wired-up database (`db/`), never in a
  JSON file, an in-memory array or Map, or localStorage. Every schema change is
  `npm run db:generate` then `npm run db:migrate`, and the generated
  migrations are committed.
- **TypeScript is erasable:** no `enum`, no `namespace`, no constructor
  parameter properties, no decorators. Never put a backtick inside an
  `html` template body, even in a comment.
- **Errors tell you the fix.** `npm run check` and `npm run typecheck` name
  the file, the rule and the fix; do what they say rather than searching.

## Git

Commit per logical unit (CLAUDE.md has the rule). When you build a whole app
from a spec in one session, the build is one unit: work on a feature branch
(commits to `main` are refused), and commit once at the end after the checks
pass (`git add -A && git commit -m "<imperative subject>"`). Team workflow
(pull requests, CI, worktrees) is in `.agents/rules/workflow.md`.

## When you need more

The reference set is `.agents/skills/webjs/` (`SKILL.md` routes to
`references/*.md`). Open one only for a surface this file does not show:
streaming and Suspense (`client-router-and-streaming.md`), optimistic UI
(`optimistic-ui.md`), caching, rate limits, file uploads, env vars
(`built-ins.md`), OAuth providers and sessions (`auth-and-sessions.md`),
browser and e2e tests (`testing.md`), deeper component topics such as slots,
shadow DOM, context and directives (`components.md`). The exact framework
source is under `node_modules/@webjsdev/*`, and the hosted docs are at
https://webjs.dev/docs.
