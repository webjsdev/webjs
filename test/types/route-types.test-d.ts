/**
 * Compile-time type tests for the typed route props + generated route union
 * (#258). Mirrors the #257 metadata harness: not executed by node:test, but
 * consumed by tsserver + `tsc --noEmit`. A valid usage must type-check clean;
 * every `// @ts-expect-error` line asserts a bad usage is REJECTED (tsc fails
 * with "unused @ts-expect-error" if the type ever widens to accept it, so the
 * fixture doubles as a counterfactual: widening a param type flips an expected
 * error into an unused-directive failure).
 *
 * This fixture LOCALLY augments `@webjsdev/core` (the same shape `webjs types`
 * generates into `.webjs/routes.d.ts`) so it exercises the NARROWED behavior.
 * The empty-state fallback (no augmentation -> `Route = string`, `params =
 * Record<string, string>`) is covered by the DEFAULT generic of `PageProps`:
 * `PageProps` with no `R` keeps `params: Record<string, string>`, asserted in
 * the `baseProps` block below, which is exactly what an un-generated app sees.
 *
 * To verify manually:
 *   npx -p typescript@5.6 tsc --noEmit --strict --target esnext \
 *     --moduleResolution bundler test/types/route-types.test-d.ts
 */

import type {
  Route,
  RouteParams,
  PageProps,
  LayoutProps,
  RouteHandlerContext,
} from '@webjsdev/core';
import { navigate } from '@webjsdev/core';

/* ---- The app-generated augmentation (what `webjs types` emits) ---- */

declare module '@webjsdev/core' {
  interface WebjsRoutes {
    '/': true;
    '/about': true;
    '/blog/[slug]': true;
    '/files/[...rest]': true;
    // The optional catch-all `/docs/[[...slug]]` emits TWO Route-union keys:
    // the without-segment `/docs` and the normalized with-segment
    // `/docs/[...slug]` (a plain catch-all the RoutePattern type expands
    // cleanly). The doubled `[[...slug]]` literal stays the RouteParamMap key.
    '/docs/[...slug]': true;
    '/docs': true;
  }
  interface RouteParamMap {
    '/blog/[slug]': { slug: string };
    '/files/[...rest]': { rest: string[] };
    '/docs/[[...slug]]': { slug?: string[] };
  }
}

/* ------------- Base (un-narrowed) PageProps params shape ------------- */

// With no `R`, params is the runtime default `Record<string, string>`. This is
// also the shape an UN-GENERATED app sees for every route (Route = string).
function baseProps(p: PageProps) {
  const v: string = p.params.anything; // Record<string,string> indexable
  const u: string = p.url;
  const sp = p.searchParams.tab; // string | string[]
  const ad: unknown = p.actionData;
  return { v, u, sp, ad };
}
void baseProps;

/* ------------- Narrowed params for a generated dynamic route ------------- */

function postPage({ params }: PageProps<'/blog/[slug]'>) {
  const slug: string = params.slug; // narrowed to { slug: string }
  return slug;
}
void postPage;

// @ts-expect-error `nope` is not a param of /blog/[slug] (only `slug`).
function postPageBad({ params }: PageProps<'/blog/[slug]'>) { return params.nope; }
void postPageBad;

// Catch-all `[...rest]` yields a string[].
function filesPage({ params }: PageProps<'/files/[...rest]'>) {
  const rest: string[] = params.rest;
  return rest.length;
}
void filesPage;

// Optional catch-all `[[...slug]]` yields an optional string[].
function docsPage({ params }: PageProps<'/docs/[[...slug]]'>) {
  const slug: string[] | undefined = params.slug;
  return slug?.length ?? 0;
}
void docsPage;

// A static route has no dynamic params. RouteParams falls through to the
// runtime default Record<string, string>, so a string-keyed object assigns.
type AboutParams = RouteParams<'/about'>;
const aboutParams: AboutParams = { anything: 'ok' };
void aboutParams;

type SlugParams = RouteParams<'/blog/[slug]'>;
const slugParams: SlugParams = { slug: 'hello' };
void slugParams;

// @ts-expect-error /blog/[slug] params require `slug: string`, not a number.
const slugParamsBad: SlugParams = { slug: 123 };
void slugParamsBad;

/* ------------- LayoutProps: PageProps + children ------------- */

function rootLayout({ children, params }: LayoutProps) {
  // children is a TemplateResult; params is the Record default here.
  void params.x;
  return children;
}
void rootLayout;

// @ts-expect-error a layout MUST receive `children`; omitting it is an error.
const layoutMissingChildren: LayoutProps = { params: {}, searchParams: {}, url: '/' };
void layoutMissingChildren;

/* ------------- RouteHandlerContext ------------- */

function handler(_req: Request, ctx: RouteHandlerContext) {
  const id: string = ctx.params.id;
  return id;
}
void handler;

/* ------------- navigate() typed against the Route union ------------- */

// A concrete static route is accepted.
navigate('/about');
// A dynamic route, matched via the template-literal pattern.
navigate('/blog/anything');
// The optional catch-all both with and without the segment.
navigate('/docs');
navigate('/docs/a/b');
// The replace option still works.
navigate('/about', { replace: true });

// @ts-expect-error /nonexistent-zzz is not a generated route (augmented state).
navigate('/nonexistent-zzz');

/* ------------- Route union membership ------------- */

const r1: Route = '/about';
const r2: Route = '/blog/123';
void r1;
void r2;

// @ts-expect-error a path outside the union is rejected once routes exist.
const rBad: Route = '/totally-made-up-zzz';
void rBad;

export {};
