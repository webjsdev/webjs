/**
 * HTTP-verb server actions (#488): read the per-action configuration declared as
 * RESERVED sibling exports in a `'use server'` action file, and the helpers that
 * turn that config into transport + caching behavior.
 *
 * The function stays a plain `export async function`; the framework reads these
 * statically-named exports the same way a page declares `export const
 * revalidate` / `metadata`:
 *
 *   'use server';
 *   export const method = 'GET';                 // 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'; absent => POST
 *   export const cache = 60;                      // seconds, or { maxAge, swr, public }
 *   export const tags = (id) => [`user:${id}`];   // GET: tags the cached read
 *   export const invalidates = (id) => [...];     // mutation: tags to evict
 *   export const validate = (input) => ...;       // boundary validator
 *   export async function getUser(id) { ... }     // THE action (one per file)
 *
 * No folder automation: an action with no `method` export stays a POST, exactly
 * as before this feature (additive, non-breaking).
 */

/** The HTTP verbs an action may declare. */
export const RPC_VERBS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/** Reserved config export names (special only in a `'use server'` file). */
export const RESERVED_CONFIG = new Set(['method', 'cache', 'tags', 'invalidates', 'validate', 'middleware']);

/** Verbs whose args ride the URL (so the read is cacheable / the URL is the key). */
export const URL_ARG_VERBS = new Set(['GET', 'DELETE']);

/** Verbs that are CSRF-exempt (safe, no state change). */
export const SAFE_VERBS = new Set(['GET']);

/**
 * Max length of the URL-encoded args for a URL-arg verb before the client stub
 * falls back to a POST with the args in the body (uncacheable). Conservative so
 * the URL stays within common browser / CDN limits. TanStack Start uses 1MB for
 * its server-side GET cap; the browser/CDN URL ceiling is the tighter bound.
 */
export const MAX_URL_ARGS = 4096;

/**
 * The exported function names that are ACTIONS (callable), i.e. every function
 * export whose name is not a reserved config key. With one-function-per-file
 * there is exactly one; the framework still returns the list so a misconfigured
 * multi-function file is detectable (a `webjs check` rule).
 * @param {Record<string, unknown>} mod
 * @returns {string[]}
 */
export function actionFunctionNames(mod) {
  const names = Object.keys(mod).filter(
    (k) => typeof mod[k] === 'function' && !RESERVED_CONFIG.has(k),
  );
  if (typeof mod.default === 'function' && !names.includes('default')) names.push('default');
  return names;
}

/**
 * The action's HTTP method: the declared `method` export uppercased and
 * validated against {@link RPC_VERBS}, defaulting to POST (an unknown value
 * falls back to POST rather than throwing, the #232 fail-safe posture).
 * @param {Record<string, unknown>} mod
 * @returns {string}
 */
export function actionMethod(mod) {
  const raw = mod && mod.method;
  if (typeof raw !== 'string') return 'POST';
  const m = raw.trim().toUpperCase();
  return RPC_VERBS.has(m) ? m : 'POST';
}

/**
 * Normalize the `cache` export to `{ maxAge, swr, public }` or null (no
 * caching). A number is `maxAge` seconds; an object carries `maxAge` / `swr`
 * (stale-while-revalidate) / `public`. Default `private` (a read is per-user
 * safe unless the author opts into shared caching with `public: true`).
 * @param {Record<string, unknown>} mod
 * @returns {{ maxAge: number, swr: number, public: boolean } | null}
 */
export function actionCache(mod) {
  const raw = mod && mod.cache;
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return { maxAge: Math.floor(raw), swr: 0, public: false };
  }
  if (typeof raw === 'object') {
    const maxAge = Number.isFinite(raw.maxAge) && raw.maxAge >= 0 ? Math.floor(raw.maxAge) : 0;
    const swr = Number.isFinite(raw.swr) && raw.swr >= 0 ? Math.floor(raw.swr) : 0;
    return { maxAge, swr, public: raw.public === true };
  }
  return null;
}

/**
 * The action's per-action middleware chain (#490): the `middleware` export, an
 * array of `(ctx, next) => result` functions, or [] when absent / malformed.
 * @param {Record<string, unknown>} mod
 * @returns {Function[]}
 */
export function actionMiddleware(mod) {
  const raw = mod && mod.middleware;
  if (!Array.isArray(raw)) return [];
  return raw.filter((m) => typeof m === 'function');
}

/**
 * Resolve the `tags` / `invalidates` / `validate` config functions off the
 * module (each is a function or absent).
 * @param {Record<string, unknown>} mod
 * @param {'tags'|'invalidates'|'validate'} name
 * @returns {Function | null}
 */
export function actionConfigFn(mod, name) {
  return mod && typeof mod[name] === 'function' ? mod[name] : null;
}

/**
 * Compute the tag list for a `tags` / `invalidates` config given the call args.
 * A function is invoked with the args (so `(id) => [`user:${id}`]` works); an
 * array is used verbatim. Never throws into the caller; a bad tag fn yields [].
 * @param {Function | unknown[] | null} tagsConfig
 * @param {unknown[]} args
 * @returns {string[]}
 */
export function resolveTags(tagsConfig, args) {
  try {
    const out = typeof tagsConfig === 'function' ? tagsConfig(...args) : tagsConfig;
    if (!Array.isArray(out)) return [];
    return out.filter((t) => typeof t === 'string' && t.length > 0);
  } catch {
    return [];
  }
}

/**
 * The `Cache-Control` value for a GET action response, or null (caller emits
 * `no-store`). A cached GET is `public|private, max-age=N[, stale-while-
 * revalidate=M]`; a GET with no `cache` config is uncached (null -> no-store).
 * @param {string} method
 * @param {{ maxAge: number, swr: number, public: boolean } | null} cache
 * @returns {string | null}
 */
export function cacheControlFor(method, cache) {
  if (method !== 'GET' || !cache) return null;
  const scope = cache.public ? 'public' : 'private';
  let h = `${scope}, max-age=${cache.maxAge}`;
  if (cache.swr > 0) h += `, stale-while-revalidate=${cache.swr}`;
  return h;
}

/**
 * The set of request methods the action endpoint accepts for an action whose
 * declared method is `method`. A URL-arg verb (GET/DELETE) ALSO accepts POST as
 * the too-large-args fallback; a body verb accepts only itself.
 * @param {string} method
 * @returns {Set<string>}
 */
export function allowedRequestMethods(method) {
  const s = new Set([method]);
  if (URL_ARG_VERBS.has(method)) s.add('POST');
  return s;
}
