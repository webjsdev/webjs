/**
 * Compile-time type fixture: the generic path + the backward-compatible default
 * for `auth()` (#451). This file does NOT augment `AuthUser`, so it also pins
 * that un-augmented code keeps compiling exactly as before #451.
 *
 * NOT executed by node:test directly. The runner `type-fixtures.test.mjs`
 * compiles each `*.test-d.ts` in its OWN `tsc --noEmit` process. Each
 * `// @ts-expect-error` is a self-checking counterfactual.
 */

import { createAuth } from '@webjsdev/server';
import type { AuthInstance } from '@webjsdev/server';

// ---------------------------------------------------------------------------
// Backward-compatible default: with no augmentation and no generic, `user` is
// still the open `Record<string, unknown>`, so pre-#451 code that reads ad-hoc
// fields keeps compiling with no change.
// ---------------------------------------------------------------------------

const { auth } = createAuth({ secret: 's', providers: [] });

async function untypedDefault() {
  const session = await auth();
  if (!session) return;
  // Any field is readable as `unknown` (the pre-#451 behaviour). A cast is
  // still how you narrow it; nothing here is a compile error.
  const id = session.user.id as string;
  const anything: unknown = session.user.whateverField;
  void id;
  void anything;
}

// ---------------------------------------------------------------------------
// Generic / per-instance path: `createAuth<TUser>()` types just this instance's
// `auth()` without touching the global `AuthUser`.
// ---------------------------------------------------------------------------

interface AppUser {
  id: string;
  role: 'admin' | 'member';
}

const app = createAuth<AppUser>({ secret: 's', providers: [] });
const _typed: AuthInstance<AppUser> = app;
void _typed;

async function parameterised() {
  const session = await app.auth();
  if (!session) return;

  // Declared fields are typed with NO cast.
  const id: string = session.user.id;
  const role: 'admin' | 'member' = session.user.role;
  void id;
  void role;

  // @ts-expect-error `role` is a union, not an arbitrary string.
  const bad: 'guest' = session.user.role;
  void bad;

  // @ts-expect-error a field the instance type does not declare is an error.
  void session.user.notOnAppUser;
}

void untypedDefault;
void parameterised;
