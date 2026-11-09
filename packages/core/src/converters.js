/**
 * Lit's `defaultConverter` and `notEqual` (#1686), exported under the same
 * names so a component written from Lit's docs (a custom converter that
 * delegates to the default, or `hasChanged: (v, old) => notEqual(v, old)`)
 * imports them from `@webjsdev/core` as it would from `lit`.
 *
 * The semantics are Lit's, line for line: a Boolean attribute is on when
 * present, a Number parses with `Number()`, an Object or Array round-trips
 * through JSON (an unparseable value reads `null`, as in Lit), and anything
 * else is the string.
 *
 * @module
 */

/** @type {{ toAttribute(value: unknown, type?: unknown): unknown, fromAttribute(value: string | null, type?: unknown): unknown }} */
export const defaultConverter = {
  toAttribute(value, type) {
    if (type === Boolean) return value ? '' : null;
    if (type === Object || type === Array) return value == null ? value : JSON.stringify(value);
    return value;
  },
  fromAttribute(value, type) {
    if (type === Boolean) return value !== null;
    if (type === Number) return value === null ? null : Number(value);
    if (type === Object || type === Array) {
      try { return JSON.parse(/** @type {string} */ (value)); } catch { return null; }
    }
    return value;
  },
};

/**
 * Lit's default change check: true when `value` differs from `old`, by
 * `Object.is` (so `NaN` equals `NaN`).
 * @param {unknown} value @param {unknown} old
 * @returns {boolean}
 */
export const notEqual = (value, old) => !Object.is(value, old);
