import { pathToFileURL } from 'node:url';
import { isNotFound, isRedirect } from '@webjsdev/core';
import { ssrPage, ssrNotFound } from './ssr.js';

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
 *     render does (3xx / 404).
 *   - Action returns a SUCCESS result (`{ success: true, ... }`) => 303 See Other
 *     to `result.redirect` if present, else to the page's own path (Post/Redirect/Get,
 *     so a reload does not resubmit).
 *   - Action returns a FAILURE result (`{ success: false, fieldErrors?, values?, ... }`)
 *     => re-SSR the SAME page (status 422) with the result on `ctx.actionData`, so the
 *     page template can read `actionData.fieldErrors` / `actionData.values` and
 *     repopulate inputs.
 *
 * @typedef {{
 *   success?: boolean,
 *   data?: unknown,
 *   error?: string,
 *   fieldErrors?: Record<string,string>,
 *   values?: Record<string,unknown>,
 *   status?: number,
 *   redirect?: string,
 * }} ActionResult
 */

/**
 * Load a page module and return its `action` export, or null if it has none.
 * Mirrors `loadModule` in ssr.js (cache-bust in dev so edits take effect).
 *
 * @param {string} file absolute path to the page module
 * @param {boolean} dev
 * @returns {Promise<Function | null>}
 */
export async function loadPageAction(file, dev) {
  const url = pathToFileURL(file).toString();
  const bust = dev ? `?t=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
  try {
    const mod = await import(url + bust);
    return typeof mod.action === 'function' ? mod.action : null;
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
 * @param {import('./router.js').PageRoute} route
 * @param {Record<string,string>} params
 * @param {URL} url
 * @param {Function} action the page module's `action` export
 * @param {Request} req
 * @param {object} ssrOpts the same opts object `ssrPage` receives in dev.js
 * @returns {Promise<Response>}
 */
export async function runPageAction(route, params, url, action, req, ssrOpts) {
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

  // Non-result return (undefined / null) is treated as a bare success: PRG to
  // the page's own path.
  const success = !result || result.success !== false;

  if (success) {
    const target = (result && result.redirect) || (url.pathname + url.search) || '/';
    return new Response(null, { status: 303, headers: { location: target } });
  }

  // FAILURE: re-render the SAME page with the action result available on
  // ctx.actionData, status 422. Repopulation is the page author's job (native
  // `value=${actionData.values?.field}`).
  const status = typeof result.status === 'number' && result.status >= 400 ? result.status : 422;
  return ssrPage(route, params, url, { ...ssrOpts, req, actionData: result, status });
}
