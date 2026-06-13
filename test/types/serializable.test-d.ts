/**
 * Compile-time type fixture for the serializability guard (#488).
 *
 * NOT executed by node:test directly. The runner `type-fixtures.test.mjs`
 * compiles it with `tsc --noEmit --strict`, so every `// @ts-expect-error` line
 * is a self-checking counterfactual: tsc reports an "unused @ts-expect-error" if
 * the type ever widens to accept a non-serializable value.
 */

import type {
  Serializable,
  SerializableActionFn,
  NonSerializable,
} from '@webjsdev/core';

// --- A fully serializable shape round-trips through Serializable<T> ---

type User = {
  id: number;
  name: string;
  created: Date;
  scores: number[];
  tags: Set<string>;
  meta: Map<string, number>;
  nested: { active: boolean; big: bigint };
};

// Serializable<User> === User (assignable both directions).
const toWire: Serializable<User> = {} as User;
const fromWire: User = {} as Serializable<User>;
void toWire;
void fromWire;

// The rich built-ins survive as themselves.
const d: Serializable<Date> = new Date();
const m: Serializable<Map<string, number>> = new Map();
const bytes: Serializable<Uint8Array> = new Uint8Array();
void d; void m; void bytes;

// --- A serializable action annotation preserves the call signature ---

const getUser: SerializableActionFn<(id: number) => Promise<User>> = async (id) => ({
  id,
  name: 'u' + id,
  created: new Date(),
  scores: [1, 2],
  tags: new Set<string>(),
  meta: new Map<string, number>(),
  nested: { active: true, big: 1n },
});
// The annotated action is still callable with its real argument types.
const p: Promise<User> = getUser(7);
void p;

// --- Negative: a METHOD on the result is not serializable ---

type WithMethod = { id: number; greet: () => string };
// @ts-expect-error a method-valued property cannot round-trip the RPC wire
const badResult: SerializableActionFn<() => Promise<WithMethod>> = async () => ({
  id: 1,
  greet: () => 'hi',
});
void badResult;

// --- Negative: a bare function return is not serializable ---

// @ts-expect-error a function return cannot round-trip the RPC wire
const badFnReturn: SerializableActionFn<() => Promise<() => void>> = async () => () => {};
void badFnReturn;

// --- Negative: passing a function ARGUMENT to a serializable action ---

const takesData: SerializableActionFn<(input: { n: number }) => Promise<number>> = async () => 1;
// @ts-expect-error a function is not assignable to the serializable arg position
takesData(() => {});
// A plain serializable arg is accepted.
const okCall: Promise<number> = takesData({ n: 5 });
void okCall;

// --- Negative: Serializable<T> brands a function field as NonSerializable ---

// The mapped field is the branded marker, never the original function type.
const brandedField: Serializable<WithMethod>['greet'] = {} as NonSerializable<'a function is not serializable over the webjs RPC wire'>;
void brandedField;
// @ts-expect-error a real function is not assignable to the branded field
const badField: Serializable<WithMethod> = { id: 1, greet: () => 'hi' };
void badField;
