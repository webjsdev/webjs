/**
 * Compile-time type tests for the navigation sentinels (#390). `notFound()`
 * and `redirect()` throw at runtime and are documented `@returns {never}`;
 * `packages/core/src/nav.d.ts` makes that explicit in the published type
 * surface so TypeScript treats them as control-flow terminators and narrows
 * values after a guarded call.
 *
 * Run by `test/types/type-fixtures.test.mjs` via `tsc --noEmit --strict`. Each
 * `// @ts-expect-error` is a self-checking counterfactual (tsc reports an
 * unused directive if the type ever widens to accept the bad usage).
 *
 * The narrowing blocks are the real assertion: they compile ONLY because the
 * sentinels return `never`. If either widened to `void`, the `return x` lines
 * would fail (`T | null` is not assignable to `T`), so a regression in
 * nav.d.ts turns these into hard tsc errors.
 */
import { notFound, redirect, isNotFound, isRedirect } from '@webjsdev/core';

// notFound() is a control-flow terminator: `null` is removed after the guard.
function requireValue(x: string | null): string {
  if (x === null) notFound();
  return x; // OK only because notFound(): never
}

// redirect() is a control-flow terminator too.
function requireNumber(x: number | undefined): number {
  if (x === undefined) redirect('/login');
  return x; // OK only because redirect(): never
}

// Explicit return-type checks (never is the bottom type).
const _n1: never = notFound();
const _n2: never = redirect('/x');
const _n3: never = redirect('/x', 308);
// The options form is accepted alongside the positional number (#452).
const _n4: never = redirect('/x', { status: 301 });

// The type guards report booleans.
const _b1: boolean = isNotFound(new Error());
const _b2: boolean = isRedirect({});

// redirect requires a url.
// @ts-expect-error redirect needs a string url argument
redirect();

// the status, when given, is a number.
// @ts-expect-error status is a number, not a string
redirect('/x', '308');

export { requireValue, requireNumber, _n1, _n2, _n3, _n4, _b1, _b2 };
