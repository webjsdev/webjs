/**
 * TypeScript overlay for the `webjs` config block in a webjs app's
 * package.json.
 *
 *     // package.json is JSON, so author it there, but a typed reference
 *     // helps an agent or a human author the block correctly:
 *     import type { WebjsConfig } from '@webjsdev/core';
 *     const config: WebjsConfig = { trailingSlash: 'never', csp: true };
 *
 * The server reads this object key by key. Without a type or schema a
 * typo'd key (e.g. `redirect` for `redirects`) was silently dropped and
 * the feature stayed at its default with no diagnostic. This type plus
 * the published JSON Schema close that gap.
 *
 * LOCKSTEP: this file, the JSON Schema at
 * packages/server/webjs-config.schema.json, and the server reader
 * functions MUST stay in sync. The readers are: readElideEnabled
 * (dev.js, elide), compileHeaderRules (headers.js, headers),
 * compileRedirectRules / readTrailingSlashPolicy (redirects.js,
 * redirects / trailingSlash), readBasePath (base-path.js, basePath),
 * readCspConfig (csp.js, csp), and
 * readBodyLimits / computeServerTimeouts (body-limit.js, the byte caps
 * and timeouts). Adding a `webjs.*` key means updating all three places.
 * See packages/server/AGENTS.md for the one documented procedure.
 *
 * Every key is optional (the whole block is optional and every key has a
 * default). Zero runtime cost: nothing in this file ships to the browser.
 */

/** One header directive in a `webjs.headers` rule. */
export interface WebjsHeaderDirective {
  /** Header name, e.g. `X-Frame-Options`. */
  key: string;
  /**
   * Header value. A `null` or `false` value REMOVES the header on a
   * match, the escape hatch that drops a secure default on a path.
   * `true` is intentionally not allowed (the runtime would stringify it
   * to the literal `"true"`, which is never a useful header value).
   */
  value?: string | null | false;
}

/** One per-path response-header rule in `webjs.headers`. */
export interface WebjsHeaderRule {
  /**
   * Path pattern matched with the native URLPattern API, so `:param` and
   * `:rest*` syntax works.
   */
  source: string;
  /** Header directives applied on a match. */
  headers: WebjsHeaderDirective[];
}

/** One declarative redirect rule in `webjs.redirects`. */
export interface WebjsRedirectRule {
  /**
   * Path pattern matched with the native URLPattern API, so `:param` and
   * `:rest*` syntax works.
   */
  source: string;
  /**
   * Target path, a path referencing named groups captured by `source`,
   * or an absolute URL. The incoming query string is preserved and
   * merged onto the destination.
   */
  destination: string;
  /**
   * `true` (the default) is a 308 Permanent Redirect, `false` is a 307
   * Temporary Redirect. Both preserve the request method and body.
   * `statusCode` wins over this when set.
   */
  permanent?: boolean;
  /**
   * Explicit redirect status, for a tool needing a legacy code. Wins
   * over `permanent`. One of 301, 302, 303, 307, 308.
   */
  statusCode?: 301 | 302 | 303 | 307 | 308;
}

/** The trailing-slash canonicalization policy in `webjs.trailingSlash`. */
export type WebjsTrailingSlash = 'never' | 'always' | 'ignore';

/** Dev task orchestration in `webjs.dev` (#550). Read by the CLI, not the server. */
export interface WebjsDevTasks {
  /**
   * One-shot commands run sequentially to completion BEFORE the dev server
   * boots (the old `predev` hook: `webjs db migrate`, a registry copy). A
   * non-zero exit aborts the boot.
   */
  before?: string[];
  /**
   * Long-lived commands run as child processes ALONGSIDE the dev server (the
   * old `concurrently` watchers: the Tailwind CLI `--watch`). Spawned once in
   * the parent and torn down on exit, so a watcher cannot leak past the server.
   */
  parallel?: string[];
}

/** Start task orchestration in `webjs.start` (#550). Read by the CLI, not the server. */
export interface WebjsStartTasks {
  /**
   * One-shot commands run sequentially to completion BEFORE the prod server
   * boots (the old `prestart` hook: `webjs db migrate`). A non-zero exit
   * aborts the boot.
   */
  before?: string[];
}

