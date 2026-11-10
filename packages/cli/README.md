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

Both `webjs create` and `create-webjs-app` auto-install dependencies in the new directory using your detected package manager (npm / pnpm / yarn / bun: the invoking tool, else the enclosing project's lockfile). Pass `--no-install` to opt out.

## Commands

```sh
webjs create <name>            # scaffold a full-stack app (the default)
                               # <name> must be a valid package name: letters, digits,
                               # and - . _ , starting with a letter or a digit
webjs create <name> --template api   # backend-only API app (routes + modules + Drizzle)

webjs dev                      # dev server with hot reload: in-place page refresh + component hot swap (runs webjs.dev.before, e.g. webjs db migrate, then serves; npm run dev is a thin alias)
webjs start                    # production server (no build step, serves source directly)
webjs check                    # validate source-code conventions (CI gate)
webjs doctor                   # verify the project/toolchain setup (per-check severity via webjs.doctor.gate, so CI can gate a subset)
webjs test                     # run server + browser tests
webjs status [path...]         # after an edit, wait for the dev server to settle and print every error since the last rebuild
                               # (file, line, code frame); exit 1 on a problem, 2 if no dev server; --json for agents
webjs ci                       # local CI: run the webjs.ci step list in package.json (check, doctor,
                               # typecheck, audit, every test layer), one result line per step;
                               # --only <title>, --fail-fast, --json, --signoff (gh signoff after a green run)
webjs create <name> --skip-ci  # omit the GitHub workflow (the local ci list always ships)
webjs generate scaffold post title:string! body:text   # Rails-style generators (alias: webjs g): table + migration,
                               # actions, pages and a test; also resource, model, migration, controller
webjs generate authentication     # sign-up, log-in, a protected page and a test, the Auth.js way
webjs destroy scaffold post       # remove what a generator wrote (alias: webjs d)
webjs vendor pin [--download]  # pin client deps to a committable importmap (offline/reproducible)
webjs db <generate|migrate|push|studio|seed>   # drizzle-kit passthrough (+ seed) by default; a package.json webjs.db block maps any verb to your own ORM's command

webjs ui init                  # initialise @webjsdev/ui in this project
webjs ui add <names...>        # copy components from the registry (https://webjs.dev/ui/registry/<name>.json)
webjs ui list                  # list every component available in the registry
```

`webjs ui` proxies to [`@webjsdev/ui`](https://www.npmjs.com/package/@webjsdev/ui),
an AI-first component library + CLI that copies sources into your project: class
helpers (`buttonClass`, `cardClass`, …) for the visual primitives and a small set
of stateful custom elements (`<ui-dialog>`, `<ui-tabs>`, `<ui-popover>`) where
state matters. The package is a hard dependency of `@webjsdev/cli`, so installing
the CLI gives you `webjs ui` automatically. See
[https://webjs.dev/ui](https://webjs.dev/ui) for the catalogue.

## Scaffolded templates

The scaffold seeds opinionated defaults so AI agents produce consistent code:

- `AGENTS.md`, opening with the WebJs brief (single cross-agent source of truth)
- `CLAUDE.md` (a bridge to `AGENTS.md`) and the `.claude/` protective hooks
- A `webjs.ci` step list in `package.json` (`npm run ci`, local CI) and a one-job GitHub workflow that runs the same list
- `test/<feature>/` (with optional `browser/` / `e2e/` subfolders per kind) with example tests
- Tailwind CSS via CLI (no browser runtime at build time)
- TypeScript, `.editorconfig`, `.gitignore`

See the full framework docs at https://github.com/webjsdev/webjs.

## License

MIT
