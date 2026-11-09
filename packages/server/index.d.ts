/**
 * Public type surface for `@webjsdev/server`.
 *
 * The runtime is packages/server/index.js + src/*.js (JSDoc-annotated
 * JavaScript, no build step); this overlay exists so a TypeScript app under
 * `strict` + `nodenext`/`node16` resolves real types for the server import
 * instead of emitting TS7016 ("Could not find a declaration file for module
 * '@webjsdev/server'"). The whole package stays plain `.js` + JSDoc at runtime;
 * these declarations are types-only with zero runtime cost.
 *
 * House style follows packages/core/index.d.ts: `export type` for type-only
 * surface, `export declare function` / `export declare const` for runtime
 * values. Shapes the framework consumes from core (`Metadata`, `PageProps`,
 * `ActionResult`, …) are reused, never redefined; the high-traffic public API
 * is precisely typed from each source function's JSDoc; lower-traffic internals
 * (scanner / importmap / module-graph / vendor) get reasonable structural
 * declarations.
 *
 * The drift guard `packages/server/test/types/exports-drift.test.mjs` asserts the set of named
 * exports here exactly matches the runtime named exports of index.js, so a
 * future export added to index.js without a type is caught.
 */

import type { LayoutProps, PageProps, RouteHandlerContext } from '@webjsdev/core';

// The `./testing` subpath types are re-exported wholesale (the helpers ship
// from both the main entry and the subpath; this avoids duplicating them).
import type { Handle } from './src/testing.js';
export * from './src/testing.js';

// ---------------------------------------------------------------------------
// Shared local types
// ---------------------------------------------------------------------------

/** A webjs middleware: receives the request + a `next()` continuation. */
export type Middleware = (req: Request, next: () => Promise<Response>) => Promise<Response> | Response;
/**
 * The request an app's `middleware.ts` / `proxy.ts` (and a segment middleware)
 * receives: the platform `Request` plus Next's `request.cookies`, the same
 * store `cookies()` returns. Annotate with it where Next.js code writes
 * `NextRequest`.
 */
export type MiddlewareRequest = Request & { readonly cookies: RequestCookies };

// `Handle` is re-exported from ./src/testing.js (the `export *` above), so it
// is not re-declared here. It is IMPORTED as well, because `export *` re-exports
// a name without creating a local binding, so `RequestHandler.handle` below
// could not otherwise see it.

/**
 * The `ActionResult<T>` envelope a server action / page action returns.
 * Mirrors AGENTS.md's documented shape; `@webjsdev/core` does not export it,
 * so it is defined here (the one server-owned shared type).
 */
export type ActionResult<T = unknown> =
  | { success: true; data?: T; redirect?: string; message?: string }
  | {
      success: false;
      error?: string;
      /** Next.js's `{ errors }` spelling, read as a failure like `fieldErrors`. */
      errors?: Record<string, string | string[]>;
      message?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
      status?: number;
    };

/**
 * What a form-bound action receives: a real `FormData` (so `get`, `getAll` and
 * `instanceof FormData` work, as in Next) that also carries each field as a
 * property, so `input.title` reads it too. A `name[]` field arrives as an array
 * under `name`; a file input arrives as a `File`. Pass the field shape for
 * typed property reads.
 *
 * @example
 * 'use server';
 * import type { FormInput } from '@webjsdev/server';
 * export async function createTask(input: FormInput<{ title: string; tags: string[] }>) {
 *   const title = input.title.trim();          // or input.get('title')
 *   ...
 * }
 */
export type FormInput<Fields extends Record<string, unknown> = Record<string, string | string[] | File>> =
  FormData & Fields;

/** The pluggable cache store interface (`memoryStore` / `redisStore` / custom). */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Atomically increment a counter; returns the new value (TTL set on creation only). */
  increment(key: string, ttlMs?: number): Promise<number>;
  /**
   * OPTIONAL atomic set insert for the tag index (#752): add `member` to the set
   * at `key`, refreshing the key TTL. Eliminates the lost-update race of the
   * read-modify-write JSON path. A store omitting it falls back to that path.
   * Paired with `setMembers` (implement both or neither).
   */
  setAdd?(key: string, member: string, ttlMs?: number): Promise<void>;
  /** OPTIONAL set read, the counterpart of `setAdd` (empty array on a miss). */
  setMembers?(key: string): Promise<string[]>;
}

/** The pluggable logger interface. */
export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug?(msg: string, meta?: Record<string, unknown>): void;
}

/** The wire serializer used by the RPC transport. */
export interface Serializer {
  serialize(value: unknown): Promise<string> | string;
  deserialize(text: string): unknown;
}

/** Options shared by `createRequestHandler` and `startServer`. */
export interface RequestHandlerOptions {
  /** The app root directory (the dir containing `app/`). */
  appDir: string;
  /** Dev mode (live reload, TS strip, uncompressed bytes). */
  dev?: boolean;
  /** Pluggable logger; defaults to webjs's `defaultLogger`. */
  logger?: Logger;
  /**
   * APM / Sentry sink invoked on a caught unhandled error (#239). Best-effort:
   * a throw here is swallowed and never affects the response.
   */
  onError?: (
    error: unknown,
    ctx: { request: Request; requestId: string | null; phase: string },
  ) => void;
  /** Called when a dev source change has been applied (the live-reload trigger). */
  onReload?: () => void;
  /**
   * Dev error overlay sink (#264): called with a structured error frame when a
   * dev render crash, a non-erasable-TS strip failure, or a failed rebuild
   * occurs. `startServer` wires this to the SSE overlay channel. Dev-only and
   * best-effort; never fires in prod.
   */
  onDevError?: (frame: object) => void;
}

/** A matched page route for a path, as returned by `routeFor`. */
export interface RouteForResult {
  moduleUrls: string[];
}

/** The object `createRequestHandler` resolves to. */
export interface RequestHandler {
  /** The request -> response entry point for embedding under any host. */
  handle: Handle;
  /** Re-derive the route table / analysis after a source change (dev). */
  rebuild: () => Promise<void>;
  /** Resolve a pathname to its page-route module URLs (for 103 Early Hints), or null. */
  routeFor: (pathname: string) => RouteForResult | null;
  /** Proactively run the first-request analysis in the background. Idempotent, best-effort. */
  warmup: () => Promise<void>;
  /** Current route table getter (used by the WebSocket subsystem). */
  getRouteTable: () => unknown;
  /** Current unresolved dev error frame (#264), or null (always null in prod). */
  getLastDevError: () => object | null;
  /** The resolved app root. */
  appDir: string;
  /** Whether the handler is in dev mode. */
  dev: boolean;
  /** The active logger. */
  logger: Logger;
}

