# TypeScript without a build step + full-stack type safety

Files ending in `.ts` / `.mts` are supported everywhere `.js` / `.mjs`
are — same routing conventions, same server-action behaviour, same
bundle participation. No `tsc` run is part of the user-visible workflow:

- **Editor** (VS Code) runs the TypeScript language server continuously. Red-squiggle on wrong types.
- **CI** (optional) runs `tsc --noEmit` against `tsconfig.json`. Type-check only.
- **Dev server** (runtime, both directions): the server registers an esbuild ESM loader hook at startup (`module.register()`) so every `.ts` import — server-side (SSR pages, layouts, actions, routes) or browser-fetched (`/components/foo.ts`) — flows through the same `esbuild.transform()` call (~0.5–1ms per file, cached by mtime). SSR + hydration must produce equivalent JS.
- **`webjs build`**: same esbuild for optional production bundle.

## TypeScript feature support

Because esbuild handles both server-side and browser-bound `.ts`,
every TS feature esbuild supports works in webjs: enums, namespaces
with runtime values, parameter properties, decorators (legacy and
Stage-3), generics, type assertions. No "stick to erasable syntax"
caveat.

## Import convention

Use explicit `.ts` extensions in imports. The esbuild loader hook
expects file URLs ending in `.ts` / `.mts`. For mixed codebases, `.js`
imports that point at a `.ts` sibling also resolve in the dev server
— but prefer explicit `.ts`.

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
    "skipLibCheck": true
  }
}
```

## Full-stack type safety

### Server actions — type-safe automatically

Calling a server action from a client component resolves — at type-check
time — to the action's real source file. The dev server's runtime stub
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
instances come through as plain objects — prototypes lost, methods
don't survive (matches React Server Actions).

### API routes — opt in via content negotiation

`route.ts` handlers use standard JSON by default so external consumers
keep working. Opt into rich types for your own UI code:

```ts
// app/api/posts/route.ts — server
import { json } from '@webjskit/server';
import { listPosts } from '../../../modules/posts/queries/list-posts.server.ts';

export async function GET() {
  return json(await listPosts());   // content-negotiates automatically
}
```

```ts
// caller — client
import { richFetch } from '@webjskit/core';
const posts = await richFetch<Post[]>('/api/posts');
// posts[0].createdAt is a Date here.
```

The `json()` helper reads the in-flight Request via AsyncLocalStorage:
- `Accept: application/vnd.webjs+json` → encoded with the webjs serializer; `Content-Type: application/vnd.webjs+json`; `Vary: Accept`.
- Otherwise → plain JSON.

Request bodies parse with `readBody(req)` from `@webjskit/server`.

### TypeScript is not required

JS + JSDoc gets the same call-site type safety. The TypeScript language
server reads `@typedef` / `@param` / `@returns` identically to `.ts`
syntax. Add `"checkJs": true` to enforce types in editor + CI.

## Editor plugin — `@webjskit/ts-plugin`

**Editor-only — not required for the framework to run.** The runtime
has no dependency on it.

A single plugin. As of `@webjskit/ts-plugin@0.4.0`, `ts-lit-plugin`
is bundled internally — list one entry:

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

Both behaviours are gated on import-graph reachability — a tag is recognized only if the file registering it is reachable from the file you're editing.
