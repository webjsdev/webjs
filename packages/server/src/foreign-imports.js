/**
 * Foreign-framework imports: `next/*`, `react`, `lit` and its family. An agent
 * trained on those frameworks writes them from habit, and each one fails
 * somewhere unhelpful: a bare 404 in the browser, `Cannot find package 'next'`
 * on the server, or (for `lit`, which jspm resolves) a second component
 * runtime silently loaded from the CDN beside WebJs's own.
 *
 * WebJs never aliases or accepts these packages. This table is the ONE place
 * that names each and the exact WebJs replacement, and every refusal reads it:
 *   - `webjs check` (`no-foreign-framework-import`, in check/rules-imports.js);
 *   - the dev / prod analysis (`foreignImportProblems`, a load-time refusal
 *     before anything renders, dev overlay or prod readiness 503);
 *   - the server import path: `explainImportError` rewrites Node's
 *     `ERR_MODULE_NOT_FOUND` for a foreign package, and the Node resolve hook
 *     (`registerForeignImportGuard`) refuses one an app file imports even when
 *     the package IS installed (a transitive dependency);
 *   - the vendor scanner, which never sends one to jspm.
 *
 * `react` / `react-dom` stay allowed in a `*.server.*` file, where a library
 * such as an email renderer may legitimately use them; they never reach the
 * browser from there.
 *
 * @module foreign-imports
 */
import * as nodeModule from 'node:module';
import { fileURLToPath } from 'node:url';
import { sep } from 'node:path';
import { readFileSync } from 'node:fs';
import { shared } from './process-shared.js';

/** The stylesheet fix (kept in step with app-layout.js CSS_IMPORT_FIX). */
const CSS_FIX = 'Load it with <link rel="stylesheet" href="..."> in the root layout, or scope CSS to a component with `static styles = css`...`` and `static shadow = true`.';

/** Where every refusal points for more. */
export const FOREIGN_IMPORT_DOCS = 'https://webjs.dev/docs/troubleshooting#foreign-framework-import';

/**
 * @typedef {{ framework: 'Next.js' | 'React' | 'Lit', fix: string }} ForeignImport
 */

/** A cheap gate before the table, since the resolve guard sees every import. */
const FOREIGN_PREFIX = /^(?:next|react|lit|@lit)/;