/** Options for `startServer` (a superset of `RequestHandlerOptions`). */
export interface StartServerOptions extends RequestHandlerOptions {
  /** Listen port (default 8080; `PORT` env honored by the CLI). */
  port?: number;
  /** Response compression (default: on in prod, off in dev). */
  compress?: boolean;
}

/** The object `startServer` resolves to. */
export interface ServerHandle {
  /** The underlying `node:http` server. */
  server: import('node:http').Server;
  /** Gracefully close the server (and abort the dev file watcher). */
  close: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Server entry: dev.js
// ---------------------------------------------------------------------------

/**
 * Create an embeddable request handler. Returns `{ handle, rebuild, routeFor,
 * warmup, getRouteTable, appDir, dev, logger }`. Throws at boot on an
 * unsupported Node version or a failed `env.{js,ts}` validation.
 */
export declare function createRequestHandler(opts: RequestHandlerOptions): Promise<RequestHandler>;

/** Start a webjs HTTP server (thin wrapper around `createRequestHandler`). */
export declare function startServer(opts: StartServerOptions): Promise<ServerHandle>;

// ---------------------------------------------------------------------------
// node-version.js (#238)
// ---------------------------------------------------------------------------

/** Parse a Node version string to its major integer. */
export declare function parseMajor(version: string): number;
/** Parse an `engines.node` range string to the minimum acceptable major. */
export declare function parseRequiredMajor(engines: string): number;
/** Pure comparison: is `current` at least `requiredMajor`? */
export declare function checkNodeVersion(
  current: string,
  requiredMajor: number,
): { ok: boolean; current: string; currentMajor: number; requiredMajor: number; message: string };
/** The minimum Node major, sourced from this package's `engines.node`. */
export declare function requiredNodeMajor(): number;
/** Throw or exit if the running Node is too old. */
export declare function assertNodeVersion(opts?: {
  current?: string;
  requiredMajor?: number;
  onFail?: 'exit' | 'throw';
}): void;

// ---------------------------------------------------------------------------
// env-schema.js (#236)
// ---------------------------------------------------------------------------

/** Pure env validator: check an env object against a schema or validator function. */
export declare function validateEnv(
  schema: object | ((env: Record<string, string | undefined>) => void),
  env: Record<string, string | undefined>,
): { ok: boolean; errors: string[]; coerced: Record<string, string> };
/** Compose the aggregated boot-failure message from a list of errors. */
export declare function formatEnvErrors(errors: string[]): string;
/** Read the optional app-root `env.{js,ts}` default export (null when absent). */
export declare function loadEnvSchema(
  appDir: string,
  opts?: { dev?: boolean },
): Promise<object | ((env: Record<string, string | undefined>) => void) | null>;
/** Side-effecting boot wrapper: validate `process.env`, write back coerced values, throw on failure. */
export declare function applyEnvValidation(
  appDir: string,
  opts?: { dev?: boolean; env?: Record<string, string | undefined> },
): Promise<void>;

// ---------------------------------------------------------------------------
// instrumentation.js (#848)
// ---------------------------------------------------------------------------

/**
 * Register an error sink from inside `instrumentation.register()`. Composes with
 * the `createRequestHandler({ onError })` option (both fire).
 */
export declare function setOnError(
  fn: (error: unknown, ctx?: { request?: Request; requestId?: string; phase?: string }) => void,
): void;
/** Run the app's boot-time `instrumentation.{js,ts}` hook once; returns any registered error sink. */
export declare function runInstrumentation(
  appDir: string,
  opts?: { dev?: boolean; logger?: { error?: (...a: unknown[]) => void } },
): Promise<{ onError: ((error: unknown, ctx?: unknown) => void) | null }>;

// ---------------------------------------------------------------------------
// router.js
// ---------------------------------------------------------------------------

/** Scan `app/` and build the route table. */
export declare function buildRouteTable(appDir: string): Promise<unknown>;
/** Match a pathname against the page routes in a table; null when no page matches. */
export declare function matchPage(
  table: unknown,
  pathname: string,
): { route: { file: string; layouts: string[] }; params: Record<string, string> } | null;
/** Match a pathname against the API (`route.{js,ts}`) routes in a table; null when none. */
export declare function matchApi(
  table: unknown,
  pathname: string,
): { route: { file: string }; params: Record<string, string> } | null;
/**
 * The URL paths of every STATIC page route in a route table, sorted and
 * deduped. Dynamic routes are excluded (listing one would mean inventing
 * param values).
 */
export declare function staticPageRoutes(table: {
  pages?: Array<{ routeDir?: string; paramNames?: string[] }>;
} | undefined): string[];

// ---------------------------------------------------------------------------
// route-types.js (#258)
// ---------------------------------------------------------------------------

/** Generate the augmentation `.d.ts` text for an app's routes (backs `webjs types`). */
export declare function generateRouteTypes(appDir: string): Promise<string>;

// ---------------------------------------------------------------------------
// ssr.js
// ---------------------------------------------------------------------------

/** Server-render a matched page route to a `Response`. */
export declare function ssrPage(
  route: unknown,
  params: Record<string, string>,
  url: string,
  opts?: Record<string, unknown>,
): Promise<Response>;
/** Server-render the nearest `not-found.{js,ts}` to a `Response`. */
export declare function ssrNotFound(notFoundFile: string, opts?: Record<string, unknown>): Promise<Response>;

// ---------------------------------------------------------------------------
// api.js
// ---------------------------------------------------------------------------

/** Dispatch a matched `route.{js,ts}` handler (GET/POST/...) to a `Response`. */
export declare function handleApi(
  route: unknown,
  params: Record<string, string>,
  webRequest: Request,
  dev: boolean,
): Promise<Response>;

// ---------------------------------------------------------------------------
// actions.js (server-action scanner + RPC endpoint)
// ---------------------------------------------------------------------------

/** Scan the app for `.server.{js,ts}` files and build the pure file -> hash RPC index. */
export declare function buildActionIndex(appDir: string, dev: boolean): Promise<unknown>;
/** Whether a file path is a `.server.{js,ts,mjs,mts}` server file. */
export declare function isServerFile(file: string): boolean;
/** SHA-256 hash of an action file's absolute path (the RPC endpoint addressing scheme). */
export declare function hashFile(file: string): Promise<string>;
/** Resolve a browser-visible URL path to its server module entry in the action index. */
export declare function resolveServerModule(idx: unknown, urlPath: string): unknown;
/** Produce the generated RPC / throw-at-load stub source for a server file. */
export declare function serveActionStub(idx: unknown, absFile: string): Promise<string>;
/** Invoke a server action over the RPC endpoint, returning the `Response`. */
export declare function invokeAction(
  idx: unknown,
  hash: string,
  fnName: string,
  req: Request,
  onError?: (error: unknown) => void,
): Promise<Response>;

// ---------------------------------------------------------------------------
// action-route.js
// ---------------------------------------------------------------------------

/**
 * Wrap a plain `'use server'` action as a `route.ts`-style REST handler (#488).
 * Merges query + route params + JSON body into one input object, runs the
 * optional boundary validator, and dispatches through the request abort signal
 * + the optional middleware chain. The always-works baseline is a hand-written
 * `route.ts` that imports and calls the action; this is the convenience.
 */
export declare function route<A, R>(
  action: (input: A, ctx: { req: Request; params: Record<string, string> }) => R | Promise<R>,
  opts?: { validate?: (input: any) => any; middleware?: Function[] },
): (req: Request, ctx?: { params?: Record<string, string> }) => Promise<Response>;

// ---------------------------------------------------------------------------
// importmap.js
// ---------------------------------------------------------------------------

/** Build the browser import map object (optionally content-hash-fingerprinted). */
export declare function buildImportMap(opts?: { fingerprint?: boolean }): unknown;
/** Render the `<script type="importmap">` tag (optionally CSP-nonced). */
export declare function importMapTag(opts?: { nonce?: string }): string;
/** Set the resolved vendor importmap entries (+ optional SRI integrity by URL). */
export declare function setVendorEntries(
  entries: Record<string, string>,
  integrity?: Record<string, string>,
): Promise<void>;

// ---------------------------------------------------------------------------
// vendor.js (the `webjs vendor` CLI surface)
// ---------------------------------------------------------------------------

/**
 * Bare-specifier npm imports an app could load in the browser, found by walking
 * the module graph from every browser-bound entry rather than by scanning the
 * directory. The result is a superset of what the running server serves.
 */
export declare function scanBareImports(dir: string): Promise<Set<string>>;
/** Extract the package name from an import specifier (`dayjs/plugin/utc` -> `dayjs`). */
export declare function extractPackageName(spec: string): string | null;
/** Resolve bare imports to CDN importmap entries. */
export declare function vendorImportMapEntries(
  bareImports: Set<string>,
  appDir: string,
): Promise<Record<string, string>>;
/** Resolve the app's vendor imports (pin file first, else live jspm). */
export declare function resolveVendorImports(
  appDir: string,
  getBareImports: () => Promise<Set<string>> | Set<string>,
): Promise<{ imports: Record<string, string>; integrity?: Record<string, string>; provider?: string } | null>;
/** Clear the per-process vendor + live-integrity caches (wired to the dev rebuild). */
export declare function clearVendorCache(): void;
/** Read a package's installed version from `node_modules`, or null. */
export declare function getPackageVersion(pkgName: string, appDir: string): string | null;
/** Read a package's installed `dependencies` + `peerDependencies` (hoist-aware), or null. */
export declare function getPackageManifest(
  pkgName: string,
  appDir: string,
): { dependencies: Record<string, string>; peerDependencies: Record<string, string> } | null;
/** Resolve a list of `pkg@version` installs to importmap entries via a provider. */
export declare function jspmGenerate(installs: string[], provider?: string): Promise<Record<string, string>>;
/** Pin every (or the named) bare imports to `.webjs/vendor/importmap.json`. */
export declare function pinAll(
  appDir: string,
  opts?: { download?: boolean; from?: string },
): Promise<unknown>;
/** Remove a package from the pin file. */
export declare function unpinPackage(
  appDir: string,
  pkg: string,
): Promise<{ removed: boolean; deletedFile?: string }>;
/** List the pinned packages. */
export declare function listPinned(
  appDir: string,
): Promise<Array<{ pkg: string; version: string; url: string; bytes?: number }>>;
/** Run npm security advisories against the pinned versions. */
export declare function auditPinned(appDir: string): Promise<unknown>;
/** List pinned packages that have a newer version available. */
export declare function findOutdated(appDir: string): Promise<unknown>;
/** Whether the app commits a `.webjs/vendor/importmap.json` pin file. */
export declare function hasVendorPin(appDir: string): boolean;
/** Re-pin every outdated package to its latest version. */
export declare function updatePinned(appDir: string, opts?: { from?: string }): Promise<unknown>;
/** Read + parse the committed pin file, or null when absent. */
export declare function readPinFile(
  appDir: string,
): Promise<{ imports: Record<string, string>; integrity?: Record<string, string>; provider?: string } | null>;
/**
 * Make the opt-in `webjs vendor pin` output committable. Heals an app's
 * `.gitignore` when a `.webjs` exclusion would swallow the pins, and is a
 * no-op when they are already committable. Called only from `vendor pin`.
 */
export declare function ensureVendorCommittable(
  appDir: string,
): Promise<{ ignored: boolean; patched: boolean; gitignorePath: string | null }>;
/** Serve a downloaded `/__webjs/vendor/*` bundle file (`--download` mode). */
export declare function serveDownloadedBundle(
  appDir: string,
  pathname: string,
): Promise<Response | null>;
/** The set of supported CDN providers. */
export declare const SUPPORTED_PROVIDERS: Set<string>;
/** Normalize / validate a provider name. */
export declare function normalizeProvider(name: string): string;
/**
 * Validate a produced importmap's pinned dependency graph for coherence
 * (issue #450). For each resolved package, checks that the version pinned for
 * every OTHER resolved package it depends on satisfies the declared range.
 * Pure in `(imports, getManifest)`, so the same dep set yields the same verdict
 * over a live importmap and a vendored one. Degrades to `unverified` when a
 * manifest is unavailable.
 */
export declare function checkImportmapCoherence(
  imports: Record<string, string>,
  opts: {
    getManifest: (
      pkg: string,
      version: string,
    ) =>
      | { dependencies?: Record<string, string>; peerDependencies?: Record<string, string> }
      | null
      | Promise<{ dependencies?: Record<string, string>; peerDependencies?: Record<string, string> } | null>;
  },
): Promise<{
  conflicts: Array<{
    pkg: string;
    version: string;
    dependsOn: string;
    kind: 'dependency' | 'peerDependency';
    requiredRange: string;
    pinnedVersion: string;
  }>;
  unverified: Array<{ pkg: string; reason: string }>;
  checked: number;
}>;
/** Extract `{ basePackage -> pinned version }` from an importmap's `imports` map. */
export declare function extractPinnedVersions(
  imports: Record<string, string>,
): Map<string, string>;
/**
 * Does `version` satisfy the npm `range`? Pragmatic, dependency-free. Returns
 * `null` for a range shape it cannot statically evaluate (the "could not
 * verify" signal).
 */
export declare function satisfiesSemverRange(
  version: string,
  range: string,
): boolean | null;

// ---------------------------------------------------------------------------
// module-graph.js
// ---------------------------------------------------------------------------

/** Build the app's static import dependency graph. */
export declare function buildModuleGraph(appDir: string): Promise<unknown>;
/** Compute the transitive dependency set of a set of entry files (stops at `.server.*`). */
export declare function transitiveDeps(
  graph: unknown,
  entryFiles: string[],
  appDir: string,
  skip?: Set<string>,
): string[];

// ---------------------------------------------------------------------------
// component-scanner.js
// ---------------------------------------------------------------------------

/** Scan the app for webjs component classes and their browser-visible URLs. */
export declare function scanComponents(
  appDir: string,
): Promise<Array<{ tag: string; className: string; moduleUrl: string; file: string }>>;
/** Register scanned components into the server-side registry. */
export declare function primeComponentRegistry(
  appDir: string,
  components?: Array<{ tag: string; className: string; moduleUrl: string; file: string }>,
): Promise<{ count: number }>;
/** Extract `{ className, tag }` pairs from a component module's source. */
export declare function extractComponents(src: string): Array<{ className: string; tag: string }>;
/**
 * Find ORPHAN component classes: a `class X extends WebComponent` that its own
 * file declares and NOTHING in the app registers with a LITERAL tag, either
 * because there is no registration call anywhere or because the tag is
 * computed. The registration cross-reference is app-wide, so a class a sibling
 * module registers is not an orphan. Neither is visible to the
 * scanner, so both always lose the tag-to-module registry entry, the boot import
 * and the preload hint; assume the element does not upgrade either.
 * This is about REGISTRATION, never about import reachability. The full
 * semantics, including the one case where a computed tag still upgrades, live
 * on `findOrphanComponents` in `src/component-scanner.js`.
 */
export declare function findOrphanComponents(
  appDir: string,
): Promise<Array<{ className: string; file: string }>>;

// ---------------------------------------------------------------------------
// route-report.js (#1686)
// ---------------------------------------------------------------------------

/**
 * One route module (page, layout or boundary). A route module never ships to
 * the browser; the boot imports `emits`, its component frontier, in its place.
 */
export interface RouteModuleRow {
  file: string;
  kind: 'page' | 'layout' | 'error' | 'loading' | 'not-found' | 'forbidden' | 'unauthorized' | 'global-not-found';
  /** The component modules the boot imports in this module's place (empty: zero JS). */
  emits: string[];
  /** Advisory notes on code that looks meant for the browser but runs only on the server. */
  hints: string[];
}

/** A `class X extends WebComponent` with no literal-tag registration. */
export interface OrphanRow {
  file: string;
  className: string;
}

export interface RouteReportSummary {
  routeModules: number;
  /** Route modules whose frontier is empty: the browser loads nothing for them. */
  zeroJs: number;
  /** Route modules whose frontier names at least one component. */
  carriers: number;
  orphans: number;
}

/** What each route costs the browser. Every path is app-relative; every array is sorted by `file`. */
export interface RouteReport {
  analysed: boolean;
  /** Why nothing was analysed, when `analysed` is false. */
  skipped: 'no-app' | 'unanalysable' | null;
  routeModules: RouteModuleRow[];
  orphans: OrphanRow[];
  summary: RouteReportSummary;
}

/**
 * Every route module with the components the boot loads in its place and any
 * hints about browser-looking code in it, plus every orphan component class.
 * Consumed by both `webjs doctor` route checks.
 */
export declare function analyzeRouteModules(appDir: string): Promise<RouteReport>;

// ---------------------------------------------------------------------------
// dev-regenerate.js (#967, #1672)
// ---------------------------------------------------------------------------

/**
 * Where a `webjs.dev.regenerate` output stands against the build record in
 * `.webjs/regenerate.json`: `fresh` (built by this rule's command from inputs
 * that have not changed since, and not rewritten since), `stale`, `missing`
 * (no output on disk), or `unrecorded` (an output no recorded build produced,
 * such as one compiled by hand).
 */
export type RegenerateState = 'fresh' | 'stale' | 'missing' | 'unrecorded';

/** One rule's outcome from `regenerateOutputs`. */
export type RegenerateResult = { output: string; state: RegenerateState; built: boolean } & (
  | { ok: true }
  | { ok: false; reason: 'failed' | 'no-output' }
);

/**
 * Build every `webjs.dev.regenerate` output that is not fresh, one at a time,
 * and record what each was built from (#1672). The engine behind
 * `webjs regenerate`, which an app runs in `dev.before` / `start.before` so a
 * build outside the dev server records freshness the way a dev request does.
 * A rule whose command fails, or exits 0 without writing its `output`, keeps
 * its previous output and is reported `ok: false`.
 */
export declare function regenerateOutputs(
  appDir: string,
  opts?: { force?: boolean; warn?: (message: string) => void },
): Promise<RegenerateResult[]>;

/**
 * Every `webjs.dev.regenerate` output's state against the build record,
 * building nothing. What `webjs doctor` reads, so it and the dev server share
 * one definition of fresh.
 */
export declare function regenerateStatus(
  appDir: string,
): Promise<Array<{ output: string; command: string; state: RegenerateState }>>;

// ---------------------------------------------------------------------------
// context.js (per-request context helpers)
// ---------------------------------------------------------------------------

/** Read-only headers for the in-flight request. Throws outside a request scope. */
export declare function headers(): Headers;
/** A cookie as read from the request. */
export interface RequestCookie { name: string; value: string }
/** A cookie to write (Next's `ResponseCookie`; `maxAge` in seconds, `path` defaults to `/`). */
export interface ResponseCookie {
  name: string;
  value: string;
  expires?: Date | number;
  maxAge?: number;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none' | 'Lax' | 'Strict' | 'None' | boolean;
  partitioned?: boolean;
  priority?: 'low' | 'medium' | 'high';
}
/** The request's cookie store (Next.js's `cookies()` shape). */
export interface RequestCookies {
  get(name: string | { name: string }): RequestCookie | undefined;
  getAll(name?: string | { name: string }): RequestCookie[];
  has(name: string): boolean;
  readonly size: number;
  set(name: string, value: string, options?: Omit<ResponseCookie, 'name' | 'value'>): RequestCookies;
  set(cookie: ResponseCookie): RequestCookies;
  delete(name: string | { name: string; path?: string; domain?: string }): RequestCookies;
  toString(): string;
  [Symbol.iterator](): IterableIterator<[string, RequestCookie]>;
}
/**
 * The in-flight request's cookies, Next.js's `cookies()`: `cookies().get('x')?.value`
 * reads, `set` / `delete` write a `Set-Cookie` onto this request's response. Also
 * awaitable (`(await cookies()).get('x')`). Throws outside a request scope.
 *
 * `get` returns a {@link RequestCookie} (`{ name, value }`) or `undefined`, as
 * in Next.js, never the bare string.
 *
 * @example
 * ```ts
 * import { cookies } from '@webjsdev/server';
 * const theme: string = cookies().get('theme')?.value ?? 'light';
 * cookies().set('theme', 'dark', { path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: true });
 * cookies().delete('theme');
 * ```
 */
export declare function cookies(): RequestCookies & Promise<RequestCookies>;
/** The raw `Request` for the in-flight scope, or null at module top-level. */
export declare function getRequest(): Request | null;
/** Run `fn` within a request scope. */
export declare function withRequest<T>(req: Request, fn: () => T): T;
/** The per-request CSP nonce (`''` when CSP is off). */
export declare function cspNonce(): string;
/** The per-request correlation id, or null outside a request scope. */
export declare function requestId(): string | null;

// ---------------------------------------------------------------------------
// logger.js
// ---------------------------------------------------------------------------

/** The default logger (JSON-shaped in prod, pretty in dev). */
export declare function defaultLogger(opts?: { dev?: boolean }): Logger;

// ---------------------------------------------------------------------------
// rate-limit.js
// ---------------------------------------------------------------------------

/** Build a rate-limit middleware `(req, next) => Response`. */
export declare function rateLimit(opts?: {
  window?: number | string;
  max?: number;
  key?: string | ((req: Request) => string | Promise<string>);
  message?: string;
  store?: CacheStore;
  /**
   * Bucket on the forwarded-IP headers (`X-Forwarded-For`, `CF-Connecting-IP`,
   * `X-Real-IP`) instead of the framework-stamped peer. Inert while
   * `WEBJS_NO_TRUST_PROXY=1` is set: that env switch is the operator's
   * statement about the topology and it outranks this option, so the limiter
   * falls back to the stamped peer and logs once. Only safe behind a proxy
   * that STRIPS inbound `X-Forwarded-For` before adding its own.
   */
  trustProxy?: boolean;
  /**
   * Name the ONE forwarded header that carries the visitor, e.g.
   * `'cf-connecting-ip'` behind Cloudflare. Requires `trustProxy: true`, and
   * when set it is the only wire header consulted (falling back to the stamped
   * peer, then `_anon_`).
   *
   * Behind a CDN this is usually required for the limiter to work at all. The
   * default chain takes the leftmost `X-Forwarded-For` entry, which behind
   * Cloudflare is Cloudflare's EGRESS address, not the visitor, and since that
   * is pinned per connection the limiter hands out one bucket per connection.
   * The framework will not prefer `CF-Connecting-IP` on its own: Cloudflare
   * overwrites it, so it is unforgeable behind Cloudflare and forgeable
   * anywhere else, which makes the right choice a property of your topology.
   */
  clientIpHeader?: string;
}): Middleware;
/** Parse a window string (`'1m'`, `'30s'`) to milliseconds. */
export declare function parseWindow(w: number | string): number;
/**
 * Resolve the client IP for a request (honoring proxy-trust posture).
 *
 * Defaults to the framework-stamped peer, or `_anon_` when there is none.
 * `trustProxy: true` reads the forwarded-IP headers instead, UNLESS
 * `WEBJS_NO_TRUST_PROXY=1` is set, which overrides the option back to the
 * stamped peer and logs once per process.
 *
 * `header` names the one forwarded header to trust (`'cf-connecting-ip'`
 * behind Cloudflare) and, when given, is the only wire header read. Use it
 * whenever a CDN sits in front: the default chain's leftmost
 * `X-Forwarded-For` entry is then the CDN's egress address rather than the
 * visitor.
 */
export declare function clientIp(
  req: Request,
  opts?: { trustProxy?: boolean; header?: string },
): string;
/** Stamp the socket remote address onto a request for `clientIp` to read. */
export declare function stampRemoteIp(req: Request, remoteAddress: string): void;

// ---------------------------------------------------------------------------
// cors.js
// ---------------------------------------------------------------------------

/** A single CORS origin rule. */
export type CorsOriginRule = string | RegExp | ((origin: string) => boolean);

/** Options for the `cors()` middleware factory. */
export interface CorsOptions {
  origin?: '*' | true | CorsOriginRule | CorsOriginRule[];
  credentials?: boolean;
  methods?: string[] | string;
  allowedHeaders?: string[] | string;
  exposedHeaders?: string[] | string;
  maxAge?: number;
}

/** Build a CORS middleware `(req, next) => Response`. */
export declare function cors(options?: CorsOptions): Middleware;
/** Resolve the allowed origin for a request given a policy (shared CORS core). */
export declare function resolveOrigin(
  policy: CorsOptions['origin'],
  origin: string | null,
  credentials: boolean,
): { value: string | null; dynamic: boolean };
/** Apply the resolved CORS headers to a `Headers` object. */
export declare function applyCorsHeaders(
  headers: Headers,
  resolved: { value: string | null; dynamic: boolean },
  cfg: CorsOptions,
): void;

// ---------------------------------------------------------------------------
// cache.js (pluggable store) + cache-fn.js (query caching)
// ---------------------------------------------------------------------------

/** In-memory LRU cache store (single-process). */
export declare function memoryStore(opts?: { maxSize?: number }): CacheStore;
/** Redis-backed cache store. */
export declare function redisStore(opts?: { url?: string }): CacheStore;
/** Get the default cache store (memory unless `setStore` was called). */
export declare function getStore(): CacheStore;
/** Set the default cache store (call at startup to switch to Redis). */
export declare function setStore(store: CacheStore): void;

/**
 * Wrap an async function with TTL caching. Preserves the wrapped signature and
 * adds an `invalidate()` member. `tags` (static `string[]` or a per-arg
 * `(...args) => string[]`) enable `revalidateTag` cross-module eviction.
 */
export declare function cache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  opts: {
    key: string;
    ttl?: number;
    tags?: string[] | ((...args: Parameters<T>) => string[]);
  },
): T & { invalidate: () => Promise<void> };

