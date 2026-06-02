import { isNotFound, isRedirect } from '@webjsdev/core';
import { ssrPage, ssrNotFound, loadModule } from './ssr.js';

/**
 * Page server actions: a `page.{js,ts}` may export an `action` function that
 * handles a non-GET/HEAD submission to the page's own URL. This is webjs's
 * Remix-style page-action path, adapted to the no-build progressive-enhancement
 * model: a `<form method="POST">` submits with JS disabled, the action runs on
 * the server, and a validation failure re-renders the SAME page with field
 * errors and the user's typed values preserved.
 *
 * Behavior (see #244):
 *   - Action throws `redirect(url)` or `notFound()` => honored exactly as a page
 *     render does (3xx / 404). A thrown `redirect()` may target an external URL
 *     (it is the explicit nav sentinel, author-controlled).
 *   - Action returns a SUCCESS result => 303 See Other to `result.redirect` if
 *     present, else to the page's own path (Post/Redirect/Get, so a reload does
 *     not resubmit). `result.redirect` MUST be a same-site local path (see
 *     `sameSiteRedirect`), a non-local value is ignored to avoid an
 *     open-redirect through a user-controlled action result.
 *   - Action returns a FAILURE result => re-SSR the SAME page (status 422) with
 *     the result on `ctx.actionData`, so the page template can read
 *     `actionData.fieldErrors` / `actionData.values` and repopulate inputs.
 *
 * Failure detection is robust (it does not require a literal `success: false`):
 * see `isFailureResult`.
 *
 * @typedef {{
 *   success?: boolean,
 *   data?: unknown,
 *   error?: string,
 *   fieldErrors?: Record<string,string>,
 *   values?: Record<string,string>,
 *   status?: number,
 *   redirect?: string,
 * }} ActionResult
 */

/**
 * Whether an action result is a FAILURE (re-render the page) rather than a
 * success (PRG redirect). A result is a failure when ANY of these hold:
 *   - `result.success === false` (explicit), OR
 *   - `result.fieldErrors` is present (per-field validation messages), OR
 *   - `result.error` is present AND `result.success !== true`.
 *
 * Success is the explicit `success: true`, or a bare value (or
 * undefined/null) carrying no error markers. This means an action that returns
 * `{ error, status }` or `{ fieldErrors }` WITHOUT a literal `success: false`
 * is still treated as a failure and its error is surfaced, not swallowed.
 *
 * @param {ActionResult | null | undefined} result
 * @returns {boolean}
 */
function isFailureResult(result) {
  if (!result || typeof result !== 'object') return false;
  if (result.success === false) return true;
  if (result.fieldErrors != null) return true;
  if (result.error != null && result.success !== true) return true;
  return false;
}

/**
 * Restrict a page action's `result.redirect` to a SAME-SITE local target.
 * Allowed: a path beginning with a single `/` (e.g. `/login`, `/a?b=1#c`).
 * Rejected: a protocol-relative `//host/...` and any absolute `scheme://...`
 * URL. A user-controlled redirect target is an open-redirect vector, so a
 * non-local value is dropped and the caller falls back to the page's own path.
 *
 * A thrown `redirect(absoluteUrl)` (the nav sentinel) is intentionally NOT
 * routed through here: that is the author-controlled escape hatch for a
 * legitimate external redirect.
 *
 * @param {unknown} target
 * @returns {string | null} the safe local path, or null when not same-site
 */
function sameSiteRedirect(target) {
  if (typeof target !== 'string') return null;
  // Must start with a single slash (a leading `//` is protocol-relative and
  // would navigate cross-origin).
  if (!target.startsWith('/') || target.startsWith('//')) return null;
  // A backslash after the leading slash (`/\evil.com`) is normalized by some
  // browsers into a protocol-relative URL, so reject it too.
  if (target.startsWith('/\\')) return null;
  return target;
}

