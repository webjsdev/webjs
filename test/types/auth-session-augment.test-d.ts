/**
 * Compile-time type fixture: the module-augmentation path for `auth()` (#451).
 *
 * `auth()` used to resolve `{ user: Record<string, unknown> }`, so reading a
 * custom field the `session`/`jwt` callbacks set (e.g. `session.user.id`)
 * needed a cast and a typo slipped past tsc. Augmenting `AuthUser`
 * (NextAuth/Auth.js style) types every `auth()` call globally with no cast.
 *
 * NOT executed by node:test directly. The runner `type-fixtures.test.mjs`
 * compiles each `*.test-d.ts` in its OWN `tsc --noEmit` process, so the module
 * augmentation here is isolated to this file and cannot leak into the other
 * fixtures (the un-augmented default lives in `auth-session-default.test-d.ts`).
 * Each `// @ts-expect-error` is a self-checking counterfactual: tsc reports an
 * "unused @ts-expect-error" if the typed surface is removed, so the fixture
 * fails if `auth()` ever regresses to the loose `Record<string, unknown>`.
 */

import { createAuth } from '@webjsdev/server';

// Augmenting `AuthUser` types every `auth()` call, globally, with no generic.
declare module '@webjsdev/server' {
  interface AuthUser {
    id: string;
    username: string;
  }
}

const { auth } = createAuth({ secret: 's', providers: [] });

async function augmented() {
  const session = await auth();
  if (!session) return;

  // The augmented fields are typed with NO cast.
  const id: string = session.user.id;
  const username: string = session.user.username;
  void id;
  void username;

  // @ts-expect-error a misspelled field is a compile error now.
  void session.user.usrename;

  // @ts-expect-error the augmented field is `string`, not `number`.
  const wrong: number = session.user.id;
  void wrong;

  // @ts-expect-error an un-declared field is caught too (the augmented
  // interface is a closed shape, which is what makes typos fail).
  void session.user.someExtraField;
}

void augmented;
