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
 * `formInput` returns a `FormInput`: a real `FormData` (so `instanceof
 * FormData`, the readers, the writers and `fetch(url, { body: input })` all
 * behave as they always did) that ALSO carries every submitted field as an own
 * enumerable property, so `input.title`, destructuring, spreading and a schema
 * library's `parse(input)` read it like the plain object RPC delivers. Next
 * and TanStack Start hand an action a `FormData`; this keeps that and adds the
 * property view the RPC shape needs, so neither set of habits breaks.
 *
 *   - A property holds the field's LAST value (the `Object.fromEntries`
 *     semantics). A name ending in `[]` collects every value into an array
 *     under the name without the brackets, the convention Rails' parameter
 *     builder uses for a checkbox group. A `File` stays a real `File`.
 *   - `get`, `getAll` and `has` also accept the bracket-less name, so
 *     `input.getAll('tags')` reads a `tags[]` group and agrees with
 *     `input.tags`. Iteration (`entries`, `keys`, `values`, `forEach`,
 *     `Object.fromEntries(input)`) reports names as SUBMITTED, brackets
 *     included, like any `FormData`.
 *   - A name submitted both plain and with `[]` (`x=1&x[]=2`) is one array
 *     group, so nothing is dropped. Rails rejects that shape as a parameter
 *     type error, so dev warns once about it.
 *   - The writers (`append`, `set`, `delete`) keep the property in step.
 *
 * Fields are defined with `Object.defineProperty`, never assigned, so a field
 * named `__proto__` becomes an own data property instead of reaching the
 * prototype setter. A field that shares a method's name wins as data on the
 * instance: the data is what the author named.
 *
 * @module
 */

/** Names already warned about, so a repeated name warns once per process. */
const warned = new Set();

/**
 * A `FormData` whose submitted fields are also own enumerable properties.
 * Built only by `formInput`.
 */
class FormInput extends FormData {
  /**
   * @param {string} name
   * @returns {FormDataEntryValue | null}
   */
  get(name) {
    if (super.has(name)) return super.get(name);
    const alias = arrayName(name);
    return alias && super.has(alias) ? super.get(alias) : null;
  }

  /**
   * @param {string} name
   * @returns {FormDataEntryValue[]}
   */
  getAll(name) {
    const alias = arrayName(name);
    return alias ? [...super.getAll(name), ...super.getAll(alias)] : super.getAll(name);
  }

  /** @param {string} name */
  has(name) {
    const alias = arrayName(name);
    return super.has(name) || (!!alias && super.has(alias));
  }

  /**
   * @param {string} name
   * @param {string | Blob} value
   * @param {string} [filename]
   */
  append(name, value, filename) {
    if (filename === undefined) super.append(name, /** @type {any} */ (value));
    else super.append(name, /** @type {Blob} */ (value), filename);
    syncField(this, name);
  }

  /**
   * @param {string} name
   * @param {string | Blob} value
   * @param {string} [filename]
   */
  set(name, value, filename) {
    if (filename === undefined) super.set(name, /** @type {any} */ (value));
    else super.set(name, /** @type {Blob} */ (value), filename);
    syncField(this, name);
  }

  /** @param {string} name */
  delete(name) {
    super.delete(name);
    syncField(this, name);
  }
}

/**
 * Convert a submitted `FormData` into the action input.
 *
 * @param {FormData} formData
 * @param {{ warn?: (message: string) => void, label?: string, omit?: string }} [opts]
 *   `warn` is passed in dev only: it reports a plain name submitted more than
 *   once (its property keeps only the last value) and a name submitted under
 *   both spellings. `label` names the action in that message and keys the
 *   once-per-process dedupe. `omit` is a field to leave out (the framework's
 *   own `__webjs_action` identity).
 * @returns {FormData & Record<string, FormDataEntryValue | FormDataEntryValue[]>}
 */
export function formInput(formData, opts = {}) {
  const input = new FormInput();
  /** @type {Map<string, number>} */
  const counts = new Map();
  /** @type {Set<string>} */
  const plain = new Set();
  for (const [name, value] of formData.entries()) {
    if (name === opts.omit) continue;
    FormData.prototype.append.call(input, name, value);
    const key = isArrayName(name) ? name.slice(0, -2) : name;
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!isArrayName(name)) plain.add(name);
  }
  for (const key of counts.keys()) syncField(input, key);

  if (typeof opts.warn === 'function') {
    for (const [key, n] of counts) {
      const grouped = FormData.prototype.has.call(input, key + '[]');
      let message = null;
      if (grouped && plain.has(key)) {
        message = `[webjs] the form field "${key}" was submitted both as "${key}" and as "${key}[]"${opts.label ? ` to ${opts.label}` : ''}, `
          + `so input.${key} holds every value as one array. Give the controls one spelling, "${key}[]" for a group.`;
      } else if (!grouped && n > 1) {
        message = `[webjs] the form field "${key}" was submitted ${n} times${opts.label ? ` to ${opts.label}` : ''}, `
          + `so input.${key} holds only the last value. Name the controls "${key}[]" to receive an array `
          + `as input.${key}, or read every value with input.getAll('${key}').`;
      }
      if (!message) continue;
      const warnKey = `${opts.label || ''}\u0000${key}`;
      if (warned.has(warnKey)) continue;
      warned.add(warnKey);
      opts.warn(message);
    }
  }

  return /** @type {any} */ (input);
}

/**
 * True for a real `FormData` that `formInput` has not converted yet.
 * @param {unknown} value
 */
export function isFormData(value) {
  return typeof FormData !== 'undefined' && value instanceof FormData && !(value instanceof FormInput);
}

/**
 * Recompute the property for the field a submitted name belongs to, from the
 * entries currently in the form: an array when the name ever arrived as `[]`,
 * else the last value, else no property at all.
 * @param {FormInput} input
 * @param {string} name a submitted name, with or without `[]`
 */
function syncField(input, name) {
  const key = isArrayName(name) ? name.slice(0, -2) : name;
  const own = FormData.prototype.getAll.call(input, key);
  if (FormData.prototype.has.call(input, key + '[]')) {
    // Plain and bracketed entries in submission order, so a mixed form keeps
    // every value in the order the browser sent it.
    /** @type {FormDataEntryValue[]} */
    const values = [];
    for (const [n, v] of FormData.prototype.entries.call(input)) if (n === key || n === key + '[]') values.push(v);
    define(input, key, values);
  } else if (own.length) {
    define(input, key, own[own.length - 1]);
  } else if (Object.prototype.hasOwnProperty.call(input, key)) {
    delete /** @type {any} */ (input)[key];
  }
}

/**
 * True for a submitted name in the array form (`tags[]`).
 * @param {string} name
 */
function isArrayName(name) {
  return name.length > 2 && name.endsWith('[]');
}

/**
 * The `[]` spelling of a bracket-less name, or null for a name already in it.
 * @param {string} name
 */
function arrayName(name) {
  return isArrayName(name) ? null : name + '[]';
}

/**
 * @param {object} target
 * @param {string} key
 * @param {unknown} value
 */
function define(target, key, value) {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}