/** @type {Array<[RegExp, ForeignImport]>} */
const TABLE = [
  [/^next\/navigation$/, { framework: 'Next.js', fix: "import { redirect, permanentRedirect, notFound, forbidden, unauthorized, navigate } from '@webjsdev/core'. A page's params and searchParams arrive as props; a component reads location for the current URL." }],
  [/^next\/headers$/, { framework: 'Next.js', fix: "import { cookies, headers } from '@webjsdev/server' (same API: await cookies() then .get(name)?.value)." }],
  [/^next\/server$/, { framework: 'Next.js', fix: "middleware and route handlers use the platform Request and Response: return a Response to answer, call next() to continue (returning undefined also continues). Type a middleware's request as MiddlewareRequest from '@webjsdev/server' (it carries request.cookies, as NextRequest does). Use Response.json() for NextResponse.json() and new URL(request.url) for request.nextUrl." }],
  [/^next\/cache$/, { framework: 'Next.js', fix: "import { revalidatePath, revalidateTag, cache } from '@webjsdev/server'." }],
  [/^next\/link$/, { framework: 'Next.js', fix: 'write a plain <a href="/path">. The client router intercepts it automatically, with prefetch on hover.' }],
  [/^next\/image$/, { framework: 'Next.js', fix: 'write a plain <img src="/photo.png" width height loading="lazy"> (public/photo.png is served at /photo.png).' }],
  [/^next\/font(\/.*)?$/, { framework: 'Next.js', fix: 'load the font with a <link rel="stylesheet"> in the root layout, or @font-face in your CSS with a file from public/.' }],
  [/^next\/script$/, { framework: 'Next.js', fix: 'write a <script type="module" src="..."> in the root layout, or move the behaviour into a component.' }],
  [/^next\/dynamic$/, { framework: 'Next.js', fix: "use a native dynamic import('./x.ts') with a string literal, or `static lazy = true` on a component to load it when it scrolls into view." }],
  [/^next-auth(\/.*)?$/, { framework: 'Next.js', fix: "auth is Auth.js's API from '@webjsdev/server': export const { handlers, auth, signIn, signOut } = createAuth({ providers: [Credentials({ authorize })], secret }); mount it with export const { GET, POST } = handlers in app/api/auth/[...path]/route.ts. signIn, signOut and AuthError behave as in Auth.js v5 inside a server action." }],
  [/^next(\/.*)?$/, { framework: 'Next.js', fix: "types such as Metadata, PageProps and LayoutProps are `import type { ... } from '@webjsdev/core'`; next.config settings live in the \"webjs\" block of package.json." }],
  [/^react-dom(\/.*)?$/, { framework: 'React', fix: "write a component: class X extends WebComponent({ ... }) { render() { return html`...`; } } X.register('x-tag'); from '@webjsdev/core'. State is a reactive property or signal() from '@webjsdev/core'." }],
  [/^react(\/.*)?$/, { framework: 'React', fix: "write a component: class X extends WebComponent({ ... }) { render() { return html`...`; } } X.register('x-tag'); from '@webjsdev/core'. useState becomes a reactive property or signal(), useEffect becomes connectedCallback / updated()." }],
  [/^lit\/directives\/.+$/, { framework: 'Lit', fix: "import the directive from '@webjsdev/core/directives' (repeat, classMap, styleMap, ifDefined, when, ref, live, until, ...)." }],
  [/^lit\/decorators(\.js)?$/, { framework: 'Lit', fix: "decorators are not erasable TypeScript; declare reactive properties with `static properties = { ... }` or the WebComponent({ ... }) factory from '@webjsdev/core'." }],
  [/^lit\/static-html(\.js)?$/, { framework: 'Lit', fix: "import { literal, unsafeStatic, html } from '@webjsdev/core/static-html'." }],
  [/^lit\/directive(\.js)?$/, { framework: 'Lit', fix: "import { directive, Directive, PartType } from '@webjsdev/core/directive'." }],
  [/^lit\/async-directive(\.js)?$/, { framework: 'Lit', fix: "import { AsyncDirective } from '@webjsdev/core/async-directive'." }],
  [/^(lit|lit-html|lit-element)(\/.*)?$/, { framework: 'Lit', fix: "import { WebComponent, html, css, svg, nothing, noChange } from '@webjsdev/core'. LitElement is WebComponent; register with X.register('x-tag')." }],
  [/^@lit\/context(\/.*)?$/, { framework: 'Lit', fix: "import { createContext, ContextProvider, ContextConsumer } from '@webjsdev/core/context'." }],
  [/^@lit\/task(\/.*)?$/, { framework: 'Lit', fix: "import { Task, TaskStatus } from '@webjsdev/core/task'." }],
  [/^@lit\/reactive-element(\/.*)?$/, { framework: 'Lit', fix: "import { WebComponent } from '@webjsdev/core' (it is the reactive element base class)." }],
  [/^@lit-labs\/.+$/, { framework: 'Lit', fix: "the @lit-labs packages are built into WebJs: SSR is automatic, signals are signal() / computed() from '@webjsdev/core', and context and task live at '@webjsdev/core/context' and '@webjsdev/core/task'." }],
];

/**
 * The foreign framework a bare specifier names, with its WebJs replacement,
 * or null when the specifier is not foreign.
 * @param {string} spec
 * @returns {ForeignImport | null}
 */
export function foreignImport(spec) {
  if (typeof spec !== 'string' || !spec || !FOREIGN_PREFIX.test(spec)) return null;
  for (const [re, entry] of TABLE) if (re.test(spec)) return entry;
  return null;
}

/**
 * Whether `react` / `react-dom` may be imported from `file`: only from a
 * server-only module, which never reaches the browser.
 * @param {string} spec
 * @param {string} [file]
 */
export function foreignImportAllowed(spec, file) {
  const f = foreignImport(spec);
  if (!f) return true;
  return f.framework === 'React' && !!file && /\.server\.m?[jt]s$/.test(file);
}

/**
 * The one-line refusal every surface prints.
 * @param {string} spec
 * @param {string} [file] the importing file, as the reader should see it
 * @returns {string}
 */
export function foreignImportMessage(spec, file) {
  const f = foreignImport(spec);
  if (!f) return '';
  const where = file ? `${file} imports '${spec}'` : `'${spec}' is imported`;
  return `${where}, a ${f.framework} package. WebJs does not load ${f.framework}: ${f.fix} See ${FOREIGN_IMPORT_DOCS}`;
}

/**
 * Every foreign import in an app's module graph, as layout-style problems
 * (rule id, file, message, fix). Fed by `bareImports(graph)`, so it covers
 * every file the graph walked, server modules included.
 * @param {Map<string, Set<string>>} bareByFile absolute file -> bare specifiers
 * @param {(abs: string) => string} rel
 * @returns {{ rule: string, file: string, message: string, fix: string }[]}
 */
export function foreignImportProblems(bareByFile, rel) {
  const out = [];
  for (const [abs, specs] of bareByFile) {
    if (/[\\/]node_modules[\\/]/.test(abs)) continue;
    for (const spec of specs) {
      const f = foreignImport(spec);
      if (!f || foreignImportAllowed(spec, abs)) continue;
      out.push({
        rule: 'no-foreign-framework-import',
        file: rel(abs),
        message: `Imports '${spec}', a ${f.framework} package. WebJs does not load ${f.framework}.`,
        fix: f.fix,
      });
    }
  }
  return out;
}

