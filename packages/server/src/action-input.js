/**
 * The input shape a server action receives from a form submission.
 *
 * A `'use server'` action is reachable three ways, and before this module each
 * handed it a different first argument: the deserialized arguments over RPC, a
 * merged plain object through the `route()` adapter, and a raw `FormData` from
 * a bound `<form action=${fn}>`. A validator written for the RPC shape
 * (`input.title`) read `undefined` off the `FormData` and answered every form
 * submission with a 422, while `webjs check` and typecheck both passed.
 *
 * `formInput` turns a `FormData` into ONE object that reads both ways:
 *
 *   - Every submitted name is an own enumerable property holding its LAST value
 *     (the `Object.fromEntries(formData)` semantics), so `input.title`,
 *     destructuring, spreading and a schema library's `parse(input)` all work.
 *     A name ending in `[]` collects every value into an array under the name
 *     without the brackets, the conventional spelling for a checkbox group.
 *     A `File` stays a real `File`.
 *   - The `FormData` READERS are present as non-enumerable methods delegating
 *     to the original (`get`, `getAll`, `has`, `entries`, `keys`, `values`,
 *     `forEach`, iteration), so code written against a `FormData` keeps
 *     working, and so do `Object.fromEntries(input)`, `[...input]` and
 *     `new URLSearchParams(input)`.
 *
 * Deliberately absent: the WRITERS (`append`, `set`, `delete`). A write through
 * to the original would leave the field properties stale, and an action has no
 * reason to mutate its own input. `input instanceof FormData` is false.
 *
 * Fields are defined with `Object.defineProperty`, never assigned, so a field
 * named `__proto__` becomes an own data property instead of reaching the
 * prototype setter. A field that shares a reader's name wins: the data is what
 * the author named.
 *
 * @module
 */

/** The `FormData` readers the object answers, in declaration order. */
const READERS = ['get', 'getAll', 'has', 'entries', 'keys', 'values', 'forEach'];

/** Names already warned about, so a repeated name warns once per process. */
const warned = new Set();

/**
 * Convert a submitted `FormData` into the action input.
 *
 * @param {FormData} formData
 * @param {{ warn?: (message: string) => void, label?: string }} [opts]
 *   `warn` is passed in dev only: it reports a plain name submitted more than
 *   once, whose property keeps only the last value. `label` names the action in
 *   that message and keys the once-per-process dedupe.
 * @returns {Record<string, FormDataEntryValue | FormDataEntryValue[]>}
 */
export function formInput(formData, opts = {}) {
  /** @type {Record<string, FormDataEntryValue | FormDataEntryValue[]>} */
  const input = {};
  /** @type {Map<string, number>} */
  const counts = new Map();

  for (const [name, value] of formData.entries()) {
    counts.set(name, (counts.get(name) || 0) + 1);
    if (name.endsWith('[]') && name.length > 2) {
      const key = name.slice(0, -2);
      const prev = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : undefined;
      define(input, key, Array.isArray(prev) ? [...prev, value] : [value]);
    } else {
      define(input, name, value);
    }
  }

  for (const reader of READERS) {
    if (Object.prototype.hasOwnProperty.call(input, reader)) continue;
    Object.defineProperty(input, reader, {
      value: /** @type {any} */ (formData)[reader].bind(formData),
      enumerable: false, writable: false, configurable: true,
    });
  }
  Object.defineProperty(input, Symbol.iterator, {
    value: () => formData.entries(),
    enumerable: false, writable: false, configurable: true,
  });

  if (typeof opts.warn === 'function') {
    for (const [name, n] of counts) {
      if (n < 2 || name.endsWith('[]')) continue;
      const key = `${opts.label || ''}\u0000${name}`;
      if (warned.has(key)) continue;
      warned.add(key);
      opts.warn(
        `[webjs] the form field "${name}" was submitted ${n} times${opts.label ? ` to ${opts.label}` : ''}, `
        + `so input.${name} holds only the last value. Name the controls "${name}[]" to receive an array `
        + `as input.${name}, or read every value with input.getAll('${name}').`,
      );
    }
  }

  return input;
}

/**
 * True for a real `FormData`, the one value `formInput` converts.
 * @param {unknown} value
 */
export function isFormData(value) {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

/**
 * @param {object} target
 * @param {string} key
 * @param {unknown} value
 */
function define(target, key, value) {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}
