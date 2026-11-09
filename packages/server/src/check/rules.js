/**
 * @typedef {{
 *   rule: string,
 *   file: string,
 *   message: string,
 *   fix: string,
 * }} Violation
 */

/**
 * @typedef {{
 *   name: string,
 *   description: string,
 * }} RuleDescriptor
 */

/**
 * All available rule names with descriptions. Useful for help text and
 * documentation generators.
 *
 * @type {RuleDescriptor[]}
 */
export const RULES = [
  {
    name: 'components-have-register',
    description:
      'Component files that define a class extending WebComponent must register the class with ClassName.register(\'tag\') (or customElements.define). The server-side scanner derives the module URL from the file path.',
  },
  {
    name: 'no-server-env-in-components',
    description:
      'Code the browser runs must not read non-public environment variables: every component file (under components/ or modules/*/components/) and every module the build ships to the browser (a util a component imports). process.env.X is allowed when X starts with WEBJS_PUBLIC_ (exposed to the browser by the SSR shim) or equals NODE_ENV. Any other read leaks the server-side value into the SSR\'d HTML, then reads as undefined after hydration. Next.js\'s NEXT_PUBLIC_ prefix gets a targeted fix (rename it to WEBJS_PUBLIC_). Read server-only env vars in a page function, server action, or middleware (which never reach the browser as source) and pass derived values to the component as attributes. Page, layout and boundary modules are not scanned: their functions run on the server only.',
  },
  {
    name: 'no-next-runtime-guard',
    description:
      'Flags `process.env.NEXT_RUNTIME`, which only Next.js sets (to `nodejs` or `edge`). Under WebJs it is undefined, so the usual `if (process.env.NEXT_RUNTIME === \'nodejs\')` guard around an instrumentation `register()` silently never runs. Drop the guard (WebJs runs `register()` once, server-side only), and use `process.versions.bun` / `process.versions.node` to tell the runtimes apart.',
  },
  {
    name: 'no-next-url',
    description:
      'Flags `request.nextUrl` (as `req.nextUrl` / `request.nextUrl`, or any `.nextUrl` in a middleware or proxy file). It is Next.js\'s extended URL; WebJs passes middleware and route handlers the platform Request, so the property throws in dev. Use `new URL(request.url)`.',
  },
  {
    name: 'no-inline-use-server',
    description:
      'Flags a `\'use server\'` directive inside a function body (Next.js\'s inline server action, often written in a page). WebJs\'s server boundary is a FILE: the directive is honoured only at the top of a `*.server.{js,ts}` module, so an inline one is an ordinary string and the function runs wherever it is called, and binding it to a form throws (it has no action identity). Move the function into its own module (`modules/<feature>/actions/<name>.server.ts` starting with `\'use server\'`), export it, and import it.',
  },
  {
    name: 'tag-name-has-hyphen',
    description:
      'Static tag = \'...\' in component files must contain a hyphen (HTML custom element spec).',
  },
  {
    name: 'no-duplicate-tag',
    description:
      'A custom-element tag name must be registered exactly once across the app. Two `Class.register(\'tag\')` / `customElements.define(\'tag\', …)` calls for the SAME tag resolve INCONSISTENTLY at runtime: SSR overwrites the registry (last registration wins) while the browser keeps the first native upgrade, so the rendered element and the webjs registry disagree. Rename one tag.',
  },
  {
    name: 'no-signal-field-assignment',
    description:
      'A field a WebComponent class creates with `signal(` / `computed(` (a class-field initializer like `readonly #open = signal(false)`, or `this.open = signal(false)` in the constructor) is written through `.set()`, never assigned. `this.open = true` replaces the signal object: the component stays subscribed to the old signal, nothing re-renders, and the next `this.open.get()` throws. Fix: `this.open.set(true)`. Declare signal fields `readonly` in TypeScript so the compiler catches it too; this rule covers plain `.js` and a forgotten `readonly`, for writes inside the declaring class.',
  },
  {
    name: 'reactive-props-no-class-field',
    description:
      'A reactive property declared via the `extends WebComponent({ … })` factory or Lit\'s `static properties` must NOT also have a plain class-field declaration (`count = 0`, `count: number = 0`, `count!: number`, or `count?: number`) in the class body. Under modern class-field semantics (including `erasableSyntaxOnly: true`) every class-field declaration compiles to Object.defineProperty *after* super(), clobbering the framework\'s reactive accessor and silently breaking re-renders. Set the default by assigning in the constructor after super(). A type-only `declare count: number` is erased and is fine.',
  },
  {
    name: 'array-prop-uses-array-type',
    description:
      'An array-typed reactive property declared via the `extends WebComponent({ … })` factory must pass the `Array` runtime constructor, not `Object`: `count: prop<Tag[]>(Array)`, never `prop<Tag[]>(Object)`. The two share one converter (both JSON-encode the value), so the wrong one does not crash, but `Object` misstates the prop contract to the next reader and diverges from the documented built-in set (String/Number/Boolean/Object/Array). Fires only when the factory generic is itself an array type (`T[]`, `readonly T[]`, `Array<T>`, `ReadonlyArray<T>`) AND the constructor argument is `Object`; a bare `foo: Object` with no generic is never flagged. Fix: change the constructor to `Array`.',
  },
  {
    name: 'shell-in-non-root-layout',
    description:
      'Only the root layout (app/layout.{js,ts}) may write a <!doctype>/<html>/<head>/<body> shell to override default <html lang>, <body class>, etc. Non-root layouts (app/<segment>/layout.{js,ts}) and pages (app/**/page.{js,ts}) must not: the framework auto-emits the wrapper around the whole composition, so a nested shell ends up nested inside <body> where browsers drop it. Triggers on any of <!doctype>, <html, <head, <body in a non-root layout or page.',
  },
  {
    name: 'erasable-typescript-only',
    description:
      'Apps must opt into TypeScript\'s `erasableSyntaxOnly: true` so the compiler rejects non-erasable syntax (enum, namespace with values, constructor parameter properties, legacy decorators with emitDecoratorMetadata, import = require) at edit time. webjs strips types via Node\'s built-in `module.stripTypeScriptTypes`, which only supports erasable TypeScript and produces byte-exact position preservation (no sourcemap overhead). Files using non-erasable syntax fail at strip time and the dev server returns a 500 pointing at the no-non-erasable-typescript rule; webjs is buildless end-to-end and has no bundler fallback. The rule checks the project\'s tsconfig.json and warns when `erasableSyntaxOnly` is missing or set to false. Set `compilerOptions.erasableSyntaxOnly: true` in tsconfig.json to comply.',
  },
  {
    name: 'use-server-needs-extension',
    description:
      'Files that declare the `\'use server\'` directive at the top must also have the `.server.{js,ts,mts,mjs}` extension. The two markers are complementary, not interchangeable: `.server.ts` is the path-level boundary that triggers source protection by the file router; `\'use server\'` is the semantic opt-in that registers exports as RPC-callable from client code. A `\'use server\'` directive without the extension is silently ignored: the file is served to the browser as plain source, exports are NOT registered as RPC, and code the developer expects to run on the server actually runs in the browser. Rename the file to add the `.server.` infix.',
  },
  {
    name: 'use-server-exports-callable',
    description:
      'A `.server.{js,ts}` file that declares the `\'use server\'` directive registers its function exports as RPC-callable server actions, but only its FUNCTION exports: `buildActionIndex` / the stub generator register an export only when `typeof export === \'function\'`, so a `\'use server\'` file that exports zero functions (or only a non-function `const` / a type / only verb config like `method` / `cache`) registers NOTHING and gives no signal. The developer believes they exposed an action; nothing did, and the failure only surfaces as a 404 / undefined at the first call site. This is the complement of `use-server-needs-extension` (the directive without the extension) and of `one-action-per-configured-file` (more than one action in a configured file); this rule catches the directive-present-but-nothing-callable case. The rule asserts only that the file exports at least one callable, NOT that the action returns a value (a server action may be a void side-effect or throw `redirect()` / `notFound()` and never return). Conservative: a re-export (`export ... from`, `export *`) or an `export const NAME = <identifier-or-call>` (a possible factory-produced function such as `export const get = cache(fetch)`) is treated as a possible callable and NOT flagged, so the rule fires only when every export is provably non-callable. Fix: export an `async function` action, or drop the `\'use server\'` directive if the file is a plain server-only utility.',
  },
  {
    name: 'no-non-erasable-typescript',
    description:
      'Scans .ts / .mts source for the four non-erasable TypeScript constructs (enum declarations, namespace blocks with value statements, constructor parameter properties, and `import = require`) that the framework\'s type-stripper rejects at request time, and .ts / .mts / .js / .mjs source for DECORATORS (`@customElement`, `@property`, `@state`, `@query`, any `@name` in decorator position). The stripper passes a decorator through untouched, so the module then fails to load with a bare `SyntaxError: Invalid or unexpected token` on Node and in the browser; the rule names the decorator and its WebJs spelling (`static properties` plus `declare`, or the `WebComponent({ ... })` factory, for `@property`; `state: true` for `@state`; `MyEl.register(tag)` for `@customElement`; a getter over `this.renderRoot` for `@query`). Comments, strings and template bodies are masked first, so `@click` in an html template, `@media` in a css template, and a JSDoc `@param` never match. Companion to `erasable-typescript-only`: that rule checks the tsconfig flag, this rule checks the actual source. Both run by default so the flag check catches violations early in the editor while the source scan catches violations even if the tsconfig flag is missing or the rule is bypassed. Skips node_modules, dist, build, .git, .next, _private folders, and .js files under public/.',
  },
  {
    name: 'no-browser-globals-in-render',
    description:
      'Flags genuinely browser-only APIs used in a WebComponent constructor, willUpdate, or render() method. The SSR pipeline instantiates the component, runs willUpdate plus controllers\' hostUpdate, reflects properties, and calls render() to produce HTML, on a server element shim that backs the attribute methods but has no real DOM. So a browser global (document, window, localStorage, sessionStorage, navigator, location, matchMedia, screen, history) or an unshimmed HTMLElement member on `this` (attachShadow, shadowRoot, classList, querySelector, querySelectorAll, getBoundingClientRect, focus, blur, scrollIntoView) touched there throws at SSR time (the isomorphic footgun). The attribute methods (getAttribute/setAttribute/hasAttribute/removeAttribute/toggleAttribute), the event methods (addEventListener/removeEventListener/dispatchEvent), and attachInternals are shim-backed and run server-side, so they are NOT flagged. The flagged APIs belong in connectedCallback() or a lifecycle hook (firstUpdated/updated), which SSR never calls; seed first-paint defaults in the constructor (or derive them in willUpdate) only from server-known inputs (attributes, props). Conservative: only the constructor, willUpdate, and render bodies are scanned, and only direct references, so helper indirection is not flagged (the runtime SSR error covers that case).',
  },
  {
    name: 'no-shadowed-native-member',
    description:
      'Flags a WebComponent class method whose name collides with a native DOM mutation method that WebJs relies on and INSTRUMENTS on every light-DOM host for the slot API (#1021): append, prepend, before, after, replaceWith, replaceChildren, remove, appendChild, insertBefore, removeChild, replaceChild. A method of the same name is SHADOWED at runtime (the instrumented native method wins), so the component method silently never runs, while TypeScript stays green because a zero/one-arg override is assignable to the native signature. Found dogfooding the stream demo (#248): a component named its button handler `append()`, so clicking Append called the slot-append no-op instead of the handler. Rename the handler to a non-native name (appendRow / prependRow / removeItem). The `render` / lifecycle hooks are MEANT to be overridden and are not flagged; only the native DOM mutation members are.',
  },
  {
    name: 'no-server-import-in-browser-module',
    description:
      'A page / layout / component module that SHIPS to the browser (the build does NOT elide it) must not transitively import a server-only `.server.{ts,js}` module. The server module is replaced by a stub in the browser, so the import is fine while the module never loads client-side: a display-only page is elided, and a page whose only client relevance is importing shipping components is import-only (#605/#963), dropped from the boot in favour of its components. But the moment the page does its OWN client work (the client router, a reactive primitive, a module-scope browser-global access, a client-effecting non-component util) it ships whole, dragging the server import with it. The stub then throws (or a server-only export like `auth` is missing) the instant the module loads, a runtime browser crash that `webjs typecheck` and the rest of `webjs check` miss. The rule reuses the build\'s own elision verdict, so it ONLY fires on modules that genuinely ship; an elided, inert, or import-only page is never flagged. The fix is to keep the server call off the browser-shipped module: gate the route in `middleware.ts`, call the server through a `\'use server\'` action, or move the module\'s own client work into a component so the page is dropped again. Server-to-server imports (`.server.ts` importing `.server.ts`) and `middleware.ts` / `route.ts` (never shipped) are never flagged.',
  },
  {
    name: 'one-action-per-configured-file',
    description:
      'A `\'use server\'` action file that declares HTTP-verb config (any of `method` / `cache` / `tags` / `invalidates` / `validate`, #488) must export exactly ONE callable action function. The config is file-level (it applies to the action in the file), so a second exported function would silently inherit the same verb / cache, which is almost never intended and makes the contract ambiguous. Move the extra function to its own `.server.ts` file (the one-function-per-file convention), or, if it is a private helper, do not export it. Files with no verb config are unaffected.',
  },
  {
    name: 'form-action-not-a-get-action',
    description:
      'Flags `<form action=${someAction}>` bound to a `\'use server\'` action whose file declares `export const method = \'GET\'` (#488). A GET action is a READ: it is CSRF-exempt and rides its arguments in the url, while a form submission is a CSRF-checked POST carrying a body, so the two contracts contradict each other and the submission is answered with a 405 at runtime. The rule reads the imported action\'s own file, so it only fires when the binding really does resolve to a GET-declared action. Fix by dropping the `method` export (an action with no `method` is a POST, which is what a form wants) or by binding a different action; if the form really is a read, use a plain `<form method="get" action="/search">` with no bound action.',
  },
  {
    name: 'no-foreign-framework-import',
    description:
      'Flags an import of `next` / `next/*`, `react` / `react-dom`, `lit` / `lit-html` / `lit-element` / `lit/*`, `@lit/*` or `@lit-labs/*`, in any form (named, default, namespace, `import type`, side-effect, `export ... from`, or a string-literal dynamic `import()`). WebJs never aliases or loads those packages: a Next import fails to resolve, and a Lit import quietly loads a second component runtime from the CDN. The violation names the exact `@webjsdev/*` replacement (for example `next/navigation` -> `redirect` / `notFound` from `@webjsdev/core`, `lit` -> `WebComponent` / `html` / `css` from `@webjsdev/core`, `@lit/context` -> `@webjsdev/core/context`). `react` / `react-dom` stay allowed inside a `*.server.*` module (an email renderer, say), which never reaches the browser. The same refusal runs at load time: the dev overlay and production readiness name the import, and a server import is rewritten to the same fix.',
  },
  {
    name: 'no-jsx-attributes',
    description:
      'Flags JSX written into an `html` template: a `className=` or `htmlFor=` attribute (HTML reads them as unknown `classname` / `htmlfor` attributes, so the class never applies and the label never targets its control) and a capitalised component tag such as `<Link>` or `<Button>` (HTML lowercases it into an unknown element that renders nothing). Both renderers throw on these when the template first compiles; the rule reports them ahead of time. Write `class=` / `for=`, and render a custom element by its registered hyphenated tag (or a plain `<a href>` for a link). Text in the template (`&lt;Link&gt;`, a `className` mentioned in prose), comments, and script / style bodies are never flagged.',
  },
  {
    name: 'no-jsx-route-file',
    description:
      'Flags a routing file (`page`, `layout`, `route`, a boundary such as `error` / `not-found` / `loading`, `middleware`, or a metadata route) written as `.tsx` or `.jsx`, the Next.js default. WebJs has no build step, so JSX never loads and the router skips the file: the route silently does not exist. Production refuses to boot on it, dev answers every request with the problem, and `webjs doctor` fails (`JSX_ROUTE_FILES`). Rename it to `.ts` / `.js` and return an `html` template.',
  },
  {
    name: 'no-css-import',
    description:
      'Flags `import \'./styles.css\'` (or any `.css` import, including `import styles from \'./x.module.css\'`). Importing CSS is a bundler feature WebJs does not have: Node refuses the `.css` extension, Bun silently turns the import into a no-op on the server, and the browser refuses a stylesheet as a module script, so the importing module never loads. The same refusal runs at load time. Load a stylesheet with `<link rel="stylesheet" href="...">` in the root layout (the scaffold links its Tailwind output this way), or scope CSS to a component with `static styles = css` and `static shadow = true`.',
  },
  {
    name: 'no-public-route-conflict',
    description:
      'Files in `public/` are served at the URL ROOT, as in Next.js (`public/logo.png` is `/logo.png`; there is no `/public/` prefix), and before every route, so a public file wins over a dynamic route. A public file at the same URL as a static page, a `route.{js,ts}` handler, or a metadata route (`public/robots.txt` beside `app/robots.ts`) would make one of them unreachable, so it is flagged here and refused at production boot. Rename or move one side.',
  },
  {
    name: 'no-page-route-conflict',
    description:
      'A `page.{js,ts}` and a `route.{js,ts}` must not answer the same URL (including through a route group, `app/(a)/x/page.ts` beside `app/x/route.ts`). Next.js refuses this at build time; WebJs refuses to boot in production and answers every dev request with the problem, because the route handler would shadow the page and it could never render. Move the route handler to its own folder (`app/api/...`) or delete the page.',
  },
  {
    name: 'no-interpolation-in-raw-text-element',
    description:
      'Flags a template interpolation (`${...}`) placed as a child of a `<style>` or `<script>` element inside a COMPONENT `html` template. Raw-text elements are an SSR/client asymmetry trap: the server renderer emits the interpolated content, but the client renderer drops it (a raw-text hole is a `noop`, since the compile cache is keyed on the static strings), so the element renders correctly on the server and then wipes to empty on hydration. Scoped to components (files with a `WebComponent` class), which hydrate; pages and layouts render server-only and never hydrate, so a page interpolating a `css` result into a `<style>` is a legitimate pattern and is not flagged. In a component, author scoped CSS with `static styles` (shadow DOM) or a `css` template. Found dogfooding a tic-tac-toe app (#845): a `<style>${STYLE}</style>` painted at SSR then vanished on hydrate.',
  },
  {
    name: 'no-missing-local-import',
    description:
      'Flags a NAMED value import of a symbol that a resolvable app-internal module does not export (`import { todos } from \'#db/schema.server.ts\'` when the schema no longer exports `todos`). The binding is `undefined` at runtime and crashes on first use, yet the rest of `webjs check` (elision-based, it does not compile types) misses it, so a schema swap that orphans a gallery module can pass `check` while `typecheck` is red. This is the runtime-crash class `check` exists to catch, filling that gap so an agent running only `check` cannot ship a broken import. Deliberately conservative to never false-positive on a valid app: it only inspects app-internal specifiers (a relative `./` path or a `#` alias) that resolve to a file in the app, only NAMED value imports (a `type` import, a default import, a namespace import, and any bare / `node:` / npm-package specifier are skipped), and it treats a module as UNKNOWABLE (never flags imports from it) when its exports are not fully enumerable: a `export * from ...` star re-export, a destructuring `export const { a } = ...`, or a multi-declarator `export const a = .., b = ..`. It reads names from `export function/class/const/let/var/type/interface/enum` and from `export { a, b as c }` / `export { x } from ...` clauses (the alias after `as` is the exported name). A re-export barrel therefore resolves correctly, and a `\'use server\'` action file exports its function names normally. Found dogfooding a tic-tac-toe app: dropping the example `todos` table left a gallery module importing it, green under `check` but red under `typecheck`.',
  },
  {
    name: 'static-styles-need-shadow',
    description:
      'Flags a class extending `WebComponent` that declares `static styles` without `static shadow = true`. WebJs adopts `static styles` into a SHADOW root, and a component renders into light DOM unless it opts into shadow DOM (the reverse of Lit\'s default), so the styles are never applied. Fix: add `static shadow = true` to scope them, or drop `static styles` and style the light DOM with Tailwind utilities or a global stylesheet whose class selectors are prefixed with the tag name. A `static shadow` the rule cannot evaluate (a getter or an expression) is not flagged.',
  },
  {
    name: 'shadow-options-need-shadow',
    description:
      'Flags a class extending `WebComponent` that declares `static shadowRootOptions` (Lit\'s `{ mode, delegatesFocus, ... }` for `attachShadow`) without `static shadow = true`. The options configure a shadow root, and the component has none: it renders into light DOM by default, so they are ignored. Fix: add `static shadow = true`, or remove the options.',
  },
  {
    name: 'core-imports-exist',
    description:
      'Flags a named value import from `@webjsdev/core` (or one of its subpaths) of a name that module does not export, a default import from a module with no default export, and an import from a subpath core does not export. Each is a load-time crash: ESM refuses to link the module with `does not provide an export named X`, which names neither the cause nor the fix. Lit habits produce it: `LitElement` (use `WebComponent`), a decorator function such as `customElement` or `property` (use `MyEl.register(tag)` and `static properties`), or a type such as `PropertyValues` or `TemplateResult` imported as a value (use `import type`, since the type stripper keeps a plain import). The rule reads the INSTALLED core package\'s real export surface (each `exports` subpath\'s source module for values, its declaration file for types), so a name core gains is accepted as soon as it ships, and a name exported by a different subpath is pointed there. `import type` imports and `type`-qualified names are skipped, since they are erased before load.',
  },
];

/** Set of all known rule names for fast lookup. */
export const RULE_NAMES = new Set(RULES.map((r) => r.name));
