import { isNotFound, isRedirect, isForbidden, isUnauthorized } from '@webjsdev/core';
import { ssrPage, ssrNotFound, ssrForbidden, ssrUnauthorized, loadModule } from './ssr.js';
import { readBytesBounded, payloadTooLarge, DEFAULT_MAX_MULTIPART_BYTES } from './body-limit.js';
import { getBodyLimits } from './context.js';
import { propagateTrustedRemoteIp } from './rate-limit.js';
import { makeThenable } from './thenable-params.js';

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
 * Read the submitted body ONCE, bounded by the form/multipart limit (issue
 * #237), and return both a `FormData` (handed to the action as `formData`) and a
 * rebuilt `Request` carrying the already-read bytes (handed to the action as
 * `request`, so it can still call `request.json()` / `request.formData()`). The
 * body is consumed off the ORIGINAL request directly, NOT via `req.clone()`: a
 * tee'd clone whose reader is cancelled mid-stream (the over-limit case)
 * deadlocks the untaken branch, hanging the response.
 *
 * An over-limit body is reported as `tooLarge` (the caller returns 413) and is
 * never buffered whole. A form posts more than a JSON RPC call (textarea, small
 * upload), so it uses the higher `multipart` cap. A non-form content type yields
 * an empty FormData so the action signature stays stable; the rebuilt request
 * still carries the raw bytes for the action to parse however it likes.
 *
 * @param {Request} req
 * @returns {Promise<{ tooLarge: boolean, formData: FormData, request: Request }>}
 */
async function parseFormBody(req) {
  const ct = req.headers.get('content-type') || '';
  const limits = getBodyLimits();
  const limit = limits ? limits.multipart : DEFAULT_MAX_MULTIPART_BYTES;
  const { tooLarge, bytes } = await readBytesBounded(req, limit);
  if (tooLarge) return { tooLarge: true, formData: new FormData(), request: req };

  // Rebuild a fresh Request from the bytes so the action can re-read the body.
  // SECURITY (#756): strip any inbound `x-webjs-remote-ip` the copy carried so a
  // client cannot spoof it through the rebuild, and carry the FRAMEWORK-trusted
  // remote IP forward out of band (the rebuild is a new object, so the listener's
  // WeakMap stamp on `req` does not follow it). Without this, `clientIp` inside a
  // page `action` (the no-JS form write path, e.g. login throttling) would read
  // the spoofable header on Bun.
  const headers = new Headers(req.headers);
  headers.delete('x-webjs-remote-ip');
  const rebuilt = new Request(req.url, {
    method: req.method,
    headers,
    body: bytes && bytes.byteLength ? bytes : undefined,
  });
  propagateTrustedRemoteIp(req, rebuilt);

  const isForm = /multipart\/form-data|application\/x-www-form-urlencoded/i.test(ct);
  let formData = new FormData();
  if (isForm) {
    // Parse a SECOND fresh Request (the rebuilt one is reserved for the action).
    const forParse = new Request(req.url, {
      method: 'POST',
      headers: ct ? { 'content-type': ct } : undefined,
      body: bytes && bytes.byteLength ? bytes : undefined,
    });
    formData = await forParse.formData();
  }
  return { tooLarge: false, formData, request: rebuilt };
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
  let formData = new FormData();
  // The body is read ONCE here (bounded). `actionReq` is a rebuilt request the
  // action can re-read; on a parse failure it falls back to the original `req`.
  let actionReq = req;
  try {
    const parsed = await parseFormBody(req);
    // Over the form/multipart limit (issue #237): 413 before the action runs.
    if (parsed.tooLarge) return payloadTooLarge();
    formData = parsed.formData;
    actionReq = parsed.request;
  } catch {
    formData = new FormData();
  }

  /** @type {ActionResult | undefined} */
  let result;
  try {
    // params / searchParams are awaitable AND sync-readable here too (#848).
    result = await action({
      request: actionReq,
      params: makeThenable(params),
      searchParams: makeThenable(searchParams),
      url,
      formData,
    });
  } catch (err) {
    if (isRedirect(err)) {
      const e = /** @type any */ (err);
      // A thrown redirect from an action (a POST) defaults to 307 Temporary
      // Redirect, which is method-preserving so the action's intent survives
      // the bounce; an explicit `redirect(url, status)` overrides it. This is
      // deliberately NOT the GET gate's 302 default (see ssr.js). PRG (303) is
      // the SUCCESS-result path below.
      return new Response(null, { status: e.status || 307, headers: { location: e.url } });
    }
    if (isNotFound(err)) {
      return ssrNotFound(ssrOpts.notFoundFile ?? null, { ...ssrOpts, req, url });
    }
    // forbidden()/unauthorized() from a page action render the same 403/401
    // boundary as the page-render path (#848), not a generic 500.
    if (isForbidden(err)) {
      return ssrForbidden(route, { ...ssrOpts, req, url });
    }
    if (isUnauthorized(err)) {
      return ssrUnauthorized(route, { ...ssrOpts, req, url });
    }
    throw err;
  }

  // A page action MAY return a `Response` directly (e.g. a content-negotiated
  // `streamResponse`, #248). Honor it verbatim, so the action owns the status +
  // content type and the router applies it (a stream body surgically). With JS
  // off the same action returns a normal ActionResult instead, so the PRG /
  // re-render paths below still drive the no-JS form.
  if (result instanceof Response) return result;

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
