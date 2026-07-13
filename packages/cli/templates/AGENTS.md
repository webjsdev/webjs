# AGENTS.md for {{APP_NAME}}

This is a WebJs app: AI-first, web-components-first, no build step. Read this
before editing any file. It is deliberately short. The framework knowledge
lives in one place that every AI tool can read.

## Building features

Read `.agents/skills/webjs/SKILL.md` first. It is the guide to building a WebJs
app: it helps you choose the right layer, reach for the right export, and avoid
the WebJs-specific mistakes that Next.js or Lit habits cause. It routes to
focused references under `.agents/skills/webjs/references/` that you load only
when a task needs them. The full hosted docs are at https://docs.webjs.dev.

## Grow this app in place

This scaffold is a minimal starting point, not a demo to prune. It ships a home
page (`app/page.ts`), a root layout with a neutral design-token palette
(`app/layout.ts`), and a database wired up (`db/`). Build the app the user asked
for by growing it here: add routes under `app/`, components under `components/`,
features under `modules/<feature>/`, and keep server-only code behind
`.server.ts`. Give the app its own design by setting the token values in
`app/layout.ts`.

## Commands

```sh
npm install
npm run dev            # dev server at http://localhost:8080
npm run start          # production server
npm test               # unit + browser tests
npm run typecheck
npx webjsdev check     # correctness checks
npx webjsdev ui add <name>   # add a ui-* component on demand
```

## Data

Use the wired-up database (Drizzle). Define real models in
`db/schema.server.ts`, then `npm run db:generate` and `npm run db:migrate`.
Never store app data in JSON files, in-memory arrays, or localStorage.