// ---------------------------------------------------------------------------
// cache-tags.js (#242) + html-cache.js (#241): server cache invalidation
// ---------------------------------------------------------------------------

/**
 * Evict every `cache()` entry tagged with `tag`. Takes Next.js 16's second
 * argument, `revalidateTag(tag, 'max')` (a cache-life profile, or
 * `{ expire }`), for source compatibility: WebJs evicts at once whatever the
 * profile, since `cache()` has no stale-while-revalidate window to honour.
 */
export declare function revalidateTag(tag: string, profile?: string | { expire?: number }): Promise<void>;
/** Evict every `cache()` entry tagged with any of `tags`. */
export declare function revalidateTags(tags: string[]): Promise<void>;
/**
 * Evict the cached HTML for a path (the next request re-renders).
 *
 * Keys carry the request origin, so a bare path resolves it from the calling
 * request, which is exact from a server action. Pass an absolute url
 * (`https://app.example/blog`) from a caller with no request in scope (a cron
 * job, a queue worker); a bare path there warns and evicts nothing. Under
 * `webjs.basePath` the absolute url is the PUBLIC one and its mount prefix is
 * stripped, so it evicts the entry the write actually stored.
 */
export declare function revalidatePath(path: string, type?: 'page' | 'layout'): Promise<void>;
/** Evict all cached HTML (per-process generation bump). */
export declare function revalidateAll(): Promise<void>;

