# wjs

Short alias for the [webjs](https://webjs.dev) CLI. `wjs <cmd>` does exactly what `webjs <cmd>` does, just three keystrokes shorter.

```sh
npx wjs create my-app
cd my-app && npm run dev
```

Or install globally to keep both `wjs` and `webjs` on PATH:

```sh
npm i -g wjs
# Both commands work, same script, same behavior:
webjs dev       # canonical, matches docs / scaffold scripts / agent configs
wjs dev         # short alias
webjs check
wjs ui add button card dialog
```

`npm i -g wjs` installs **two** symlinks: `wjs` (the short alias) and `webjs` (the canonical name the framework's docs and scaffold templates use). Both point at the same shim, which delegates to `@webjsdev/cli`'s entry script. So you can lean on the long-form `webjs <cmd>` to match the documentation, or `wjs <cmd>` to save three keystrokes, with no behavior difference.

The full set of subcommands (`dev`, `start`, `create`, `test`, `check`, `db`, `ui`) is documented in [`@webjsdev/cli`](https://www.npmjs.com/package/@webjsdev/cli), which `wjs` depends on. The behaviour is identical, since `wjs` is a tiny re-export of the same entry script.

## Why a separate package?

- **`npx wjs create my-app` works without a global install.** That's the npx convention: the binary name has to match a published npm package name. Scoped names (`@webjsdev/cli`) work too, but the unscoped form mirrors the [Next.js `create-next-app` / `npx next ...`](https://nextjs.org) convention users expect.
- **`@webjsdev/cli` stays the canonical install** for users who want long-form `webjs` commands or for AI-agent docs to reference. This package is a hyphenated namespace alias, not a fork.

## License

MIT
