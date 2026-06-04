/**
 * `optimistic(signal, value, action)`, a thin optimistic-mutation helper.
 *
 * The optimistic-UI pattern: show the expected result of a mutation
 * IMMEDIATELY (so the interface feels instant), run the real server action,
 * and roll the optimistic value back if the action fails. This wrapper does
 * exactly that and nothing more, no state machine, no extra reactivity, just
 * the existing signal primitive plus a try / envelope check.
 *
 *   import { signal, optimistic } from '@webjsdev/core';
 *   import { likePost } from '../actions/like-post.server.js';
 *
 *   const liked = signal(false);
 *   // In an @click handler:
 *   await optimistic(liked, true, () => likePost(postId));
 *   // `liked` flips to true instantly; if likePost throws or returns
 *   // { success: false }, it rolls back to its prior value.
 *
 * Behaviour:
 *   1. Capture `prev = signal.get()`.
 *   2. `signal.set(value)` so the UI updates before the round-trip.
 *   3. `await action()`.
 *   4a. The action THROWS  -> `signal.set(prev)` (rollback) + re-throw.
 *   4b. The action returns an ActionResult FAILURE envelope
 *       (`result && result.success === false`) -> `signal.set(prev)`
 *       (rollback) + return the result (the caller reads its
 *       `error` / `fieldErrors`).
 *   4c. SUCCESS (anything else) -> keep the optimistic value + return the
 *       result. The caller can reconcile to the authoritative value from the
 *       returned result if it wants to (e.g. `signal.set(result.data.count)`).
 *
 * It rolls back on a thrown error OR a `{ success: false }` ActionResult, and
 * never rolls back on success. Client-only: it mutates a signal (client work),
 * so a component importing it is never elided as display-only.
 *
 * @template T
 * @param {{ get: () => T, set: (v: T) => void }} signal  A webjs signal.
 * @param {T} value  The optimistic value to show immediately.
 * @param {() => Promise<any> | any} action  The server-action call (or any
 *   thunk returning a Promise / value).
 * @returns {Promise<any>}  The action's result. On a `{ success: false }`
 *   envelope the rolled-back result is returned (not thrown); a thrown action
 *   re-throws after rollback.
 */
export async function optimistic(signal, value, action) {
  const prev = signal.get();
  signal.set(value);
  let result;
  try {
    result = await action();
  } catch (err) {
    // The action rejected: roll the optimistic value back and let the caller
    // handle the error (re-throw, do not swallow).
    signal.set(prev);
    throw err;
  }
  // ActionResult FAILURE envelope: a `{ success: false }` is a handled
  // failure, not a throw. Roll back and hand the result back so the caller
  // can read its `error` / `fieldErrors`.
  if (result && result.success === false) {
    signal.set(prev);
  }
  return result;
}
