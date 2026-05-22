# create-webjs-app

Scaffold a new [webjs](https://webjs.dev) app with one command, no global install required.

```sh
npx create-webjs-app@latest my-app
cd my-app && npm run dev
# → http://localhost:3000
```

This is the mirror of `npx create-next-app` for the webjs framework. Under the hood it dispatches to [`@webjsdev/cli`](https://www.npmjs.com/package/@webjsdev/cli)'s `scaffoldApp()` and then auto-runs the detected package manager's install in the new directory.

## Templates

```sh
npx create-webjs-app@latest my-app                    # default: full-stack (pages + components + API + Prisma/SQLite)
npx create-webjs-app@latest my-api  --template api    # backend-only (route handlers + modules, no SSR/UI)
npx create-webjs-app@latest my-saas --template saas   # auth + login/signup + protected dashboard + Prisma User model
```

Only three templates exist; the CLI rejects anything else.

## Options

| Flag | Default | Meaning |
|---|---|---|
| `--template <full-stack \| api \| saas>` | `full-stack` | Pick the scaffold variant. |
| `--no-install` | install runs | Skip the post-scaffold `<pm> install`. |
| `-h`, `--help` | | Show help. |

The package manager is detected from `npm_config_user_agent`: pnpm / yarn / bun users get their own.

## Relationship to `@webjsdev/cli`

`create-webjs-app` is a thin npx-discoverable wrapper. The full CLI lives in [`@webjsdev/cli`](https://www.npmjs.com/package/@webjsdev/cli), which installs as a global to give you `webjs dev`, `webjs start`, `webjs create`, `webjs test`, `webjs check`, `webjs db`, and `webjs ui`. After scaffolding, `webjs <cmd>` is available locally via the new app's `node_modules/.bin`, and globally if you've run `npm i -g @webjsdev/cli`.

## License

MIT
