import { cookies } from '@webjsdev/server';

/**
 * Server-only (no `'use server'`): the layout reads it during SSR. The cookie is
 * the whole fixture, since the layout's header depends on it and the form
 * actions below are what change it.
 */
export function signedIn(): boolean {
  return cookies().get('fixture_session') === '1';
}