// ---------------------------------------------------------------------------
// session.js
// ---------------------------------------------------------------------------

/** The session storage adapter interface. */
export interface SessionStorage {
  read(cookie: string): Promise<Session>;
  save(session: Session): Promise<string | null>;
}

/** A per-request session: a typed key/value bag with flash + destroy. */
export declare class Session {
  constructor(id: string | null, initial?: Record<string, unknown>);
  readonly id: string | null;
  readonly dirty: boolean;
  readonly destroyed: boolean;
  readonly deleteId: string | null;
  readonly data: { data: Record<string, unknown>; flash: Record<string, unknown> };
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  unset(key: string): void;
  /** Set a value that lasts until a `get()` reads it (Remix's flash); `has()` does not consume it. */
  flash(key: string, value: unknown): void;
  destroy(): void;
  /**
   * Give the session a new id, keeping its data. Call it after a login to
   * prevent session fixation; `deleteOld` also deletes the old id's stored data.
   */
  regenerateId(deleteOld?: boolean): void;
}

/**
 * Session middleware factory: a signed session cookie for apps that do not use
 * `createAuth`. It throws at import without `secret` or `SESSION_SECRET`.
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { session } from '@webjsdev/server';
 * export default session({ secret: process.env.SESSION_SECRET });
 *
 * // In a 'use server' action or a page:
 * import { getRequest, getSession } from '@webjsdev/server';
 * const s = getSession(getRequest()!);
 * s.regenerateId(true);       // after a login, against session fixation
 * s.set('userId', user.id);
 * const userId = s.get<string>('userId');
 * ```
 */
