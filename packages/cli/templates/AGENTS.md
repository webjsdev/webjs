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

This scaffold is a starting point. It ships a gallery index home
(`app/page.ts`), a root layout with a neutral design-token palette
(`app/layout.ts`), a database wired up (`db/`), and a densely-commented feature
gallery: single-concept demos under `app/features/` plus the `app/examples/todo`
app, with logic in `modules/`. The gallery is reference to learn the idioms
from, not part of your product.

**Building a real app? Run `npm run gallery:clear` first.** It sheds the whole
demo gallery in one step (removes `app/features/`, `app/examples/`, the demo
`modules/`, and the demo `todos` table, and resets `app/page.ts` to a minimal
home), while KEEPING the agent skill, the layout, and the database wiring. Then
regenerate the database (`npm run db:generate` then `npm run db:migrate`) and
grow the app in place: add routes under `app/`, components under `components/`,
features under `modules/<feature>/`, keep server-only code behind `.server.ts`,
and give the app its own design by setting the token values in `app/layout.ts`.

If you are exploring rather than building, keep the gallery and browse it. To
learn one idiom before clearing, read its demo (or the skill's `references/`).

## Commands

```sh
npm install
npm run gallery:clear  # shed the demo gallery before building a real app
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
