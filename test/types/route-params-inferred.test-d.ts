/**
 * Route params WITHOUT a generated `.webjs/routes.d.ts`: an app that never ran
 * `webjs types` (CI typechecking a fresh checkout, say) still gets the params
 * a route key declares, read from the key itself. A catch-all is a `string[]`
 * at runtime, as in Next.js, so typing it `string` sent `slug.join('/')` to a
 * type error only on a machine without the generated file. This fixture
 * augments nothing, unlike route-types.test-d.ts, and is compiled on its own.
 */
import type { PageProps, RouteHandlerContext, RouteParams } from '@webjsdev/core';

// A failed form action's result reaches the page as actionData. By default it
// reads as a form result with no cast, as an agent writes it.
function form({ actionData }: PageProps<'/projects/[id]'>) {
  const title: string | string[] | undefined = actionData?.fieldErrors?.title;
  const typed: string | undefined = actionData?.values?.title;
  // A success result carried across the redirect: its `data` and any other key
  // the action returned read with no cast (two round-3 builds hit
  // "Property 'manageKey' does not exist on type '{}'" here).
  const key: string | undefined = actionData?.data?.manageKey;
  const extra = actionData?.notice;
  return [title, typed, actionData?.error, key, extra];
}
void form;

// The second parameter names the action's exact result.
function exact({ actionData }: PageProps<'/x', { ok: false; reason: 'full' | 'closed' }>) {
  const reason: 'full' | 'closed' | undefined = actionData?.reason;
  // @ts-expect-error the exact type has no fieldErrors.
  actionData?.fieldErrors;
  return reason;
}
void exact;

function docs({ params }: PageProps<'/ui/docs/[...slug]'>) {
  const parts: string[] = params.slug;
  return parts.join('/');
}
void docs;

function optional({ params }: PageProps<'/help/[[...topic]]'>) {
  const topic: string[] | undefined = params.topic;
  return topic;
}
void optional;

function mixed({ params }: PageProps<'/[org]/[repo]/tree/[...path]'>) {
  const org: string = params.org;
  const repo: string = params.repo;
  const path: string[] = params.path;
  return [org, repo, ...path];
}
void mixed;

async function awaited({ params }: PageProps<'/files/[...rest]'>) {
  const { rest } = await params;
  const r: string[] = rest;
  return r;
}
void awaited;

function handler(_req: Request, { params }: RouteHandlerContext<'/api/items/[id]'>) {
  const id: string = params.id;
  return id;
}
void handler;

// A static route and the wide `string` key keep the runtime default.
const staticParams: RouteParams<'/about'> = { anything: 'x' };
const wideParams: RouteParams<string> = { anything: 'x' };
void staticParams; void wideParams;

function wrong({ params }: PageProps<'/ui/docs/[...slug]'>) {
  // @ts-expect-error a catch-all is a string[], not a string.
  const s: string = params.slug;
  return s;
}
void wrong;

function unknownKey({ params }: PageProps<'/blog/[slug]'>) {
  // @ts-expect-error /blog/[slug] declares only `slug`.
  return params.nope;
}
void unknownKey;
