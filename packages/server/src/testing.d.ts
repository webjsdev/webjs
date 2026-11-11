/**
 * Type overlay for `@webjsdev/server/testing` (the handle() test harness, #267).
 *
 * The runtime is packages/server/src/testing.js (JSDoc-annotated JavaScript);
 * this overlay exists so a TypeScript app's `import { testRequest,
 * invokeActionForTest } from '@webjsdev/server/testing'` resolves precise types instead of emitting
 * TS7016. The same declarations are re-exported from the package's main
 * `index.d.ts` (the helpers ship from both entry points). Zero runtime cost.
 */

/** The `handle(req)` function returned by `createRequestHandler`. */
export type Handle = (req: Request) => Promise<Response> | Response;

/** A `createRequestHandler` return value, or a bare `handle` function. */
export type AppOrHandle = { handle: Handle; appDir: string } | Handle;

/**
 * Coerce a bare path, full URL string, or pre-built `Request` into a `Request`.
 * A bare path is prefixed with a dummy origin; `init` is merged when provided.
 */
export declare function toRequest(input: string | Request, init?: RequestInit): Request;

/**
 * Fire a request through the real `handle()` pipeline and return the `Response`.
 * The documented one-liner: `await testRequest(app.handle, '/about')`.
 *
 * @example
 * ```ts
 * // test/posts/posts.test.ts, run with `webjs test`
 * import { test } from 'node:test';
 * import assert from 'node:assert/strict';
 * import { createRequestHandler } from '@webjsdev/server';
 * import { testRequest } from '@webjsdev/server/testing';
 *
 * test('the posts API creates a post', async () => {
 *   const app = await createRequestHandler({ appDir: process.cwd() });
 *   const res = await testRequest(app.handle, '/api/posts', {   // a bare path is fine
 *     method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Hi' }),
 *   });
 *   assert.equal(res.status, 201);
 * });
 * ```
 */
export declare function testRequest(
  handle: Handle,
  input: string | Request,
  init?: RequestInit,
): Promise<Response>;

/** Collect all `Set-Cookie` header values off a response. */
export declare function getSetCookies(res: Response): string[];

/** Reduce raw `Set-Cookie` strings to a single `name=value; name2=value2` `Cookie` header value. */
export declare function cookiesToHeader(setCookies: string[]): string;

/** Merge an extra cookie string into a `RequestInit`'s `Cookie` header. */
export declare function withCookies(init: RequestInit | undefined, cookieValue: string): RequestInit;

/** Merge a session cookie string into a `RequestInit`'s `Cookie` header. */
export declare function withSessionCookie(init: RequestInit | undefined, sessionCookie: string): RequestInit;

/**
 * Submit a page's `<form action={action}>` the way a browser with JS OFF does:
 * render the page, reuse the identity the server put in its hidden
 * `__webjs_action` field, and POST it back with the given fields. A POST that
 * omits that field is not a form submission and is answered `405`. Without
 * `match`, it picks among the forms bound to an action, skipping a layout's
 * plain form. When several remain and no `index` is given, it posts the one
 * whose inputs hold every submitted field name, and throws (listing each form
 * and its fields) when none or more than one does. A `File` / `Blob` value
 * posts the form multipart.
 *
 * @example
 * // A layout's bound logout form and the page's task form: the fields pick.
 * const res = await submitForm(app.handle, '/projects/1', { title: 'Ship it' }, { cookies });
 * assert.equal(res.status, 303);
 */
export declare function submitForm(
  handle: Handle,
  path: string,
  fields?: Record<string, string | string[] | Blob | Blob[]> | URLSearchParams | FormData,
  opts?: {
    index?: number;
    match?: string | RegExp;
    cookies?: string;
    /**
     * The page's HTML as the test fetched it earlier. The form is taken from it
     * instead of from a fresh render, so a test can submit a form the page no
     * longer shows (a vote on a poll closed since the page loaded).
     */
    html?: string;
    submitPath?: string;
    headers?: Record<string, string>;
  },
): Promise<Response>;

