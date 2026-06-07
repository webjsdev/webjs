# TypeScript without a build step + full-stack type safety

Files ending in `.ts` / `.mts` are supported everywhere `.js` / `.mjs`
are. Same routing conventions, same server-action behaviour. No `tsc`
run is part of the user-visible workflow, no separate build step:

- **Editor** (VS Code) runs the TypeScript language server continuously. Red-squiggle on wrong types, including non-erasable syntax (see below).
- **CI** (optional) runs `tsc --noEmit` against `tsconfig.json`. Type-check only. Also catches non-erasable syntax via `erasableSyntaxOnly`.
- **Dev + prod server** (runtime, both directions): Node 24+'s built-in TypeScript type-stripping handles server-side `.ts` imports automatically (`process.features.typescript === 'strip'`). Browser-bound `.ts` requests go through `module.stripTypeScriptTypes` on the dev server, which performs whitespace replacement: every (line, column) in the source maps to the same position in the stripped output, so no sourcemap needs to be shipped and stack traces are byte-exact. The transform is cached by mtime (~microseconds per cache hit). Implementation backing: Node ships the [`amaro`](https://github.com/nodejs/amaro) package internally, which wraps SWC's WASM TypeScript transform in a position-preserving strip-only mode. If the framework ever needs to run on a non-Node runtime (Bun, Deno) we will install `amaro` directly or an equivalent position-preserving stripper (Sucrase preserves lines but not columns; SWC's strip mode also works).

## TypeScript feature support: erasable only

The framework uses Node 24+'s built-in `module.stripTypeScriptTypes`,
which only supports **erasable TypeScript**: type annotations,
`interface`, `type`, `declare`, generics, `import type`, `as` casts,
and `satisfies`. Non-erasable syntax is rejected.

Use the **erasable equivalents** instead:

```ts
// Not allowed (rejected at compile + runtime)
enum Color { Red, Green, Blue }
class Foo { constructor(public x: number) {} }
namespace Util { export const helper = ...; }
import = require('something');
@legacyDecorator class C {}

// Allowed (canonical erasable forms)
const Color = { Red: 'Red', Green: 'Green', Blue: 'Blue' } as const;
type Color = typeof Color[keyof typeof Color];

class Foo {
  x: number;
  constructor(x: number) { this.x = x; }
}

const Util = { helper: ... };

import { thing } from './thing.ts';
```

Enforce this at edit time by setting `erasableSyntaxOnly: true` in
`tsconfig.json`. The TypeScript compiler then flags any non-erasable
syntax as a red squiggle in the editor and `tsc --noEmit` error in CI.

The `erasable-typescript-only` convention check verifies the flag is
set. Run `webjs check` to confirm.

### Fallback for third-party `.ts` dependencies

If a third-party package ships `.ts` source using non-erasable
syntax (rare; most npm packages publish compiled `.js`), the dev
server fails at strip time and returns a 500 naming the file and
pointing at the `no-non-erasable-typescript` lint rule. webjs is
buildless end-to-end and has no bundler fallback. Your own code
never hits this as long as `erasableSyntaxOnly` is set.

If you manually turn `erasableSyntaxOnly` off and write non-erasable
syntax in your own code, the dev server fails the same way. The
`erasable-typescript-only` convention check warns when the flag is
off so you catch the configuration drift before runtime.

## Import convention

Use explicit `.ts` extensions in imports. Node 24+'s built-in
type-stripping and the dev server's HTTP handler both key on the
file URL ending in `.ts` / `.mts`. For mixed codebases, `.js` imports
that point at a `.ts` sibling also resolve in the dev server. Still
prefer explicit `.ts`.

```ts
// modules/posts/queries/list-posts.server.ts
import { prisma } from '../../../lib/prisma.js';         // JS file unchanged
import { formatPost } from '../utils/slugify.ts';         // TS file
```

## Minimum viable `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "checkJs": true,
    "allowJs": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "erasableSyntaxOnly": true
  }
}
```

The `erasableSyntaxOnly: true` line is the non-negotiable one. It
aligns the TypeScript compiler's accepted syntax with what Node's
strip-types accepts, so violations surface as editor diagnostics
instead of a runtime 500.

## Full-stack type safety

### Server actions: type-safe automatically

Calling a server action from a client component resolves at type-check
time to the action's real source file. The dev server's runtime stub
replacement is invisible to the type checker.

```ts
// modules/posts/actions/create-post.server.ts
export async function createPost(
  input: { title: string; body: string },
): Promise<ActionResult<PostFormatted>> { /* … */ }