export declare function session(opts?: {
  storage?: SessionStorage;
  cookieName?: string;
  secret?: string;
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}): Middleware;
/** Cookie-backed session storage. */
export declare function cookieSessionStorage(): SessionStorage;
/** Store-backed session storage. */
export declare function storeSessionStorage(opts?: Record<string, unknown>): SessionStorage;
/** Alias of `cookieSessionStorage`. */
export declare const cookieSession: typeof cookieSessionStorage;
/** Alias of `storeSessionStorage`. */
export declare const storeSession: typeof storeSessionStorage;
/**
 * The session for the current request. With no argument it reads the request
 * in scope (as `cookies()` and `headers()` do); passing `getRequest()` also works.
 * Needs `session()` as root middleware; throws outside it.
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { session } from '@webjsdev/server';
 * export default session();             // SESSION_SECRET from .env
 *
 * // in a page, action or route handler
 * import { getSession } from '@webjsdev/server';
 * const s = getSession();
 * s.set('cart', [1, 2]);                // persists across requests
 * s.flash('notice', 'Saved');           // read once by the next request
 * const notice = s.get('notice');       // unknown; narrow it before use
 * ```
 */
export declare function getSession(req?: Request | null): Session;

// ---------------------------------------------------------------------------
// broadcast.js
// ---------------------------------------------------------------------------