/**
 * Load a page module and return its `action` export, or null if it has none.
 * Uses ssr.js's shared `loadModule`, so page-action loading is consistent with
 * the SSR re-render. In prod the URL is stable and Node's module cache serves
 * one evaluation; in dev a cache-bust forces a fresh evaluation.
 *
 * @param {string} file absolute path to the page module
 * @param {boolean} dev
 * @returns {Promise<{ action: Function, module: Record<string, unknown> } | null>}
 */
export async function loadPageAction(file, dev) {
  try {
    const mod = await loadModule(file, dev);
    return typeof mod.action === 'function'
      ? { action: /** @type {Function} */ (mod.action), module: mod }
      : null;
  } catch {
    return null;
  }
}

/**
 * Parse the submitted form body into a `FormData`, handed to the action as
 * `formData`. A non-form content type (e.g. a JSON fetch) yields an empty
 * FormData so the action signature stays stable; the action can still read the
 * raw `request` for the JSON body.
 *
 * @param {Request} req
 * @returns {Promise<{ formData: FormData }>}
 */
async function parseFormBody(req) {
  const ct = req.headers.get('content-type') || '';
  /** @type {FormData} */
  let formData;
  if (/multipart\/form-data|application\/x-www-form-urlencoded/i.test(ct)) {
    formData = await req.formData();
  } else {
    formData = new FormData();
  }
  return { formData };
}

/**
 * Run a page `action` for a non-GET/HEAD request and produce the HTTP response.
 * The caller has already confirmed the path matches a page route AND that the
 * page module exports an `action` (via `loadPageAction`). The action runs inside
 * the same segment middleware as the page (the caller wraps this).
 *
 * The failure re-render reuses the SAME page module instance whose `action` just
 * ran (passed through as `pageModule`), so the page module is loaded once per
 * POST rather than evaluated a second time.
 *
 * @param {import('./router.js').PageRoute} route
 * @param {Record<string,string>} params
 * @param {URL} url
 * @param {{ action: Function, module: Record<string, unknown> }} loaded the page module's `action` plus the loaded module
 * @param {Request} req
 * @param {object} ssrOpts the same opts object `ssrPage` receives in dev.js
 * @returns {Promise<Response>}
 */
export async function runPageAction(route, params, url, loaded, req, ssrOpts) {
  const { action, module: pageModule } = loaded;
  const searchParams = Object.fromEntries(url.searchParams.entries());
  let formData;
  try {
    ({ formData } = await parseFormBody(req.clone()));
  } catch {
    formData = new FormData();
  }

  /** @type {ActionResult | undefined} */
  let result;
  try {
    result = await action({ request: req, params, searchParams, url, formData });
  } catch (err) {
    if (isRedirect(err)) {
      const e = /** @type any */ (err);
      // A thrown redirect from an action is honored as the page render does.
      // Use the action's chosen status (307/308) so an explicit redirect()
      // keeps its semantics; PRG (303) is the SUCCESS-result path below.
      return new Response(null, { status: e.status || 307, headers: { location: e.url } });
    }
    if (isNotFound(err)) {
      return ssrNotFound(ssrOpts.notFoundFile ?? null, { ...ssrOpts, req, url });
    }
    throw err;
  }

  if (!isFailureResult(result)) {
    // SUCCESS: Post/Redirect/Get. A user-controlled `result.redirect` is only
    // honored when it is a same-site local path; otherwise fall back to the
    // page's own path so a poisoned value cannot become an open redirect.
    const ownPath = (url.pathname + url.search) || '/';
    const safe = result ? sameSiteRedirect(result.redirect) : null;
    return new Response(null, { status: 303, headers: { location: safe || ownPath } });
  }

  // FAILURE: re-render the SAME page with the action result available on
  // ctx.actionData, status 422. Repopulation is the page author's job (native
  // `value=${actionData.values?.field}`). Pass the already-loaded page module so
  // the re-render shares this POST's single evaluation.
  const status = typeof result.status === 'number' && result.status >= 400 ? result.status : 422;
  return ssrPage(route, params, url, { ...ssrOpts, req, actionData: result, status, pageModule });
}
