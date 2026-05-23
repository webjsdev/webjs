import { html } from '@webjsdev/core';

export const metadata = { title: 'TypeScript | webjs' };

export default function TypeScript() {
  return html`
    <h1>TypeScript</h1>
    <p>webjs is built for TypeScript from the ground up, but never forces a build step you run. The framework requires Node 24+, which strips TypeScript types natively (<code>process.features.typescript === 'strip'</code>). Server-side <code>.ts</code> imports work without any loader registration; browser-bound <code>.ts</code> requests go through <code>module.stripTypeScriptTypes</code> on the dev server. Both paths perform whitespace replacement: every (line, column) in the source maps to the same position in the stripped output, so no sourcemap is shipped and stack traces are byte-exact.</p>

    <h2>No-Build TypeScript</h2>
    <p>Node 24+'s built-in type stripping does the heavy lifting. The dev server reads each <code>.ts</code> request from disk, runs <code>module.stripTypeScriptTypes</code>, and serves the result. Transform time is around 1ms per file; the result is cached by mtime, so subsequent loads are instant. SSR and hydration produce identical JS because both halves use the same stripper.</p>
    <p>On the server side, your pages, layouts, server actions, and middleware run as-is. On the client side, browsers fetch <code>.ts</code> URLs and receive whitespace-stripped JS with no sourcemap appended. The URL keeps its <code>.ts</code> extension; only the response body changes. In production, <code>webjs start</code> uses the same code path, with the same mtime cache.</p>
    <p>The "no build" promise is literal: every position in source maps to itself in runtime. DevTools shows accurate stack traces without consulting a sourcemap. No bundler runs on your machine for app code; vendor packages resolve via importmap to esm.sh and cache to <code>.webjs/vendor/</code> (Rails 7 + importmap-rails pattern).</p>

    <h2>Use .ts or .js: both are first-class</h2>
    <p>webjs treats <code>.ts</code>, <code>.mts</code>, <code>.js</code>, and <code>.mjs</code> identically for routing and module resolution. The router recognises <code>page.ts</code> and <code>page.js</code> the same way. The action scanner recognises <code>create-post.server.ts</code> and <code>create-post.server.js</code>. Pick your preference and be consistent, or mix them freely across your project.</p>

    <h2>tsconfig.json Setup</h2>
    <p>TypeScript type-checking is entirely optional, but recommended. Here is the recommended <code>tsconfig.json</code>:</p>
    <pre>{
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
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "erasableSyntaxOnly": true
  },
  "include": [
    "app/**/*",
    "components/**/*",
    "modules/**/*",
    "lib/**/*",
    "middleware.ts"
  ],
  "exclude": ["node_modules", ".webjs", "prisma/migrations"]
}</pre>
    <p>Key settings explained:</p>
    <ul>
      <li><strong>erasableSyntaxOnly: true</strong>: rejects non-erasable TypeScript syntax (<code>enum</code>, <code>namespace</code> with values, constructor parameter properties, legacy decorators, <code>import = require</code>) at compile time. Required because Node's built-in stripper only supports erasable TypeScript. Violations surface as red squiggles in the editor. See <strong>TypeScript Feature Support</strong> below for the erasable equivalents.</li>
      <li><strong>noEmit: true</strong>: webjs never compiles TypeScript to JavaScript on disk. The TypeScript compiler is used only for type-checking (<code>tsc --noEmit</code>). Node runs your <code>.ts</code> files directly via its built-in stripper.</li>
      <li><strong>allowImportingTsExtensions: true</strong>: lets you write <code>import { foo } from './bar.ts'</code> with the explicit <code>.ts</code> extension. This is the webjs convention (see below).</li>
      <li><strong>checkJs: true</strong>: type-check your <code>.js</code> files too, using JSDoc annotations. Enables a mixed codebase where both <code>.ts</code> and <code>.js</code> files participate in the same type graph.</li>
      <li><strong>allowJs: true</strong>: include <code>.js</code> files in the project. Required alongside <code>checkJs</code>.</li>
      <li><strong>module / moduleResolution: NodeNext</strong>: matches how Node resolves ESM imports, including <code>.ts</code> extensions.</li>
      <li><strong>isolatedModules: true</strong>: ensures every file can be transpiled independently, matching the per-file transform model of Node's stripper.</li>
    </ul>

    <h2>Import Convention: Explicit .ts Extensions</h2>
    <p>In webjs projects, always use the real file extension in your imports:</p>
    <pre>// Good: explicit .ts extension
import { prisma } from '../lib/prisma.server.ts';
import { createPost } from '../../modules/posts/actions/create-post.server.ts';
import type { PostFormatted } from '../types.ts';

// Also fine: .js files
import { slugify } from '../utils/slugify.js';

// Avoid: extensionless imports don't work with Node's ESM or in browsers
import { prisma } from '../lib/prisma';       // ERROR</pre>
    <p>This convention works because:</p>
    <ul>
      <li>Node 24+ strips types from <code>.ts</code> imports server-side natively. No loader hook required.</li>
      <li>The dev server reads <code>.ts</code> files from disk, runs <code>module.stripTypeScriptTypes</code>, and serves the result with position-preserving whitespace replacement.</li>
      <li>When the browser requests a <code>.js</code> file that doesn't exist but a sibling <code>.ts</code> does, webjs falls back to the <code>.ts</code> version automatically. This means libraries that import without extensions can still work.</li>
    </ul>

    <h2>Full-Stack Type Safety</h2>
    <p>Server actions in webjs provide end-to-end type safety without code generation. When a client component imports from a <code>.server.ts</code> file, TypeScript sees the real function signature:</p>
    <pre>// modules/posts/actions/create-post.server.ts
'use server';

export type ActionResult&lt;T&gt; =
  | { success: true; data: T }
  | { success: false; error: string; status: number };

export async function createPost(
  input: unknown
): Promise&lt;ActionResult&lt;PostFormatted&gt;&gt; {
  // server-only code: database queries, auth checks, etc.
  const me = await currentUser();
  if (!me) return { success: false, error: 'Not signed in', status: 401 };
  // ...
}</pre>
    <pre>// components/new-post-form.ts: client component
import { createPost } from '../modules/posts/actions/create-post.server.ts';

// TypeScript knows createPost accepts (input: unknown)
// and returns Promise&lt;ActionResult&lt;PostFormatted&gt;&gt;
const result = await createPost({ title, body });
if (result.success) {
  // result.data is typed as PostFormatted
  console.log(result.data.slug);
}</pre>
    <p>At runtime, the browser never receives the server code. webjs replaces the import with a thin RPC stub that calls <code>POST /__webjs/action/:hash/createPost</code>. But TypeScript's type checker sees through the <code>.server.ts</code> boundary and validates argument/return types at compile time.</p>

    <h2>Rich Types Across the Wire</h2>
    <p>Standard JSON cannot represent <code>Date</code>, <code>Map</code>, <code>Set</code>, <code>BigInt</code>, <code>undefined</code>, <code>NaN</code>, <code>Infinity</code>, <code>TypedArray</code>, <code>Blob</code>, <code>File</code>, or <code>FormData</code>. webjs ships its own pure-ESM serializer (in <code>@webjsdev/core</code>) used for all server action RPC calls and for the <code>json()</code> / <code>richFetch()</code> helpers, so rich types survive the network round-trip, including binary content (file uploads through actions just work).</p>
    <pre>// Server action
export async function getEvents(): Promise&lt;Event[]&gt; {
  return prisma.event.findMany(); // createdAt is a Date
}

// Client: createdAt arrives as a real Date, not a string
const events = await getEvents();
events[0].createdAt instanceof Date; // true
events[0].createdAt.toLocaleDateString(); // works</pre>
    <p>For API routes, the same content negotiation applies. Use <code>json()</code> from <code>@webjsdev/server</code> on the server side and <code>richFetch()</code> from <code>webjs</code> on the client side to get rich-type encoding. External consumers (curl, other services) get plain JSON automatically.</p>

    <h2>JSDoc Alternative</h2>
    <p>If you prefer <code>.js</code> files, you can achieve the same type safety using JSDoc annotations with <code>checkJs: true</code> in your tsconfig:</p>
    <pre>// lib/prisma.js
/** @type {import('@prisma/client').PrismaClient} */
export const prisma = new PrismaClient();

/**
 * @param {{ title: string, body: string }} input
 * @returns {Promise&lt;{ success: boolean, data?: Post, error?: string }&gt;}
 */
export async function createPost(input) {
  // TypeScript checks types via JSDoc, same strictness
}</pre>
    <p>You can also define complex types with <code>@typedef</code>:</p>
    <pre>/**
 * @typedef {{
 *   id: number,
 *   title: string,
 *   slug: string,
 *   body: string,
 *   createdAt: Date,
 *   author: { name: string, email: string }
 * }} PostFormatted
 */

/** @param {PostFormatted} post */
export function formatDate(post) {
  return post.createdAt.toLocaleDateString();
}</pre>
    <p>JSDoc-typed <code>.js</code> files and <code>.ts</code> files can import each other freely. The type checker treats them as part of the same project.</p>

    <h2>TypeScript Feature Support: Erasable Only</h2>
    <p>webjs uses Node 24+'s built-in <code>module.stripTypeScriptTypes</code> as its primary stripper. That stripper only supports <strong>erasable TypeScript</strong>: type annotations, <code>interface</code>, <code>type</code>, <code>declare</code>, generics, <code>import type</code>, <code>as</code> casts, <code>satisfies</code>. Non-erasable syntax is rejected at compile time (via <code>erasableSyntaxOnly: true</code>) and at runtime.</p>
    <p>What's not allowed, and what to write instead:</p>
    <ul>
      <li><strong>Enums</strong> are not allowed. Use a <code>const</code> object plus a derived union type.</li>
      <li><strong>Namespaces with values</strong> are not allowed. Use a plain object or an ES module.</li>
      <li><strong>Constructor parameter properties</strong> are not allowed. Declare the field explicitly and assign in the constructor body.</li>
      <li><strong>Legacy decorators with <code>emitDecoratorMetadata</code></strong> are not allowed. Stage-3 standard decorators work fine.</li>
      <li><strong><code>import = require()</code></strong> is not allowed. Use standard ES import.</li>
      <li><strong>Generics</strong>, type aliases, interfaces, type assertions, satisfies, const assertions: all supported (these are erasable).</li>
    </ul>
    <pre>// Not allowed (red squiggle with erasableSyntaxOnly):
enum Direction { Up, Down, Left, Right }
class User { constructor(public name: string) {} }
namespace Util { export const VERSION = '1.0'; }

// Erasable equivalents:
const Direction = { Up: 'up', Down: 'down', Left: 'left', Right: 'right' } as const;
type Direction = (typeof Direction)[keyof typeof Direction];

class User {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

const Util = { VERSION: '1.0' };</pre>
    <p>This constraint exists because Node's stripper performs whitespace replacement, not AST regeneration. <code>enum</code> requires emitting a real runtime object, which would change line numbers and require shipping a sourcemap. Banning it preserves the byte-exact position property.</p>
    <p>Non-erasable syntax is rejected at request time with a 500 and a clear remediation message. There is no fallback to esbuild. Third-party <code>.ts</code> dependencies never reach this path in normal use because vendor packages resolve via esm.sh (which serves pre-compiled JavaScript). The <code>erasable-typescript-only</code> convention check warns when the tsconfig flag is off; the companion <code>no-non-erasable-typescript</code> rule additionally scans <code>.ts</code> source for the four common offending patterns even if the tsconfig flag is unset.</p>

    <h2>Mixed Codebases</h2>
    <p><code>.js</code> and <code>.ts</code> files can coexist in the same webjs project and import each other without restriction:</p>
    <pre>my-app/
app/
  layout.ts                # TypeScript
  page.js                  # JavaScript
  blog/
    page.ts                # TypeScript
    [slug]/
      page.ts
components/
  counter.ts               # TypeScript component
  footer.js                # JavaScript component
lib/
  prisma.ts
  utils.js                 # JSDoc-typed JavaScript
middleware.ts              # TypeScript
tsconfig.json</pre>
    <pre>// app/page.js can import from .ts files
import '../components/counter.ts';

// lib/utils.js can import from .ts files
import { prisma } from './prisma.ts';

// app/blog/page.ts can import from .js files
import '../components/footer.js';</pre>
    <p>The router, action scanner, dev server, and production bundler all accept <code>.ts</code>, <code>.mts</code>, <code>.js</code>, and <code>.mjs</code> interchangeably. Type-check the whole project with a single <code>tsc --noEmit</code>.</p>

    <h2>Running Type Checks</h2>
    <p>webjs does not type-check at runtime or during dev serving. Add a type-check command to your workflow:</p>
    <pre>{
  "scripts": {
    "dev": "webjs dev",
    "start": "webjs start",
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch"
  }
}</pre>
    <p>Run <code>npm run typecheck</code> in CI or as a pre-commit hook. The dev server stays fast because it only strips types. Full type analysis is a separate, parallelizable step.</p>
  `;
}
