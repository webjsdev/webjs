# create-webjs

Scaffold a new [webjs](https://webjs.dev) app with one command, no global install required.

```sh
npm create webjs@latest my-app
cd my-app && npm run dev
# → http://localhost:8080
```

`npm create webjs@latest` is npm's documented shorthand for `npx create-webjs@latest`; both routes dispatch to this same package. Under the hood it calls [`@webjsdev/cli`](https://www.npmjs.com/package/@webjsdev/cli)'s `scaffoldApp()` and auto-runs the detected package manager's install in the new directory.

## Templates

```sh
npm create webjs@latest my-app                       # default: full-stack (pages + components + API + Drizzle/SQLite; auth ships as a gallery card)
npm create webjs@latest my-api  -- --template api    # backend-only (route handlers + modules + Drizzle, no SSR/UI)
```

(The `--` separator before flags is npm's pass-through convention. Plain `npx create-webjs@latest my-app --template api` works without the separator.)

Only three templates exist; the CLI rejects anything else.

## Options

| Flag | Default | Meaning |
|---|---|---|
| `--template <full-stack \| api \| saas>` | `full-stack` | Pick the scaffold variant. |
| `--no-install` | install runs | Skip the post-scaffold `<pm> install`. |
| `-h`, `--help` | | Show help. |

The package manager is detected from `npm_config_user_agent`: pnpm / yarn / bun users get their own.

## Relationship to `@webjsdev/cli`

`create-webjs` is a thin scaffolding wrapper. The full CLI lives in [`@webjsdev/cli`](https://www.npmjs.com/package/@webjsdev/cli) (and its unscoped mirror [`webjsdev`](https://www.npmjs.com/package/webjsdev)), which installs globally to give you `webjs dev`, `webjs start`, `webjs create`, `webjs test`, `webjs check`, `webjs doctor`, `webjs vendor`, `webjs db`, and `webjs ui`. After scaffolding, `webjs <cmd>` is available locally via the new app's `node_modules/.bin`, and globally if you've run `npm i -g @webjsdev/cli` or `npm i -g webjsdev`.

## License

MIT