// modules/posts/components/new-post.ts
import { createPost } from '../actions/create-post.server.ts';
const r = await createPost({ title, body });
//        ^ Promise<ActionResult<PostFormatted>>
if (r.success) r.data.title;   // ← PostFormatted.title: string
```

**Runtime matches types** because the RPC wire uses webjs's built-in
ESM serializer: `Date` → `Date`, `Map` → `Map`, `BigInt` → `BigInt`.
Supported: `Date`, `Map`, `Set`, `BigInt`, `Error`, `undefined`,
`NaN`/`Infinity`/`-0`, `TypedArray`, `ArrayBuffer`, `DataView`, `Blob`,
`File`, `FormData`, `Symbol.for(...)`, reference cycles. Class
instances come through as plain objects, with prototypes lost and methods
gone (matches React Server Actions).

### API routes: opt in via content negotiation

`route.ts` handlers use standard JSON by default so external consumers
keep working. Opt into rich types for your own UI code:

```ts
// app/api/posts/route.ts: server
import { json } from '@webjsdev/server';
import { listPosts } from '../../../modules/posts/queries/list-posts.server.ts';

export async function GET() {
  return json(await listPosts());   // content-negotiates automatically
}
```

```ts
// caller: client
import { richFetch } from '@webjsdev/core';
const posts = await richFetch<Post[]>('/api/posts');
// posts[0].createdAt is a Date here.
```

The `json()` helper reads the in-flight Request via AsyncLocalStorage:
- `Accept: application/vnd.webjs+json` → encoded with the webjs serializer, served with `Content-Type: application/vnd.webjs+json` and `Vary: Accept`.
- Otherwise → plain JSON.

Request bodies parse with `readBody(req)` from `@webjsdev/server`.

### Page metadata: the `Metadata` type

A page or layout exports `metadata` (static) or `generateMetadata(ctx)`
(request-scoped). Annotate the return with the exported `Metadata` type so
a misspelled field or a wrong-typed value is a compile-time error, the
same ergonomics as Next.js's `import type { Metadata } from 'next'`.

```ts
import type { Metadata, MetadataContext } from '@webjsdev/core';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Latest posts',
  openGraph: { type: 'website', image: '/og.png' },
  twitter: { card: 'summary_large_image' },
};

export async function generateMetadata(ctx: MetadataContext): Promise<Metadata> {
  return { title: `Post: ${ctx.params.slug}`, metadataBase: new URL(ctx.url).origin };
}
```

`Metadata` covers every field the SSR pipeline reads (see
`agent-docs/metadata.md`); each field is optional, and string-or-object
fields (`title`, `viewport`, `robots`, `appleWebApp`, `icons`) are unions.
It is a pure type in `packages/core/src/metadata.d.ts`, so it is erased at
runtime with zero build cost. `MetadataContext` types the
`generateMetadata` argument (`{ params, searchParams, url, actionData }`,
where `actionData` is set only on a failed-page-action re-render).

### Typed page / layout / route-handler props (`PageProps`, `LayoutProps`, `RouteHandlerContext`)

A page default-export receives `{ params, searchParams, url, actionData }`; a
layout receives the same plus `children`; a `route.{js,ts}` handler receives
`(request, { params })`. Type each with the exported helpers so a typo in a
param name or a wrong-typed field is a compile-time error.

```ts
import type { PageProps, LayoutProps, RouteHandlerContext } from '@webjsdev/core';

// A static route: `params` is `Record<string, string>`.
export default function About({ searchParams }: PageProps) { /* ... */ }

// A dynamic route: pass the route literal to narrow `params`.
export default function Post({ params }: PageProps<'/blog/[slug]'>) {
  const slug = params.slug; // typed `string`
  /* ... */
}

