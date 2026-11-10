# AGENTS.md for the WebJs gallery

This app is the **WebJs feature gallery**, deployed at gallery.webjs.dev: one
runnable, densely commented demo per framework capability. It is a standalone
app. `webjs create` ships none of it (a scaffolded app is minimal, and its only
agent doc is the brief), so a change here changes the gallery and nothing else.

The repo-wide contract is the root `AGENTS.md`; the framework reference is
https://webjs.dev/docs. This file covers only what is special about
`gallery/`.

## Rules for a demo

- **One concept per card.** A demo under `app/features/<name>/` shows a single
  capability, with its logic in `modules/<name>/`. Whole apps composing several
  features go under `app/examples/<name>/`.
- **Comment densely.** These files are read as reference far more often than
  they are run. Explain why the idiom is the idiom, not what the line does.
- **Copyable.** Readers copy a demo into their own app, so keep each one
  self-contained: `@webjsdev/*`, drizzle, `#db/*`, `#lib/*`, `#modules/*`,
  `#components/*`, and other demos only.
- **Tested in place.** `test/examples/gallery/` reads and boots this app
  (the feature index, the auth card, the server-actions wire).
- **The coverage gate points here.** `test/scaffolds/gallery-coverage.test.js`
  reconciles the live `@webjsdev/core` / `@webjsdev/server` surface against
  `test/scaffolds/gallery-coverage.json`, whose `demo` pointers are paths inside
  this directory. A new export is red in CI until it is demoed or exempted.

## Running and testing it

```sh
npm run dev:gallery                          # from the repo root, port 5005
cd gallery && cp .env.example .env           # first run
cd gallery && npm run db:migrate             # the auth + todo cards need real tables
cd gallery && npm test                       # node + browser
cd gallery && npx webjs check                # from INSIDE the app, never the repo root
```

CI runs `typecheck` plus `npm test` for this workspace in the in-repo app job,
and `webjs check` plus `webjs doctor` in the conventions job.

**Migrate the database before trusting a green run.** `test/auth/auth.test.ts`
SKIPS rather than fails when the `users` table is missing, so an unmigrated
database reports the auth card as passing while asserting nothing.

Browser tests live in a `browser/` directory next to the code they exercise
(`modules/<feature>/components/browser/*.test.js`), run under the runner's mocha
`tdd` globals, and are excluded from `tsconfig.json` for that reason.
