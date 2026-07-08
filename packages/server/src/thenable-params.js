/**
 * Make a routing `params` / `searchParams` object awaitable WITHOUT losing
 * synchronous access (#848, Next.js 15/16 parity where these are Promises).
 *
 * Both forms work after wrapping:
 *
 *   const id = params.id;            // sync, unchanged
 *   const { id } = await params;     // Next-style, now also valid
 *
 * The `then` method is added NON-ENUMERABLE and NON-OWN-ENUMERABLE, so a
 * `{ ...obj }` spread, `Object.keys`, `JSON.stringify`, and `for...in` never
 * see it. That is the whole safety story: nothing that copies or serializes the
 * object can accidentally turn a copy into a thenable and poison a downstream
 * `Promise.resolve`. Only an explicit `await` / `.then` observes it.
 *
 * @template {object} T
 * @param {T} obj the plain params/searchParams record
 * @returns {T} the same object, now thenable (or `obj` unchanged when it is not
 *   a plain object or already carries a `then` data key)
 */
export function makeThenable(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  // A real `then` data key (an app route literally named its param "then")
  // must not be clobbered; leave such an object un-wrapped.
  if (Object.prototype.hasOwnProperty.call(obj, 'then')) return obj;
  Object.defineProperty(obj, 'then', {
    value: /** @param {(v: any) => void} resolve @param {(e: any) => void} [reject] */ (
      resolve,
      reject
    ) => {
      // Resolve to a PLAIN shallow copy (the non-enumerable `then` is not
      // copied), so the awaited value is a clean object and `await` cannot
      // recursively re-await the same thenable.
      const plain = { ...obj };
      return Promise.resolve(plain).then(resolve, reject);
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });
  return obj;
}
