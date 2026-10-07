# AGENTS.md for {{APP_NAME}}

This is a WebJs app: server-rendered pages, web components for interactivity,
server actions, Drizzle, and no build step. WebJs is its own framework, not
React, Next.js or Lit, so write it from the patterns in this file rather than
from that memory. Read this whole file before you edit anything.

{{PLAYBOOK}}

## Rules that hold everywhere

- Type every boundary from its source: rows are `typeof posts.$inferSelect`
  (into browser code with `import type`), action inputs a named `interface`,
  routing files `PageProps<'/posts/[id]'>` / `LayoutProps`, object props
  `prop<Post>(Object)`. `unknown` only for an untrusted payload
  narrowed on the next line. Never reach for `any`.
- Never add `'use server'` to a file only server code imports (the DB
  connection, the schema).
- Store data with Drizzle in the wired-up database, never in a JSON file, an
  in-memory array or localStorage. Every schema change is `npm run db:generate`
  then `npm run db:migrate`, and the migrations are committed.
- TypeScript is erasable: no `enum`, `namespace`, parameter properties or
  decorators. Never put a backtick inside an `html` template, even in a comment.
- `npm run check` and `npm run typecheck` name the file and the fix; do what
  they say.

## Git

Commit per logical unit (CLAUDE.md has the rule). When you build a whole app
from a spec in one session, the build is one unit: work on a feature branch
(commits to `main` are refused), and commit once at the end after the checks
pass (`git add -A && git commit -m "<imperative subject>"`). Team workflow
(pull requests, CI, worktrees) is in `.agents/rules/workflow.md`.

## Before you build these, read the reference first

This file covers the common app. For any surface below, read the named
section of `.agents/skills/webjs/references/` BEFORE writing that part (one
`sed -n '/^## Heading/,/^## /p' <file>` call), because the API is WebJs's own
and guessing it from another framework is wrong.

| Building | Read |
| --- | --- |
| Live updates, chat, presence (WebSockets, `WS()` route export, `connectWS`, `broadcast()`) | `client-router-and-streaming.md` "WebSockets", `built-ins.md` "Broadcast" |
| Streaming an AI answer or progress (an action returning an async generator) | `client-router-and-streaming.md` "Streaming (Suspense and RPC)" |
| Refreshing one region, or one element after a write (`<webjs-frame>`, `<webjs-stream>`) | `client-router-and-streaming.md` |
| File uploads and serving them (`FileStore`, `signedUrl`) | `built-ins.md` "File storage" |
| Caching, `revalidate`, `cache()`, rate limits | `built-ins.md` "Caching", "Rate limiting" |
| Middleware (`middleware.ts`, per segment) and JSON API routes (`route.ts`, `route()` adapter, CORS) | `routing-and-pages.md`, `data-and-actions.md` |
| SEO: `metadata`, `generateMetadata`, sitemap, robots, social images; the app icon | `routing-and-pages.md` "Metadata", "App icon and manifest" |
| Browser-only code (`window`, `localStorage`, timers) and component lifecycle, slots, context, directives | `components.md` |
| Optimistic updates | `optimistic-ui.md` |
| OAuth sign-in, cookie sessions, `forbidden()` / `unauthorized()` | `auth-and-sessions.md` |
| Env vars and secrets, boot-time code (`instrumentation.ts` `register()`) | `built-ins.md` "Environment variables", "Observability" |
| Scheduled or background jobs | no built-in scheduler: start an interval in `instrumentation.ts` `register()` (read "Observability"), or expose a `route.ts` an external cron calls with a secret |
| Email, payments, i18n | no built-in: use the provider's SDK from a server-only `.server.ts` utility called by actions; secrets from `process.env` |
| Browser and e2e tests | `testing.md` |

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
