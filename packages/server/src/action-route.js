/**
 * The optional `route(action, opts?)` convenience adapter (#488).
 *
 * REST endpoints in webjs go through `route.ts` (the framework's first-class
 * HTTP handler). The ALWAYS-WORKS baseline is a hand-written `route.ts` that
 * imports a `'use server'` action and calls it:
 *
 * ```js
 * // app/api/posts/route.ts
 * import { createPost } from '../../../modules/posts/actions/create-post.server.ts';
 * export async function POST(req) {
 *   const body = await req.json();
 *   const result = await createPost(body);
 *   return Response.json(result);
 * }
 * ```
 *
 * `route()` is the one-liner shortcut for that pattern. It returns a
 * `route.ts`-style handler that merges the URL query, the route params, and the
 * JSON body into ONE input object, runs an optional boundary validator, and
 * dispatches the action through the request abort signal + the per-action
 * middleware chain, JSON-responding the result:
 *
 * ```js
 * // app/api/posts/route.ts
 * import { route } from '@webjsdev/server';
 * import { createPost } from '../../../modules/posts/actions/create-post.server.ts';
 * export const POST = route(createPost, { validate: createPostSchema });
 * ```
 *
 * Adapter rules when invoked over HTTP:
 *   - URL query params, route params (`ctx.params`), and the parsed JSON body
 *     (for a method with a body) are merged into a single object argument
 *     (body wins over params wins over query). A non-object JSON body becomes
 *     `{ body: parsed }`; invalid JSON is a 400. An over-limit body is a 413.
 *   - `opts.validate` (when present) runs through the SHARED `runValidate` seam,
 *     so a `{ success, fieldErrors }` envelope, a throw, and a transform-return
 *     are interpreted exactly as on the RPC path: a structured failure is a 422
 *     JSON, a thrown validator is a 400 (keeping a schema lib's `issues`), and a
 *     transform-return replaces the input.
 *   - The action runs inside the request's `AbortSignal` scope (#492) and the
 *     `opts.middleware` chain (#490); a middleware short-circuit carrying a
 *     numeric `status` maps that to the HTTP status (else a 200 JSON envelope).
 *   - A returned `Response` passes through verbatim; any other value is
 *     `Response.json`'d.
 *
 * This is purely a convenience: it ships no behaviour a hand-written `route.ts`
 * cannot express. For full control (custom headers, content negotiation,
 * streaming), write the `route.ts` by hand.
 */
import { runValidate } from './actions.js';
import { runWithActionSignal } from './action-signal.js';
import { runActionChain } from './action-middleware.js';
import { readTextBounded, payloadTooLarge, DEFAULT_MAX_BODY_BYTES } from './body-limit.js';
import { getBodyLimits } from './context.js';

/**
 * The JSON body cap in effect for the current request: the per-request limit
 * the handler stamped, or the secure default outside a request scope. `0`
 * disables the cap.
 * @returns {number}
 */
function jsonBodyLimit() {
  const limits = getBodyLimits();
  return limits ? limits.json : DEFAULT_MAX_BODY_BYTES;
}

/**
 * Expose a plain `'use server'` action over REST as a `route.ts`-style handler.
 *
 * @template A, R
 * @param {(input: A, ctx: { req: Request, params: Record<string,string> }) => R | Promise<R>} action
 *   the server action to call (its source is unchanged; this only wraps the
 *   HTTP-to-action adapter around it).
 * @param {{
 *   validate?: (input: any) => any,
 *   middleware?: Function[],
 * }} [opts]
 * @returns {(req: Request, ctx?: { params?: Record<string,string> }) => Promise<Response>}
 */
export function route(action, opts = {}) {
  return async function handler(req, ctx) {
    const params = (ctx && ctx.params) || {};
    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries());

    /** @type {Record<string, unknown>} */
    let body = {};
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      // Bounded read (issue #237): an over-limit body is a 413 before any parse.
      const { tooLarge, text } = await readTextBounded(req, jsonBodyLimit());
      if (tooLarge) return payloadTooLarge();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed;
          else body = { body: parsed };
        } catch {
          return new Response('Invalid JSON body', { status: 400 });
        }
      }
    }

    let arg = { ...query, ...params, ...body };
    if (typeof opts.validate === 'function') {
      // Run the validator through the SHARED contract (#245) so the REST adapter
      // and the RPC path interpret a `{ success, fieldErrors }` envelope, a
      // throw, and a transform-return identically. A structured failure becomes
      // a 422 JSON; a throw stays a 400 (keeping a schema lib's `issues`); a
      // transform-return replaces the input.
      const v = runValidate(opts.validate, arg);
      if (!v.ok) {
        if (v.thrown !== undefined) {
          const msg = v.result.error || 'Invalid input';
          const issues = v.thrown && typeof v.thrown === 'object' && 'issues' in v.thrown
            ? /** @type any */ (v.thrown).issues
            : undefined;
          return Response.json({ error: msg, issues }, { status: 400 });
        }
        const { status, ...payload } = v.result;
        return Response.json(payload, { status });
      }
      arg = v.value;
    }

    // The action runs inside the request signal scope (#492) and the per-action
    // middleware chain (#490). `ranAction` distinguishes a real completion from
    // a middleware short-circuit (the action never ran).
    const middleware = opts.middleware || [];
    let ranAction = false;
    const result = await runWithActionSignal(req.signal, () =>
      runActionChain(middleware, { request: req, args: [arg], signal: req.signal }, () => {
        ranAction = true;
        return action(/** @type any */ (arg), { req, params });
      }));

    if (result instanceof Response) return result;
    // A middleware short-circuit carrying a numeric `status` maps the envelope
    // status to the HTTP status, so a non-webjs REST client sees the real status
    // rather than a 200 with it in the body.
    if (!ranAction && result && typeof result === 'object' && typeof (/** @type any */ (result).status) === 'number') {
      const { status, ...payload } = /** @type any */ (result);
      return Response.json(payload, { status });
    }
    return Response.json(result ?? null);
  };
}