// A layout adds `children: TemplateResult`.
export default function RootLayout({ children }: LayoutProps) { /* ... */ }

// A route handler's 2nd arg.
export async function GET(req: Request, ctx: RouteHandlerContext) {
  return Response.json({ id: ctx.params.id });
}
```

`PageProps<R>` / `LayoutProps<R>` / `RouteHandlerContext<R>` take an optional
route literal `R`. With no `R` (or in an app that has not generated route
types), `params` is `Record<string, string>`, the runtime default. With `R`
set to a generated dynamic route, `params` narrows to its exact shape
(`{ slug: string }`, `{ rest: string[] }`, `{ slug?: string[] }`). The shapes
mirror what `packages/server/src/ssr.js` and `packages/server/src/api.js`
actually pass, NOT Next.js's superset. Pure types in
`packages/core/src/routes.d.ts`, erased at runtime with zero build cost.

### The generated route union (`webjs types`) types `navigate()` and catches bad hrefs

Run `webjs types` to generate `.webjs/routes.d.ts`, an opt-in overlay that
augments `@webjsdev/core` with one key per route in `app/`. It narrows two
things at tsserver time:

- The `Route` href type: `navigate('/blog/anything')` is accepted,
  `navigate('/nonexistent')` is a type error. (Until you generate the types,
  `Route` is `string`, so `navigate()` is unconstrained, non-breaking for
  JSDoc apps and un-generated apps alike.)
- Per-route `params`: `PageProps<'/blog/[slug]'>['params']` becomes
  `{ slug: string }`, derived from the generated `RouteParamMap`.

```sh
webjs types     # writes .webjs/routes.d.ts (count of routes printed)
```

`webjs dev` also emits it automatically at startup and re-emits after each
route rebuild, so an editor always has fresh route types. The file is
gitignored (regenerated per machine, like Next's `.next/types`); the scaffold
`tsconfig.json` lists `.webjs/routes.d.ts` in `include` so tsserver picks it
up. To opt in for an existing app, run `webjs types` once and ensure your
`tsconfig.json` `include` lists `.webjs/routes.d.ts`.

This is webjs's no-build equivalent of Next 15's `typedRoutes`, achieved via
interface declaration-merging (`declare module '@webjsdev/core'`) rather than a
bundler. The mechanism is `generateRouteTypes(appDir)` in
`packages/server/src/route-types.js`, which reuses the one route enumerator
(`buildRouteTable`). Output is deterministic (sorted keys), so re-running
yields a byte-identical file.

### The `webjs` package.json config block: `WebjsConfig` + JSON Schema

The `webjs` object in `package.json` (the `elide` / `headers` / `redirects` /
`trailingSlash` / `csp` knobs plus the ingress body-size and timeout caps) has
two typed references, so a typo'd key is diagnosed instead of silently dropped:

- **A JSON Schema**, `packages/server/webjs-config.schema.json` (shipped in the
  `@webjsdev/server` package). The scaffold's `.vscode/settings.json` associates
  it with the `webjs` property of `package.json`, so VS Code flags an unknown
  key natively while you edit the JSON. `additionalProperties: false` on the
  block is what turns a typo into an editor warning.
- **The `WebjsConfig` type**, exported from `@webjsdev/core`, a typed reference
  for an agent or human authoring the block (with `WebjsHeaderRule`,
  `WebjsRedirectRule`, `WebjsCspConfig`, `WebjsTrailingSlash` for the nested
  shapes).

```ts
import type { WebjsConfig } from '@webjsdev/core';