/**
 * Drive the REAL credentials login (`POST /api/auth/signin/credentials` by
 * default) and capture the genuine signed session `Set-Cookie`.
 *
 * @example
 * ```ts
 * // test/dashboard.test.ts, run with `webjs test`. Needs createAuth's handlers at
 * // app/api/auth/[...path]/route.ts (export const { GET, POST } = handlers).
 * import { test } from 'node:test';
 * import assert from 'node:assert/strict';
 * import { createRequestHandler } from '@webjsdev/server';
 * import { loginAndGetCookies, testRequest, withSessionCookie } from '@webjsdev/server/testing';
 *
 * test('a signed-in user sees the dashboard', async () => {
 *   const app = await createRequestHandler({ appDir: process.cwd() });
 *   const { cookies } = await loginAndGetCookies(app.handle, { email: 'ada@example.com', password: 'correct horse' });
 *   const res = await testRequest(app.handle, '/dashboard', withSessionCookie({}, cookies));
 *   assert.equal(res.status, 200);   // the user must exist first: seed it or sign up in the test
 * });
 * ```
 */
export declare function loginAndGetCookies(
  handle: Handle,
  credentials: { email: string; password: string },
  opts?: {
    loginPath?: string;
    method?: string;
    body?: BodyInit;
    contentType?: string;
    expectStatuses?: number[];
  },
): Promise<{ cookies: string; setCookies: string[]; response: Response }>;

/**
 * Compute the `/__webjs/action/<hash>/<fn>` RPC endpoint path for an action,
 * addressing it the same way the generated client stub does.
 */
export declare function actionEndpoint(
  appDir: string,
  serverFilePath: string,
  fnName: string,
): Promise<string>;

/**
 * Round-trip an action through its REAL RPC endpoint (serializer + CSRF + prod
 * error sanitization) and return the parsed return value. Models a same-origin
 * browser POST, so it passes the Origin / Sec-Fetch-Site CSRF check.
 *
 * @example
 * ```ts
 * // test/tasks/add-task.test.ts, run with `webjs test`
 * import { test } from 'node:test';
 * import assert from 'node:assert/strict';
 * import { createRequestHandler } from '@webjsdev/server';
 * import { invokeActionForTest, submitForm } from '@webjsdev/server/testing';
 *
 * test('a blank title is refused', async () => {
 *   const app = await createRequestHandler({ appDir: process.cwd() });
 *   const result = await invokeActionForTest<{ success: boolean }>(
 *     app, 'modules/tasks/actions/add-task.server.ts', 'addTask', [{ title: '' }]);
 *   assert.equal(result.success, false);
 *   // The no-JS form path: renders /tasks, posts its bound form, 422 on failure.
 *   const res = await submitForm(app.handle, '/tasks', { title: '' });
 *   assert.equal(res.status, 422);
 * });
 * ```
 */
export declare function invokeActionForTest<T = unknown>(
  app: AppOrHandle,
  serverFilePath: string,
  fnName: string,
  args?: unknown[],
  opts?: {
    appDir?: string;
    extraCookies?: string;
    throwOnError?: boolean;
  },
): Promise<T>;

/**
 * Lower-level variant of `invokeActionForTest` that returns the raw `Response`
 * (never throws on a non-2xx), so a test can assert the status directly. Set
 * `crossOrigin` (true or a specific origin) to model a cross-site request and
 * assert the 403.
 */
export declare function rawActionRequest(
  app: AppOrHandle,
  serverFilePath: string,
  fnName: string,
  args?: unknown[],
  opts?: {
    crossOrigin?: boolean | string;
    appDir?: string;
    extraCookies?: string;
    contentType?: string;
  },
): Promise<Response>;

/** Browser-test harness (#806): a webjs handler a web-test-runner config
 * proxies module requests to, so a browser test can import a real `.ts`
 * component that imports a `'use server'` action. `importmapHtml()` is the
 * `<script type="importmap">` to inject into the test page (call after warmup). */
export declare function createBrowserTestHandler(appDir: string): Promise<{
  handle: Handle;
  warmup: () => Promise<void>;
  importmapHtml: () => string;
}>;
