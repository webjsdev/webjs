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

/**
 * A page's `searchParams` the Next.js way (#1686): each key maps to its value,
 * and a key that repeats (`?tag=a&tag=b`) maps to every value in order, as an
 * array. `Object.fromEntries` kept only the last one, so a multi-select filter
 * read one choice.
 * @param {URLSearchParams} params
 * @returns {Record<string, string | string[]>}
 */
export function searchParamsRecord(params) {
  /** @type {Record<string, string | string[]>} */
  const out = {};
  for (const [k, v] of params) {
    // Own keys only, and defined rather than assigned: `?constructor=x` must
    // not read Object.prototype's member, and `?__proto__=x` must be a key,
    // never the record's prototype.
    if (!Object.hasOwn(out, k)) {
      Object.defineProperty(out, k, { value: v, writable: true, enumerable: true, configurable: true });
      continue;
    }
    const prev = out[k];
    if (Array.isArray(prev)) prev.push(v);
    else out[k] = [/** @type {string} */ (prev), v];
  }
  return out;
}