/** Broadcast data to all WebSocket clients connected to a route path. */
export declare function broadcast(
  path: string,
  data: string | Uint8Array,
  opts?: { except?: unknown },
): void;

// ---------------------------------------------------------------------------
// file-storage.js (#247)
// ---------------------------------------------------------------------------

/**
 * A streaming handle returned by `FileStore.get` (body is a stream, never
 * buffered). The body is a web `ReadableStream`, so `new Response(file.body)`
 * serves it as is; an adapter whose SDK returns a Node stream converts it with
 * `Readable.toWeb`.
 */
export interface StoredObjectHandle {
  body: ReadableStream<Uint8Array>;
  size: number;
  contentType: string;
}

/** The result of `FileStore.put`. */
export interface PutResult {
  key: string;
  size: number;
  contentType: string;
}

/**
 * The pluggable file-storage interface. `diskStore` is the local-disk default;
 * an S3-compatible adapter is a drop-in (same web-standard object shapes).
 */
export interface FileStore {
  put(
    key: string,
    file: Blob | File | ReadableStream | Uint8Array,
    opts?: { contentType?: string },
  ): Promise<PutResult>;
  get(key: string): Promise<StoredObjectHandle | null>;
  delete(key: string): Promise<void>;
  url(key: string): string;
  has?(key: string): Promise<boolean>;
}

/** The default uploads directory (relative to cwd), gitignore-friendly. */
export declare const DEFAULT_UPLOAD_DIR: string;
/** Local-disk file store (the default adapter). Streams writes. */
export declare function diskStore(opts?: { dir?: string; baseUrl?: string }): FileStore;
/** Set the default file store (call at startup to use a custom dir or S3). */
export declare function setFileStore(store: FileStore): void;
/**
 * Get the default file store (`diskStore` under `<cwd>/.webjs/uploads` unless set).
 *
 * @example
 * ```ts
 * // In a 'use server' action bound to <form action=${save} enctype="multipart/form-data">
 * // with <input type="file" name="photo">: the field arrives as a File.
 * import { getFileStore, generateKey } from '@webjsdev/server';
 * const key = generateKey(input.photo.name);   // opaque, traversal-safe
 * await getFileStore().put(key, input.photo);  // streams to disk
 *
 * // app/uploads/[key]/route.ts serves it back:
 * export async function GET(_req: Request, { params }: { params: { key: string } }) {
 *   let file;
 *   try { file = await getFileStore().get(params.key); } catch { file = null; } // an unsafe key throws
 *   if (!file) return new Response('Not found', { status: 404 });
 *   return new Response(file.body, { headers: { 'content-type': file.contentType } });
 * }
 * ```
 */
export declare function getFileStore(): FileStore;
/** Generate a random, opaque, traversal-safe key, preserving a whitelisted extension. */
export declare function generateKey(filename?: string): string;
/** Validate a key and return the absolute path it resolves to (throws on traversal). */
export declare function assertSafeKey(dir: string, key: string): string;
/** Mint a signed, expiring URL for a stored object (HMAC-SHA256). */
export declare function signedUrl(
  key: string,
  opts: { secret: string; expiresIn?: number; base?: string },
): string;
/** Verify a signed URL (or parsed params); constant-time, checks expiry + tamper. */
export declare function verifySignedUrl(
  input: string | URL | URLSearchParams | { key?: string; exp?: string | number; sig?: string },
  secret: string,
): { valid: boolean; key: string | null; reason?: string };

