/**
 * Compile-time serializability typing for server actions (#488).
 *
 * A `'use server'` action's arguments and result cross the RPC wire through the
 * WebJs serializer, which round-trips a SPECIFIC set of rich types (`Date`,
 * `Map`, `Set`, `BigInt`, `Error`, `RegExp`, `URL`, typed arrays, `ArrayBuffer`,
 * `Blob`, `File`, `FormData`, registered `Symbol`s, plain objects / arrays, and
 * cycles). It does NOT round-trip a FUNCTION or a class instance's METHODS: a
 * function silently vanishes from the wire, and a class instance arrives as a
 * plain object with its prototype (so its methods) gone. That is a runtime
 * surprise the author never asked for.
 *
 * `Serializable<T>` makes it a TYPE error instead. It maps a fully serializable
 * `T` to itself, and a `T` that carries a function (a method, a callback prop)
 * to a branded `NonSerializable<...>` marker, so assigning the offending value
 * fails to typecheck with a message that names the problem. `SerializableArgs`
 * / `SerializableResult` apply it across an action's parameter tuple and its
 * (possibly promised) return.
 *
 * This is OPT-IN by design: WebJs actions stay plain `export async function`s
 * with no wrapper (the framework rewrites the client import to an RPC stub at
 * runtime, it does not wrap the authored function). An author who wants the
 * guard annotates the action with `SerializableActionFn`, e.g.
 *
 *   import type { SerializableActionFn } from '@webjsdev/core';
 *   export const getUser: SerializableActionFn<(id: number) => Promise<User>> =
 *     async (id) => db.user.find(id);
 *
 * If `User` (or any arg) is not serializable, the annotation is a compile-time
 * error pointing at the offending member. Types only, erased at runtime, zero
 * cost.
 */

/** A branded marker a non-serializable position resolves to, so the error names it. */
export type NonSerializable<Reason extends string = 'this value is not serializable over the webjs RPC wire'> = {
  readonly __webjsNonSerializable: Reason;
};

/** Primitives the wire carries verbatim. */
type SerializablePrimitive = string | number | boolean | bigint | null | undefined;

/**
 * Built-in rich types the WebJs serializer round-trips as themselves (their
 * identity / methods survive because the serializer reconstructs the instance).
 * `Map` / `Set` recurse into their members via the top-level mapper.
 */
type SerializableBuiltin =
  | Date
  | RegExp
  | URL
  | Error
  | ArrayBuffer
  | Int8Array | Uint8Array | Uint8ClampedArray
  | Int16Array | Uint16Array
  | Int32Array | Uint32Array
  | Float32Array | Float64Array
  | BigInt64Array | BigUint64Array
  | Blob
  | File
  | FormData;

/**
 * Map `T` to itself when it is fully serializable, else to a `NonSerializable`
 * marker at the offending position. A function (a method or a callback-valued
 * property) is the canonical non-serializable case. Objects and arrays recurse;
 * `Map` / `Set` recurse into their type parameters.
 */
export type Serializable<T> =
  T extends SerializablePrimitive ? T :
  // A function never survives the wire (it just disappears).
  T extends (...args: any[]) => any ? NonSerializable<'a function is not serializable over the webjs RPC wire'> :
  T extends SerializableBuiltin ? T :
  T extends Map<infer K, infer V> ? Map<Serializable<K>, Serializable<V>> :
  T extends Set<infer U> ? Set<Serializable<U>> :
  T extends Promise<infer U> ? Promise<Serializable<U>> :
  T extends ReadonlyArray<infer U> ? (T extends Array<infer _W> ? Array<Serializable<U>> : ReadonlyArray<Serializable<U>>) :
  T extends object ? { [K in keyof T]: Serializable<T[K]> } :
  T;

/** Apply {@link Serializable} across an action's parameter tuple. */
export type SerializableArgs<A extends readonly unknown[]> = {
  [K in keyof A]: Serializable<A[K]>;
};

/**
 * Apply {@link Serializable} to an action's return, unwrapping a `Promise` so an
 * async action is checked against its resolved value (the wire carries the
 * resolved value, never the promise).
 */
export type SerializableResult<R> =
  R extends Promise<infer U> ? Promise<Serializable<U>> : Serializable<R>;

/**
 * The opt-in annotation type for a server action: it preserves the function's
 * exact call signature while constraining every argument and the result to be
 * serializable. A non-serializable arg or return makes the annotation a
 * compile-time error.
 *
 * @example
 *   export const getUser: SerializableActionFn<(id: number) => Promise<User>> =
 *     async (id) => db.user.find(id);
 */
export type SerializableActionFn<F extends (...args: any[]) => any> =
  (...args: SerializableArgs<Parameters<F>>) => SerializableResult<ReturnType<F>>;
