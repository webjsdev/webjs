# @webjsdev/server

Dev + production server for [webjs](https://github.com/webjsdev/webjs):
file-based routing, streaming SSR, server actions, WebSocket upgrades, and
live reload.

Rarely installed directly. Use [`@webjsdev/cli`](https://www.npmjs.com/package/@webjsdev/cli)
to scaffold and run an app, which pulls this package in as a dependency.

## Features

- **File-based routing** at parity with NextJs App Router: `page.ts`,
  `layout.ts`, `route.ts`, `error.ts`, `loading.ts`, `not-found.ts`,
  `middleware.ts`, `[param]`, `[...slug]`, `(groups)`, `_private`.
- **Streaming SSR** with Suspense boundaries.
- **Server actions**: import a `.server.ts` function from a client component
  and it auto-rewrites into a type-safe RPC stub. webjs's built-in serializer on the wire keeps Date/Map/Set/BigInt/TypedArray/Blob/File/FormData/cycles all surviving.
- **WebSockets**: export `WS` from `route.ts` and it becomes a WebSocket
  endpoint on the same path.
- **Live reload** for dev.
- **Bare-specifier auto-resolution** for npm packages via import maps,
  proxied from jspm.io (fallback esm.sh) and cached to
  `vendor/javascript/` (Rails 7 + importmap-rails pattern). No local
  bundler invocation.

## Install

```sh
npm install @webjsdev/server @webjsdev/core
```

## Use

Normally invoked via the CLI:

```sh
webjs dev
webjs start
```

Or programmatically:

```js
import { startServer } from '@webjsdev/server';

await startServer({ port: 3000, appDir: process.cwd(), dev: true });
```

See the full framework docs at https://github.com/webjsdev/webjs.

## License

MIT