// ---------------------------------------------------------------------------
// json.js
// ---------------------------------------------------------------------------

/** Content-negotiated JSON response (rich wire format when the client asks for it). */
export declare function json<T>(data: T, init?: ResponseInit): Promise<Response>;
/** Parse a request body (webjs rich format or plain JSON); enforces the body-size limit. */
export declare function readBody(req: Request): Promise<unknown>;

// ---------------------------------------------------------------------------
// sitemap.js (#276)
// ---------------------------------------------------------------------------

/** A `<urlset>` entry. */
export interface SitemapEntry {
  url: string;
  lastModified?: string | Date;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}
/** A `<sitemapindex>` child-sitemap entry. */
export interface SitemapIndexEntry {
  url: string;
  lastModified?: string | Date;
}
/** Serialize entries into a spec-valid `<urlset>` XML document. */
export declare function sitemap(entries: SitemapEntry[]): string;
/** Serialize child sitemaps into a `<sitemapindex>` XML document. */
export declare function sitemapIndex(sitemaps: SitemapIndexEntry[]): string;

/** One `User-agent` group of a robots.txt (Next's `MetadataRoute.Robots` rule). */
export interface RobotsRule {
  userAgent?: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
  crawlDelay?: number;
}
/** A robots.txt as data (Next's `MetadataRoute.Robots`). `app/robots.ts` may return it. */
export interface RobotsConfig {
  /** Defaults to allowing every crawler everywhere. */
  rules?: RobotsRule | RobotsRule[];
  sitemap?: string | string[];
  host?: string;
}
/** Serialize a robots config into robots.txt text. */
export declare function robots(config?: RobotsConfig): string;

/**
 * The argument every metadata route (`app/sitemap.ts`, `app/robots.ts`, the
 * image routes, ...) receives (#1564).
 */
export interface MetadataRouteContext {
  request: Request;
  url: URL;
  /** The public origin: `SITE_URL` when set, else the request origin. No trailing slash. */
  siteUrl: string;
  /**
   * Every public page as a sitemap entry: static pages, plus dynamic pages that
   * export `generateSitemapParams()`. Pages whose static metadata says
   * `robots: { index: false }` are left out.
   */
  pages(): Promise<SitemapEntry[]>;
}
/**
 * What `app/sitemap.ts` may return: an array of entries (urls may be paths,
 * resolved against `siteUrl`), an XML string, or a Response.
 */
export type SitemapRouteResult = SitemapEntry[] | string | Response;
/** What `app/robots.ts` may return: a config object, text, or a Response. */
export type RobotsRouteResult = RobotsConfig | string | Response;

// ---------------------------------------------------------------------------
// stream.js (#248): stream-action helpers (the `<webjs-stream>` HTML the
// client `renderStream` / element applies surgically)
// ---------------------------------------------------------------------------

/** The content type that negotiates and carries a stream-action response. */
export declare const STREAM_MIME: string;
/** Report whether a request opted into a stream-action response (its `Accept` carries the stream MIME). */
export declare function acceptsStream(req: Request | { headers?: Headers }): boolean;
/** The stream-action builder; each method returns one `<webjs-stream>` HTML string. */
export declare const stream: {
  append(target: string, content: string): string;
  prepend(target: string, content: string): string;
  before(target: string, content: string): string;
  after(target: string, content: string): string;
  replace(target: string, content: string): string;
  update(target: string, content: string): string;
  remove(target: string): string;
};
/** Wrap one or more stream-action strings in a `Response` carrying the stream content type. */
export declare function streamResponse(...parts: string[]): Response;

// ---------------------------------------------------------------------------
// websocket.js
// ---------------------------------------------------------------------------

/** Attach WebSocket upgrade handling to an HTTP server (invokes a `route.{js,ts}` `WS` export). */
export declare function attachWebSocket(server: import('node:http').Server, app: RequestHandler): void;

// ---------------------------------------------------------------------------
// serializer.js
// ---------------------------------------------------------------------------

/** Get the active RPC wire serializer. */
export declare function getSerializer(): Serializer;
/** Replace the RPC wire serializer. */
export declare function setSerializer(serializer: Serializer): void;
/** The default rich-type serializer. */
export declare const defaultSerializer: Serializer;

// ---------------------------------------------------------------------------
// auth.js (NextAuth-style)
// ---------------------------------------------------------------------------

/** A provider config produced by `Credentials` / `Google` / `GitHub`. */
export interface ProviderConfig {
  id: string;
  [key: string]: unknown;
}

/**
 * The augmentable session-user interface (#451), NextAuth/Auth.js style.
 *
 * It is EMPTY by default. An app declares the fields its `session`/`jwt`
 * callbacks set (e.g. crisp sets `session.user.id = token.uid`) by augmenting
 * it, which then types every `auth()` call globally with no cast and catches
 * typos:
 *
 * ```ts
 * declare module '@webjsdev/server' {
 *   interface AuthUser {
 *     id: string;
 *     username: string;
 *   }
 * }
 * ```
 *
 * Left un-augmented, `auth().user` falls back to `Record<string, unknown>` (see
 * {@link ResolvedAuthUser}), so every pre-#451 app that reads `user.<field>`
 * without declaring a shape keeps compiling unchanged. For per-instance typing
 * instead of a global augmentation, parameterise the factory:
 * `createAuth<MyUser>(...)`, whose `auth()` returns `{ user: MyUser }`.
 */
export interface AuthUser {}

/**
 * The resolved session-user shape used when `createAuth` is called WITHOUT an
 * explicit type argument: the augmented {@link AuthUser} when an app declared
 * one, else the open `Record<string, unknown>` (the pre-#451 default). The
 * `keyof` probe is how the un-augmented empty interface degrades to the loose
 * record so existing untyped code is unaffected, while an augmented interface
 * gives precise, typo-catching fields.
 */
export type ResolvedAuthUser = keyof AuthUser extends never
  ? Record<string, unknown>
  : AuthUser;

/** Auth configuration for `createAuth`. */
export interface AuthConfig {
  /** A provider config, or the provider function uncalled (`providers: [GitHub]`), as Auth.js accepts. */
  providers: Array<ProviderConfig | (() => ProviderConfig)>;
  session?: { strategy?: 'jwt' | 'database'; maxAge?: number };
  /** Signs the session. Defaults to `process.env.AUTH_SECRET`, as in Auth.js. */
  secret?: string | undefined;
  callbacks?: {
    session?: Function;
    jwt?: Function;
    /** Return true to allow, a url string to redirect there instead, anything else to deny (Auth.js's rule). */
    signIn?: Function;
    redirect?: Function;
    /** Run by `auth` as middleware: true continues, false redirects to sign in, a Response is sent as is. */
    authorized?: (params: { auth: { user: Record<string, unknown> } | null; request: Request }) => boolean | Response | Promise<boolean | Response>;
  };
  adapter?: { load?: Function; save?: Function; destroy?: Function };
  pages?: { signIn?: string; signOut?: string; error?: string };
}

