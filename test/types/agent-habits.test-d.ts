// Code typed the way agents write it (#1686): each block below is taken from a
// first draft that an eval build wrote and that failed `webjs typecheck` on a
// WebJs type, not on the agent's own logic. It must compile clean with no
// casts. The rule from now on: an eval typecheck failure caused by a framework
// type adds a block here, beside the fix that made it compile.
import { getRequest, getSession } from '@webjsdev/server';
import type { Session } from '@webjsdev/server';
import type { PageProps } from '@webjsdev/core';

// getSession() reads the request in scope, the way cookies() and headers() do.
// Agents also chained the two WebJs calls, getSession(getRequest()), and
// getRequest() is nullable outside a request, so the parameter accepts it.
// (Replay r3-before-pollster2: a page and two actions.)
export function sessionHabits(): Session[] {
  const a = getSession();
  const b = getSession(getRequest());
  a.flash('manage', { slug: 'x', key: 'k' });
  return [a, b];
}

// actionData.fieldErrors read into the agent's own Record<string, string>: the
// page cannot see the action's return type, so the field is as loose as data.
// (Replay r4-after-roomly2: two pages.)
export function fieldErrorHabits({ actionData }: PageProps<'/rooms/[id]'>): string {
  const errors: Record<string, string> = actionData?.fieldErrors ?? {};
  const values = actionData?.values ?? {};
  return (errors.day ?? '') + (values.day ?? '');
}