/** The object form of `webjs.csp` (the non-boolean shape). */
export interface WebjsCspConfig {
  /**
   * Directive map merged over the strict defaults, e.g.
   * `{ 'connect-src': "'self' https://api.example.com" }`. A `null` /
   * `false` / `''` value drops a default directive. A `__NONCE__` token
   * in a value is replaced with the per-request nonce.
   */
  directives?: Record<string, string | null | boolean>;
  /**
   * `true` emits `Content-Security-Policy-Report-Only` instead of the
   * enforcing header (the staged-rollout path).
   */
  reportOnly?: boolean;
}

/**
 * The `webjs` object in a webjs app's package.json. Every key is
 * optional. Mirrors what the server readers actually consume, NOT a
 * Next.js superset.
 */
export interface WebjsConfig {
  /**
   * Display-only and inert-route dead-JS elision switch. Default `true`.
   * Set to `false` to ship every module's JS app-wide. The `WEBJS_ELIDE`
   * env override wins over this.
   */
  elide?: boolean;

  /**
   * SSR action-result seeding switch (#472). Default `true`. When on, a
   * `'use server'` action's SSR result is serialized into the page so an
   * `async render()` component does not re-fetch it over RPC on hydration. Set
   * to `false` to disable (the client re-fetches as before). The `WEBJS_SEED`
   * env override wins over this.
   */
  seed?: boolean;

  /**
   * Client-router switch (#629). Default `true`: the client router auto-enables
   * in the browser whenever `@webjsdev/core` loads, so any page that ships a
   * component gets SPA-style navigation with no import. Set to `false` to opt
   * the whole app out (pure MPA, full-page navigation; `disableClientRouter()`
   * stays the programmatic escape hatch).
   */
  clientRouter?: boolean;

  /**
   * Dev/start task orchestration (#550). `webjs dev` / `webjs start` run these
   * so a bare CLI invocation matches `npm run dev` / `start`. Read by the CLI
   * (`packages/cli/lib/app-tasks.js`), NOT the server readers.
   */
  dev?: WebjsDevTasks;
  start?: WebjsStartTasks;

  /** Per-path response-header rules, shaped like Next's. */
  headers?: WebjsHeaderRule[];

  /** Declarative permanent / temporary redirects for moved URLs. */
  redirects?: WebjsRedirectRule[];

  /**
   * Trailing-slash canonicalization policy. Default `'ignore'` (no-op).
   * `'never'` strips a trailing slash, `'always'` adds one (both via a
   * 308 redirect).
   */
  trailingSlash?: WebjsTrailingSlash;

  /**
   * Sub-path deployment prefix for an app mounted under
   * `example.com/app/` behind a proxy that does NOT strip the prefix.
   * `'app'`, `'/app'`, and `'/app/'` all normalize to `'/app'`; an empty
   * value (the default) is a root mount and a pure no-op. The prefix is
   * stripped from the incoming path at ingress and prepended to every
   * framework-emitted URL (importmap targets, modulepreload hints, boot
   * module specifiers, the dev reload src). Author-written `<a href>`
   * links and client-router navigation are NOT auto-prefixed (a
   * documented follow-up).
   */
  basePath?: string;

  /**
   * Content-Security-Policy config. Off by default. `true` enables a
   * strict nonce-based default policy. An object customizes directives
   * and report-only mode.
   */
  csp?: boolean | WebjsCspConfig;

  /**
   * JSON / RPC request body cap in bytes. Default 1048576 (1 MiB). `0`
   * disables the cap. The `WEBJS_MAX_BODY_BYTES` env override wins.
   */
  maxBodyBytes?: number;

  /**
   * Form / multipart request body cap in bytes. Default 10485760 (10
   * MiB). `0` disables the cap. The `WEBJS_MAX_MULTIPART_BYTES` env
   * override wins.
   */
  maxMultipartBytes?: number;

  /**
   * Max time in ms to receive the ENTIRE request (headers plus body).
   * Default 30000. `0` disables the timeout. The
   * `WEBJS_REQUEST_TIMEOUT_MS` env override wins.
   */
  requestTimeoutMs?: number;

  /**
   * Max time in ms to receive just the request headers. Default 20000.
   * Clamped strictly under `requestTimeoutMs` per node semantics. `0`
   * disables the timeout. The `WEBJS_HEADERS_TIMEOUT_MS` env override
   * wins.
   */
  headersTimeoutMs?: number;

  /**
   * Idle time in ms before a kept-alive socket is closed. Default 5000.
   * `0` disables the timeout. The `WEBJS_KEEP_ALIVE_TIMEOUT_MS` env
   * override wins.
   */
  keepAliveTimeoutMs?: number;
}