/**
 * The auth system created by `createAuth`. `TUser` is the resolved session-user
 * shape; it defaults to {@link ResolvedAuthUser} (the augmented {@link AuthUser}
 * if an app declared one, else `Record<string, unknown>`) so a module
 * augmentation flows to every `auth()` call, and can be overridden per instance
 * via `createAuth<MyUser>(...)`.
 */
export interface AuthInstance<TUser = ResolvedAuthUser> {
  /**
   * Auth.js's `auth`, in its three shapes: `auth()` / `auth(req)` reads the
   * session; `export { auth as middleware }` runs as middleware (it sets
   * `req.auth` and applies `callbacks.authorized`); `auth((req) => ...)` wraps
   * a middleware whose `req.auth` holds the session.
   */
  auth: {
    (req?: Request | null): Promise<{ user: TUser } | null>;
    (req: Request, next: unknown): Promise<Response | undefined>;
    <R>(handler: (req: Request & { auth: { user: TUser } | null }, ...rest: any[]) => R): (req: Request, ...rest: any[]) => Promise<Response | Awaited<R>>;
  };
  /**
   * Auth.js v5's `signIn`. Inside a request (a server action, a route handler,
   * middleware) it sets the session cookie on the response and throws a
   * redirect, so `await signIn('credentials', formData)` in a form action signs
   * in and navigates; a credentials failure throws {@link CredentialsSignin}.
   * `{ redirect: false }` (in the options or, as Auth.js accepts it, in the
   * data) returns the target url instead of throwing. With no request in scope
   * it returns the Response the `/api/auth/*` routes send. The redirecting
   * form is typed `Promise<Response>`, so `return signIn(...)` fits an action
   * that returns `ActionResult | Response`.
   */
  signIn: {
    (
      provider: string,
      data: (FormData | Record<string, unknown>) | undefined,
      opts: { redirectTo?: string; redirect: false; req?: Request },
    ): Promise<string>;
    (
      provider: string,
      data: Record<string, unknown> & { redirect: false },
      opts?: { redirectTo?: string; req?: Request },
    ): Promise<string>;
    (
      provider: string,
      data?: FormData | Record<string, unknown>,
      opts?: { redirectTo?: string; redirect?: true; req?: Request },
    ): Promise<Response>;
  };
  /** Auth.js v5's `signOut`: clears the session and throws a redirect inside a request. */
  signOut: {
    (opts: { redirectTo?: string; redirect: false; req?: Request }): Promise<string>;
    (opts?: { redirectTo?: string; redirect?: true; req?: Request }): Promise<Response>;
  };
  handlers: { GET: (req: Request) => Promise<Response>; POST: (req: Request) => Promise<Response> };
}

/**
 * Create the auth system, Auth.js's API. `createAuth<MyUser>(...)` (or an
 * augmented {@link AuthUser}) types `auth().user` with no cast.
 *
 * @example
 * ```ts
 * // modules/auth/auth.server.ts
 * export const { auth, signIn, signOut, handlers } = createAuth({
 *   providers: [Credentials({
 *     async authorize(c: { email: string; password: string }) {
 *       const user = await findUserByEmail(c.email); // your own query
 *       if (!user || !(await verifyPassword(c.password, user.passwordHash))) return null;
 *       return { id: String(user.id), email: user.email };
 *     },
 *   })],
 *   pages: { error: '/login' }, // an uncaught failure lands on /login?error=CredentialsSignin
 * });
 * // app/api/auth/[...path]/route.ts: export const { GET, POST } = handlers;
 * // Read the user anywhere on the server: const session = await auth();
 *
 * // A 'use server' action bound as <form action=${logIn}>, as with Auth.js in Next:
 * export async function logIn(formData: FormData) {
 *   try {
 *     await signIn('credentials', formData, { redirectTo: '/dashboard' });
 *   } catch (error) {
 *     if (error instanceof AuthError) return { success: false, error: 'Wrong email or password.' };
 *     throw error; // the success redirect
 *   }
 * }
 * // Sign out the same way: await signOut({ redirectTo: '/' }).
 * ```
 */
export declare function createAuth<TUser = ResolvedAuthUser>(config: AuthConfig): AuthInstance<TUser>;
/** Auth.js's base error: `error instanceof AuthError` and `error.type` say why a sign-in failed. */
export declare class AuthError extends Error {
  type: string;
}
/** Thrown by `signIn('credentials', ...)` when `authorize` returns null. */
export declare class CredentialsSignin extends AuthError {
  type: 'CredentialsSignin';
  code: string;
}
/**
 * Options for the credentials provider, Auth.js's `Credentials`. `C` is the
 * shape of the submitted fields, inferred from `authorize`'s annotation
 * (`authorize(credentials: { email: string; password: string })`).
 */
export interface CredentialsOptions<C extends Record<string, unknown> = Record<string, unknown>> {
  /**
   * Check the submitted fields (the sign-in form's fields, or the object passed
   * to `signIn('credentials', data)`). Return the session user, or `null` to
   * refuse the sign-in.
   */
  authorize: (credentials: C) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
  [key: string]: unknown;
}
/** The credentials (email/password) provider, Auth.js's `Credentials`. */
export declare function Credentials<C extends Record<string, unknown> = Record<string, unknown>>(
  opts: CredentialsOptions<C>,
): ProviderConfig;
/** The Google OAuth provider. */
export declare function Google(opts?: Record<string, unknown>): ProviderConfig;
/** The GitHub OAuth provider. */
export declare function GitHub(opts?: Record<string, unknown>): ProviderConfig;

// ---------------------------------------------------------------------------
// Re-export the core prop / metadata types so a server consumer can reach them
// from one place (they are the shapes server functions construct / consume).
// ---------------------------------------------------------------------------

export type { LayoutProps, PageProps, RouteHandlerContext };

/** The current action request AbortSignal (#492), or a never-aborting signal outside an action. */
export declare function actionSignal(): AbortSignal;
/** Run a function with a request AbortSignal available to actionSignal() (#492). */
export declare function runWithActionSignal<T>(signal: AbortSignal | undefined, fn: () => T): T;

/** The accumulated per-action middleware context (#490), or {} outside an action. */
export declare function actionContext(): Record<string, unknown>;
