/**
 * Expose a server action as a first-class HTTP endpoint in addition to its
 * internal RPC URL.
 *
 * ```js
 * // actions/posts.server.js
 * 'use server';
 * import { expose } from '@webjsdev/core';
 *
 * export const createPost = expose('POST /api/posts', async ({ title, body }) => {
 *   // same function body you'd write without expose()
 * });
 * ```
 *
 * The action is reachable two ways, both backed by the exact same code:
 *   - from a client component:   `import { createPost } from '.../posts.server.js'`
 *   - from curl / another service: `POST /api/posts` with a JSON body
 *
 * Adapter rules when invoked over HTTP:
 *   - URL path params ({`:slug`}) and query string are merged into a single
 *     object argument.
 *   - For methods with a body (POST/PUT/PATCH/DELETE), the parsed JSON body
 *     is merged on top of params/query. The function receives ONE argument:
 *     the merged object.
 *   - If `opts.validate` is provided, it runs BEFORE the function on EVERY
 *     call path (the REST path here AND the internal RPC path), so a single
 *     validator declared once guards both. The framework calls `validate(input)`
 *     and interprets the return (see the validator contract below):
 *       - a `{ success: true, data? }` envelope passes (the action receives
 *         `data` when present, else the original input);
 *       - a `{ success: false, fieldErrors, message? }` envelope FAILS with a
 *         structured field-error result (422), without calling the action;
 *       - a THROW fails (→ 400 on REST, sanitized error on RPC), preserving the
 *         classic `Schema.parse`-style contract;
 *       - any OTHER returned plain value is treated as the transformed input
 *         (back-compat with the `validate: Schema.parse` transform style).
 *     The zod adapter is three lines and keeps the framework zod-free:
 *       `validate: (i) => { const r = Schema.safeParse(i);
 *          return r.success ? { success: true, data: r.data }
 *            : { success: false, fieldErrors: r.error.flatten().fieldErrors }; }`
 *   - Return value becomes a JSON `Response`; throw or return a `Response`
 *     directly for full control.
 *
 *
 * `cors` toggles browser CORS support for cross-origin callers:
 *   - `true`             - allow any origin (`*`), reflects requested headers
 *   - string             - allow that single origin (sets `Access-Control-Allow-Credentials: true`)
 *   - string[]           - allow-list; non-matching origins are not granted
 *   - { origin, credentials, maxAge, headers }: full control
 *
 * When CORS is enabled, an `OPTIONS` preflight at the same path is auto-served
 * with `Access-Control-Allow-Methods: <route's method>, OPTIONS`.
 *
 * @param {string} pattern e.g. `"POST /api/posts"` or `"GET /api/posts/:slug"`
 * @param {Function} fn the async implementation
 * @param {{
 *   validate?: (input: any) => any,
 *   cors?: boolean | string | string[] | { origin: string | string[], credentials?: boolean, maxAge?: number, headers?: string[] }
 * }} [opts]
 * @returns {Function} same function, tagged with HTTP metadata
 */
export function expose(pattern, fn, opts) {
  const match = /^\s*([A-Z]+)\s+(\/\S*)\s*$/.exec(pattern);
  if (!match) {
    throw new Error(
      `expose(): bad pattern ${JSON.stringify(pattern)}: expected "METHOD /path"`
    );
  }
  const [, method, path] = match;
  /** @type any */ (fn).__webjsHttp = {
    method,
    path,
    validate: opts && typeof opts.validate === 'function' ? opts.validate : null,
    cors: opts && 'cors' in opts ? normaliseCors(opts.cors) : null,
  };
  return fn;
}

/** @param {any} c */
function normaliseCors(c) {
  if (!c) return null;
  if (c === true) {
    return { origin: '*', credentials: false, maxAge: 86400, headers: null };
  }
  if (typeof c === 'string') {
    return { origin: c, credentials: true, maxAge: 86400, headers: null };
  }
  if (Array.isArray(c)) {
    return { origin: c, credentials: true, maxAge: 86400, headers: null };
  }
  return {
    origin: c.origin,
    credentials: !!c.credentials,
    maxAge: typeof c.maxAge === 'number' ? c.maxAge : 86400,
    headers: Array.isArray(c.headers) ? c.headers : null,
  };
}

/**
 * Attach an input validator to a server action WITHOUT exposing it as a REST
 * endpoint. The validator runs SERVER-SIDE before the action body on BOTH call
 * paths: the internal RPC path (a client component importing the action) AND
 * the `expose()` REST path (if the action is also exposed). This is the shared,
 * declare-once validation surface (#245).
 *
 * It reuses the EXACT same `__webjsHttp` storage `expose()` writes, so the
 * action index's `getExposed(fn)` already surfaces the validator with no new
 * plumbing. The action stays a plain callable function (a direct unit-test
 * import still works, just without the framework running validate).
 *
 * If the action is already `expose()`d, prefer passing `{ validate }` to
 * `expose()` directly; calling both keeps the LAST validator attached.
 *
 * ```js
 * // actions/posts.server.js
 * 'use server';
 * import { validateInput } from '@webjsdev/core';
 *
 * export const createPost = validateInput(
 *   async ({ title }) => { ... },
 *   (input) => {
 *     const errs = {};
 *     if (!input?.title?.trim()) errs.title = 'Title is required';
 *     return Object.keys(errs).length
 *       ? { success: false, fieldErrors: errs }
 *       : { success: true };
 *   },
 * );
 * ```
 *
 * The validator contract (the framework calls `validate(input)`):
 *   - returns `{ success: true, data? }` → valid; the action is called with
 *     `data` if present, else the original input;
 *   - returns `{ success: false, fieldErrors, message? }` (an object with a
 *     boolean `success` of `false`, or with a `fieldErrors`) → FAILED; the
 *     framework returns a structured `ActionResult`
 *     `{ success: false, fieldErrors, error: message?, status: 422 }` without
 *     calling the action body;
 *   - THROWS → mapped to a sanitized failure result (the classic
 *     `Schema.parse` contract);
 *   - returns ANY OTHER plain value → treated as the validated/coerced input
 *     and passed to the action (the `validate: Schema.parse` transform style).
 *
 * Disambiguation: a return is a result-envelope ONLY when it is an object with
 * a boolean `success` property OR a `fieldErrors` property; otherwise it is a
 * transformed input value.
 *
 * Server-side only; import inside `.server.{js,ts}` files. The bare
 * `@webjsdev/core` specifier resolves to the browser entry, which excludes
 * `validateInput` (like `expose`), so an import from client-bound code reads
 * `undefined`. The validator itself lives in the `.server` file and never
 * reaches the client.
 *
 * @template {Function} F
 * @param {F} fn the async action implementation
 * @param {(input: any) => any} validate the validator (a plain function or a
 *   zod-`safeParse` adapter)
 * @returns {F} the same function, tagged with the validator
 */
export function validateInput(fn, validate) {
  if (typeof fn !== 'function') {
    throw new Error('validateInput(): first argument must be the action function');
  }
  if (typeof validate !== 'function') {
    throw new Error('validateInput(): second argument must be a validator function');
  }
  const existing = /** @type any */ (fn).__webjsHttp || {};
  /** @type any */ (fn).__webjsHttp = { ...existing, validate };
  return fn;
}

/** @param {unknown} fn */
export function getExposed(fn) {
  return fn && typeof fn === 'function' ? /** @type any */ (fn).__webjsHttp || null : null;
}