/**
 * Rewrite a module-load failure into the WebJs fix when its cause is a
 * foreign import (Node's `ERR_MODULE_NOT_FOUND` / Bun's "Cannot find package"
 * for `next`, `react`, `lit`, ...). Any other error is returned unchanged.
 * @param {unknown} err
 * @param {string} [file] the module that was being imported
 * @returns {unknown}
 */
export function explainImportError(err, file) {
  if (!err || typeof err !== 'object') return err;
  const e = /** @type {any} */ (err);
  if (e.webjsForeignImport) return err;
  const msg = String(e.message || '');
  // `import './x.css'` on Node: a bundler feature WebJs does not have.
  if (e.code === 'ERR_UNKNOWN_FILE_EXTENSION' && /\.css\b/.test(msg)) {
    const out = new Error(`${file ? file + ' imports' : 'An import of'} a stylesheet (${/for (\S+)/.exec(msg)?.[1] || '.css'}). WebJs has no bundler, so CSS cannot be imported as a module. ${CSS_FIX} See https://webjs.dev/docs/troubleshooting#css-import`, { cause: err });
    /** @type {any} */ (out).code = e.code;
    /** @type {any} */ (out).webjsForeignImport = '.css';
    return out;
  }
  const m = /Cannot find (?:package|module) '([^']+)'/.exec(msg) || /Cannot find package "([^"]+)"/.exec(msg);
  if (!m) return err;
  let spec = m[1];
  // Node names the package directory for a missing package
  // ("Cannot find package '/app/node_modules/next/'"); keep the name.
  const nm = /node_modules[\\/](@[^\\/]+[\\/][^\\/]+|[^\\/]+)/.exec(spec);
  if (nm) spec = nm[1].replace(/\\/g, '/');
  // The importing file's own foreign import is the truth: Node names only the
  // package ('next' for 'next/headers'), and Bun can name a package deep
  // inside a dependency it auto-installed ('react' for an import of
  // 'next/headers'). Read the source and name what the author wrote.
  const own = file ? firstForeignSpecifier(file) : null;
  if (own) spec = own;
  if (!foreignImport(spec)) return err;
  const out = new Error(foreignImportMessage(spec, file), { cause: err });
  /** @type {any} */ (out).code = e.code || 'ERR_MODULE_NOT_FOUND';
  /** @type {any} */ (out).webjsForeignImport = spec;
  return out;
}

/**
 * The first foreign import specifier written in `file`, or null.
 * @param {string} file
 * @returns {string | null}
 */
function firstForeignSpecifier(file) {
  let src = '';
  try { src = readFileSync(file, 'utf8'); } catch { return null; }
  const re = /(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"\n]+)\1/g;
  let m;
  while ((m = re.exec(src))) if (foreignImport(m[2])) return m[2];
  return null;
}

/** App roots the resolve guard watches (process-wide, one hook per process). */
const _guard = shared('foreign-import-guard', () => ({ roots: new Set(), registered: false }));

/**
 * Refuse a foreign import from an app's own source at RESOLVE time on Node,
 * even when the package is installed (a transitive dependency of something
 * else), so `import { LitElement } from 'lit'` in a page never quietly loads a
 * second runtime. Scoped to files under a registered app root and outside
 * `node_modules`, so a dependency that uses React internally is untouched.
 *
 * Node only: Bun has no `module.registerHooks`, and its `Bun.plugin`
 * `onResolve` cannot see the importer reliably enough to scope the refusal
 * to app files; there the check rule and the analysis scan carry it.
 * Coexists with the seed load hook (`action-seed.js`): this registers a
 * `resolve` hook only, which chains independently of `load` hooks.
 *
 * @param {string} appDir
 */
export function registerForeignImportGuard(appDir) {
  if (process.versions.bun) return;
  _guard.roots.add(appDir.endsWith(sep) ? appDir : appDir + sep);
  if (_guard.registered || typeof nodeModule.registerHooks !== 'function') return;
  _guard.registered = true;
  nodeModule.registerHooks({
    resolve(specifier, context, nextResolve) {
      const parent = context.parentURL;
      if (parent && parent.startsWith('file:') && foreignImport(specifier)) {
        let file = '';
        try { file = fileURLToPath(parent.split('?')[0]); } catch { /* not a path */ }
        if (file && !/[\\/]node_modules[\\/]/.test(file) && [..._guard.roots].some((r) => file.startsWith(r))
          && !foreignImportAllowed(specifier, file)) {
          const err = new Error(foreignImportMessage(specifier, file));
          /** @type {any} */ (err).code = 'ERR_WEBJS_FOREIGN_IMPORT';
          /** @type {any} */ (err).webjsForeignImport = specifier;
          throw err;
        }
      }
      return nextResolve(specifier, context);
    },
  });
}
