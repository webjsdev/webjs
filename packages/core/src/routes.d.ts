/**
 * TypeScript overlay for typed page / layout / route-handler props plus an
 * opt-in, generated route union that types `navigate()` and catches bad
 * hrefs at tsserver time (#258).
 *
 * webjs identity holds: NO build step, NO runtime cost, types-only, opt-in
 * for JSDoc apps. The mechanism mirrors Next 15's `typedRoutes` but via
 * interface declaration-merging instead of a bundler.
 *
 *     import type { PageProps, LayoutProps } from '@webjsdev/core';
 *     export default function Post({ params }: PageProps<'/blog/[slug]'>) { … }
 *
 * Two augmentation targets, `WebjsRoutes` and `RouteParamMap`, are EMPTY by
 * default, so an un-generated app sees `Route = string` and `params =
 * Record<string, string>` (non-breaking). Running `webjs types` writes
 * `.webjs/routes.d.ts`, which augments both with one key per route literal,
 * narrowing `Route` to the concrete app routes and giving every page typed
 * `params`.
 *
 * The shapes mirror what packages/server/src/ssr.js actually constructs for
 * the page / layout context and what packages/server/src/api.js passes a
 * route handler, NOT a guess. Zero runtime cost: nothing here ships to the
 * browser.
 */

import type { TemplateResult } from './html.js';

/**
 * The augmentation target the generated `.webjs/routes.d.ts` fills with one
 * key per route literal (e.g. `'/blog/[slug]': true`). Empty by default so an
 * un-generated app keeps `Route = string`. App code (or the generator)
 * augments it via `declare module '@webjsdev/core'`.
 */
export interface WebjsRoutes {}

/**
 * The augmentation target mapping a dynamic route key to its params object
 * (`'/blog/[slug]': { slug: string }`). Emitted by the generator with the
 * exact `string` / `string[]` / optional shapes known at generation time,
 * which is far more robust than deep template-literal inference. Empty by
 * default; a static route is never given an entry here, so its params fall
 * through to `Record<string, string>` (the runtime default), not `{}`.
 */
export interface RouteParamMap {}

/** True once either augmentation target carries at least one key. */
type _HasRoutes = keyof WebjsRoutes extends never ? false : true;

/**
 * Turn a route key into the set of concrete path patterns it matches by
 * replacing each dynamic segment with `${string}`. The optional catch-all
 * `[[...x]]` is handled by the GENERATOR, which emits BOTH the with-segment
 * and without-segment keys as separate `WebjsRoutes` entries (so `/docs` and
 * `/docs/a/b` both satisfy a `/docs/[[...slug]]` route). Keeping that collapse
 * in the generator (not in pure types) avoids the fragile `//`-collapse, so
 * `RoutePattern` only ever needs the single-segment `[x]` and catch-all
 * `[...x]` cases.
 */
type RoutePattern<K extends string> =
  K extends `${infer A}[...${string}]${infer B}`
    ? `${A}${string}${RoutePattern<B>}`
    : K extends `${infer A}[${string}]${infer B}`
      ? `${A}${string}${RoutePattern<B>}`
      : K;

/**
 * The valid-href type. `string` when no routes are generated (so `navigate()`
 * and JSDoc apps are never broken); once `WebjsRoutes` is augmented it is the
 * union of every static route literal PLUS a template-literal pattern per
 * dynamic route.
 */
export type Route = _HasRoutes extends true
  ? { [K in keyof WebjsRoutes]: RoutePattern<K & string> }[keyof WebjsRoutes]
  : string;

/**
 * The params object for a route key. A generated dynamic route resolves to
 * its `RouteParamMap` entry (`{ slug: string }`, `{ rest: string[] }`,
 * `{ slug?: string[] }`); anything else (a static route, or any route in an
 * un-generated app) resolves to `Record<string, string>`, the runtime
 * default the SSR pipeline produces.
 */
export type RouteParams<R extends string> = R extends keyof RouteParamMap
  ? RouteParamMap[R]
  : Record<string, string>;

/**
 * A value that is BOTH synchronously usable as `T` and `await`-able to `T`
 * (#848). The webjs runtime hands `params` / `searchParams` as a plain object
 * carrying a non-enumerable `then`, so `params.id` and `await params` both
 * work; this type expresses that dual nature to TypeScript.
 */
export type Awaitable<T> = T & PromiseLike<T>;

/**
 * The argument a page default-export receives. Mirrors the `ctx` object
 * packages/server/src/ssr.js builds: `{ params, searchParams, url,
 * actionData }`.
 *
 * `searchParams` is typed `Record<string, string | string[]>` to match the
 * established page-context convention, even though the runtime builds it with
 * `Object.fromEntries(url.searchParams.entries())` (so a repeated key is
 * last-wins `string`, never an array). The wider type keeps a future
 * multi-value reader source-compatible.
 *
 * `params` / `searchParams` are `Awaitable<T>` (#848): synchronously readable
 * (`params.id`) AND `await`-able (`const { id } = await params`) for Next
 * 15/16 muscle-memory parity. The runtime object carries a non-enumerable
 * `then` (see packages/server/src/thenable-params.js), so a spread / JSON /
 * `Object.keys` sees only the data keys.
 */
export interface PageProps<R extends string = string> {
  /**
   * Path params. A generated dynamic route narrows this to its exact shape
   * (`{ slug: string }`); a static or un-generated route is
   * `Record<string, string>`. Sync-readable and `await`-able (#848).
   */
  params: Awaitable<R extends keyof RouteParamMap ? RouteParamMap[R] : Record<string, string>>;
  /** Query string, as an object. Repeated keys are last-wins at runtime. Sync-readable and `await`-able (#848). */
  searchParams: Awaitable<Record<string, string | string[]>>;
  /** The full request URL string. */
  url: string;
  /**
   * Present ONLY on the re-render after a failed page `action` submission
   * (#244). `undefined` on a normal GET render. Read `actionData.fieldErrors`
   * / `actionData.values` to surface validation errors and repopulate inputs.
   */
  actionData?: unknown;
}

/**
 * The argument a layout default-export receives: every `PageProps` field plus
 * the rendered `children`. Mirrors the `{ children, params, searchParams, url
 * }` object packages/server/src/ssr.js passes a layout.
 */
export interface LayoutProps<R extends string = string> extends PageProps<R> {
  /** The nested page / inner-layout content this layout must embed. */
  children: TemplateResult;
}

/**
 * The 2nd argument a `route.{js,ts}` `GET` / `POST` / … handler receives.
 * Mirrors what packages/server/src/api.js passes: `{ params }`. The params
 * are a plain `Record<string, string>` at the handler layer (the route table
 * decodes each captured segment to a string), with an optional `R` generic to
 * narrow them against a generated route the same way `PageProps` does.
 */
export interface RouteHandlerContext<R extends string = string> {
  /** Sync-readable and `await`-able (#848), same as `PageProps['params']`. */
  params: Awaitable<R extends keyof RouteParamMap ? RouteParamMap[R] : Record<string, string>>;
}
