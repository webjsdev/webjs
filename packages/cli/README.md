# @webjsdev/cli

CLI for [webjs](https://github.com/webjsdev/webjs): scaffold, develop,
build, and run webjs apps.

Installing this package gives you the `webjs` command.

## Install

Install once, globally:

```sh
npm i -g webjsdev
```

Then scaffold a new app anywhere:

```sh
webjs create my-app
cd my-app && npm run dev
# → http://localhost:8080
```

One-shot without a global install, two ways:

```sh
# Preferred: the npx-discoverable scaffolder
npx create-webjs-app@latest my-app
cd my-app && npm run dev

# Or via the CLI's npx entry directly
npx @webjsdev/cli create my-app
cd my-app && npm run dev
```

`webjs create` installs dependencies in the new directory by default on **Node** (it needs `node_modules` to run). On **Bun** it **skips** the install: `bun run dev` resolves latest-in-range deps on the fly via Bun auto-install. For a dep Bun's latest-only auto-install cannot resolve (a prerelease, an exact pin, or a committed `bun.lock`), webjs runs a one-time `bun install` for you on first boot, no manual step. Pass `--install` to force the install, or `--no-install` to skip it, on either runtime.

## Commands

```sh
webjs create <name>            # scaffold a full-stack app (default)
webjs create <name> --template api   # backend-only API app
webjs create <name> --template saas  # auth + dashboard + Drizzle User model

webjs dev                      # dev server with live reload (runs webjs.dev.before, e.g. webjs db migrate, then serves; npm run dev is a thin alias)
webjs start                    # production server (no build step, serves source directly)
webjs check                    # validate source-code conventions (CI gate)
webjs doctor                   # verify the project/toolchain setup (local onboarding, not CI)
webjs test                     # run server + browser tests
webjs vendor pin [--download]  # pin client deps to a committable importmap (offline/reproducible)
webjs db <generate|migrate|push|studio|seed>   # drizzle-kit passthrough (+ seed)

webjs ui init                  # initialise @webjsdev/ui in this project
webjs ui add <names...>        # copy components from the registry (https://ui.webjs.dev/registry/<name>.json)
webjs ui list                  # list every component available in the registry
```

`webjs ui` proxies to [`@webjsdev/ui`](https://www.npmjs.com/package/@webjsdev/ui),
an AI-first component library + CLI that copies sources into your project: class
helpers (`buttonClass`, `cardClass`, …) for the visual primitives and a small set
of stateful custom elements (`<ui-dialog>`, `<ui-tabs>`, `<ui-popover>`) where
state matters. The package is a hard dependency of `@webjsdev/cli`, so installing
the CLI gives you `webjs ui` automatically. See
[https://ui.webjs.dev](https://ui.webjs.dev) for the catalogue.

## Scaffolded templates

The scaffold seeds opinionated defaults so AI agents produce consistent code:

- `AGENTS.md` + `CONVENTIONS.md` (the machine-readable contract)
- `.claude/`, `.cursorrules`, `.agents/rules/workflow.md` (Antigravity), `.github/copilot-instructions.md`
- `test/<feature>/` (with optional `browser/` / `e2e/` subfolders per kind) with example tests
- Tailwind CSS via CLI (no browser runtime at build time)
- TypeScript, `.editorconfig`, `.gitignore`

See the full framework docs at https://github.com/webjsdev/webjs.

## License

MIT
