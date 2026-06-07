# webjsdev

The [webjs](https://webjs.dev) CLI under an unscoped npm name. Lets you `npm i -g webjsdev` (no scope prefix) and get the canonical `webjs` command on PATH.

```sh
npm i -g webjsdev
webjs create my-app
cd my-app && npm run dev
```

`webjsdev` is a thin one-line re-export of [`@webjsdev/cli`](https://www.npmjs.com/package/@webjsdev/cli)'s entry script. Either package installs the same `webjs` binary; the choice is purely about whether you'd rather type the scope or not.

The full set of subcommands (`dev`, `start`, `create`, `test`, `check`, `db`, `ui`) lives in `@webjsdev/cli`. See its README for the surface.

## License

MIT
