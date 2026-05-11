# CLAUDE.md

This file is a thin pointer. **All authoritative content lives in
[`AGENTS.md`](./AGENTS.md)** — workflow, conventions, public API, file
layout, recipes, invariants, autonomous-mode behaviour, scaffold rules,
testing requirements, git rules. Read AGENTS.md before doing anything.

The full hosted documentation is at **https://docs.webjs.com**. Reach
for it when AGENTS.md doesn't cover something.

---

The rest of this file is for context that is **specific to the webjs
framework repo** (i.e. the monorepo you're inside right now) and that
intentionally does NOT belong in AGENTS.md — because AGENTS.md is shipped
into scaffolded apps and these details are about developing the
framework itself.

## Framework-dev language rules (do NOT apply to scaffolded apps)

- **`packages/`** — framework source. Plain `.js` with JSDoc types only.
  Never add `.ts` files here.
- **`examples/`, `docs/`, `website/`** — apps consuming the framework.
  TypeScript is fine and encouraged.

(Scaffolded apps default to TypeScript — see `AGENTS.md`. This split
exists because the framework itself stays buildless / no-tsc.)

## Framework-repo commands

```sh
npm install                          # workspace-linked deps
npm test                             # run unit tests
npm run test:browser                 # E2E tests (needs Chromium)
npm run dev                          # website + docs + blog together (5000/4000/3456)
cd website && npm run dev            # just the website (port 5000)
cd docs && npm run dev               # just the docs (port 4000)
cd examples/blog && npm run dev      # just the blog (port 3456)
```

## When a framework change lands, update

- `AGENTS.md` if the public API / directive / lifecycle / convention surface changed
- `docs/` for the user-facing doc page
- `website/` if the change is marketable on the landing page
- `examples/blog/` so E2E tests exercise the new path
- `packages/cli/templates/` if scaffolded apps should know about it

## Reference codebases (local, on this machine)

Cloned at `~/Documents/Projects/` for architectural comparison:

- **`lit`** — [Lit](https://lit.dev): rendering, hydration, lifecycle, directives.
- **`remix`** — [Remix](https://remix.run) v3: module loading, streaming SSR, hydration data.
- **`turbo`** — [Turbo](https://turbo.hotwired.dev): link interception, body swap, View Transitions.
- **`next.js`** — [Next.js](https://nextjs.org): App Router file conventions, layouts, metadata.
