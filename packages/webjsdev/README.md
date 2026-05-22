# webjsdev

The [webjs](https://webjs.dev) CLI, published unscoped on npm. Installs three commands from one package: the canonical `webjs`, the short `wjs`, and the package-name `webjsdev` itself, all pointing at the same script.

```sh
# one-shot via npx
npx webjsdev create my-app
cd my-app && npm run dev

# or globally install once, get all three commands on PATH
npm i -g webjsdev
webjs dev          # canonical, matches docs / scaffold scripts
wjs dev            # short alias, identical behavior
webjsdev dev       # full package-name form, identical behavior
```

`webjsdev` exists because `@webjsdev/cli` is scoped, which means it can't power `npx <shortname>` without typing the scope. Publishing this thin unscoped shim gives users a `npx`-discoverable entry point for the CLI without changing the canonical scoped package they install long-term.

The full set of subcommands (`dev`, `start`, `create`, `test`, `check`, `db`, `ui`) lives in [`@webjsdev/cli`](https://www.npmjs.com/package/@webjsdev/cli), which `webjsdev` depends on. `webjsdev`'s entry script is a one-line re-export of `@webjsdev/cli/bin/webjs.js`, so all three command names run the same script with no behavior drift.

## License

MIT
