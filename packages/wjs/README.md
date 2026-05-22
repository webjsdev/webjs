# wjs

Short alias for the [webjs](https://webjs.dev) CLI. `wjs <cmd>` does exactly what `webjs <cmd>` does, just three keystrokes shorter.

```sh
npx wjs create my-app
cd my-app && npm run dev
```

Or install globally to keep both `wjs` and `webjs` always on PATH:

```sh
npm i -g wjs
webjs dev                          # canonical, matches docs / scaffold scripts
wjs dev                            # short alias, identical behavior
wjs ui add button card dialog
```

The full set of subcommands (`dev`, `start`, `create`, `test`, `check`, `db`, `ui`) is documented in [`@webjsdev/cli`](https://www.npmjs.com/package/@webjsdev/cli), which `wjs` depends on. `wjs`'s entry script is a one-line re-export of `@webjsdev/cli/bin/webjs.js`, so the long-form `webjs <cmd>` and the short `wjs <cmd>` run the same script with no behavior drift.

## Why a separate package?

- **`npx wjs create my-app` works without a global install.** That's the npx convention: the binary name has to match a published npm package name. Scoped names (`@webjsdev/cli`) work too, but the unscoped form mirrors the [Next.js `create-next-app` / `npx next ...`](https://nextjs.org) convention users expect.
- **`@webjsdev/cli` stays the canonical install** for users who want long-form `webjs` commands or for AI-agent docs to reference. This package is a hyphenated namespace alias, not a fork.

## License

MIT