const config: WebjsConfig = {
  trailingSlash: 'never',
  csp: true,
  redirects: [{ source: '/old', destination: '/new' }],
};
```

The schema and the type mirror what the server readers actually consume
(`readElideEnabled`, `compileHeaderRules`, `compileRedirectRules` /
`readTrailingSlashPolicy`, `readCspConfig`, `readBodyLimits` /
`computeServerTimeouts`). Adding a `webjs.*` key means updating the schema, the
type, AND the reader in lockstep, the one procedure documented in
`packages/server/AGENTS.md`. A drift test
(`packages/server/test/config/webjs-config-schema.test.js`) fails if the schema
and the reader key set diverge.

### Both runtime packages ship a type overlay

Both `@webjsdev/core` AND `@webjsdev/server` ship a hand-authored `.d.ts`
overlay plus a `types` export condition, so a `strict` + `nodenext` app
resolves real types for either import with no TS7016 ("could not find a
declaration file") error. The server overlay (`packages/server/index.d.ts`,
with `src/check.d.ts` and `src/testing.d.ts` for the `./check` / `./testing`
subpaths) types the full public surface (`createRequestHandler`, `startServer`,
`cors`, `cache`, `createAuth`, `rateLimit`, `sitemap`, `Session`, `json`,
`readBody`, the `revalidate*` family, the context helpers, the cache stores, the
auth providers, the test harness, and the convention validator), reusing the
core prop / metadata types rather than redefining them. The runtime stays plain
`.js` + JSDoc; the overlay is types-only with zero runtime cost. A drift test
keeps `index.d.ts` in lockstep with `index.js`'s runtime exports.

### TypeScript is not required

JS + JSDoc gets the same call-site type safety. The TypeScript language
server reads `@typedef` / `@param` / `@returns` identically to `.ts`
syntax. Add `"checkJs": true` to enforce types in editor + CI.

## Editor plugin: `@webjsdev/ts-plugin`

**Editor-only. Not required for the framework to run.** The runtime
has no dependency on it.

A single plugin with its OWN in-template intelligence (no Lit dependency; the `webjs` VSCode extension bundles it). List one entry:

```jsonc
"plugins": [
  { "name": "@webjsdev/ts-plugin" }
]
```

Gives you, inside `` html`` `` templates:
- **Go-to-definition** from `<my-counter>` to the class registered via `MyCounter.register('my-counter')`, from an attribute / property / event name to its class member, and from a CSS class in `class="…"` to its `` css`` `` rule.
- **Completions**: reachable custom-element tag names after `<`, and binding-aware attribute completions: `.` offers property names, plain / `?` offer hyphenated attribute names (`maxLength` → `max-length`), `@event` is permissive.
- **Diagnostics**: attribute / property value type-checks (`<my-counter .count=${expr}>` assignability-checks `typeof expr` against `declare count: T`; `@click=${fn}` must be callable), unquoted `@`/`.`/`?` bindings (invariant 4), and expressionless `.prop` bindings.
- **Hover**: a tag shows its component class; an attribute / property / event shows its declared type.

Every feature is gated on import-graph reachability: a tag is recognized only if the file registering it is reachable from the file you're editing. There is deliberately no blanket "unknown tag / attribute" diagnostic (webjs has no element type map, so it would false-positive on third-party custom elements).

### The `webjs` VSCode extension (recommended over a manual tsconfig plugin)

The `webjs` extension (`packages/vscode`, on the VS Marketplace and Open VSX) is the all-in-one editor setup. It bundles the tsserver plugin and auto-registers it via `contributes.typescriptServerPlugins`, so you get the intelligence above **without editing `tsconfig.json`**, plus:

- `` html` `` / `` css` `` / `` svg` `` template highlighting via original TextMate injection grammars (no separate Lit / lit-html extension needed).
- Snippets for the common recipes (`wjpage`, `wjcomponent`, `wjaction`, and more).
- Commands (`webjs: Run check`, `webjs: Create a new app`, `webjs: Open documentation`).

It works in VSCode and its forks (Cursor, Antigravity, Windsurf, VSCodium), which pull from Open VSX. The bundled plugin is standalone (no Lit dependency), so it is the whole webjs language service. Install via the Extensions view (search "webjs"), or for editors without a UI, `code --install-extension webjs.vsix`. **Neovim** has its own plugin, `webjs.nvim` (`packages/nvim`, install `webjsdev/webjs.nvim` via lazy.nvim / packer): treesitter `html` / `css` / `svg` template highlighting plus the same tsserver plugin wired through `ts_ls`. JetBrains uses the manual `tsconfig.json` `plugins` entry above.
