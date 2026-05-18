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
server transparently falls back to `esbuild.transform` for those
specific files. The fallback emits an inline sourcemap so DevTools
can still resolve source positions. Your own code never takes this
path as long as `erasableSyntaxOnly` is set.

If you manually turn `erasableSyntaxOnly` off and write non-erasable
syntax in your own code, the same fallback fires: those files cost
~3x wire bytes (sourcemap overhead) and lose strict position
preservation. The convention check warns about this.

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
instead of runtime fallback to esbuild.

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
import { json } from '@webjskit/server';
import { listPosts } from '../../../modules/posts/queries/list-posts.server.ts';

export async function GET() {
  return json(await listPosts());   // content-negotiates automatically
}
```

```ts
// caller: client
import { richFetch } from '@webjskit/core';
const posts = await richFetch<Post[]>('/api/posts');
// posts[0].createdAt is a Date here.
```

The `json()` helper reads the in-flight Request via AsyncLocalStorage:
- `Accept: application/vnd.webjs+json` → encoded with the webjs serializer, served with `Content-Type: application/vnd.webjs+json` and `Vary: Accept`.
- Otherwise → plain JSON.

Request bodies parse with `readBody(req)` from `@webjskit/server`.

### TypeScript is not required

JS + JSDoc gets the same call-site type safety. The TypeScript language
server reads `@typedef` / `@param` / `@returns` identically to `.ts`
syntax. Add `"checkJs": true` to enforce types in editor + CI.

## Editor plugin: `@webjskit/ts-plugin`

**Editor-only. Not required for the framework to run.** The runtime
has no dependency on it.

A single plugin. As of `@webjskit/ts-plugin@0.4.0`, `ts-lit-plugin`
is bundled internally, so list one entry:

```jsonc
"plugins": [
  { "name": "@webjskit/ts-plugin" }
]
```

Gives you:
- Type-check + diagnostics for attribute *values* inside `` html`` `` templates.
- Go-to-definition from `<my-counter>` to the class registered via `MyCounter.register('my-counter')`.
- Diagnostic suppression for "Unknown tag" / "Unknown attribute" on tags any webjs class registers.
- Attribute auto-complete from `static properties = { … }` keys.
- Attribute-value type-check: `<my-counter count=${expr}>` assignability-checks `typeof expr` against `declare count: T`.

Both behaviours are gated on import-graph reachability: a tag is recognized only if the file registering it is reachable from the file you're editing.
