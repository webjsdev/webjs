/**
 * Type overlay for `@webjsdev/server/testing` (the handle() test harness, #267).
 *
 * The runtime is packages/server/src/testing.js (JSDoc-annotated JavaScript);
 * this overlay exists so a TypeScript app's `import { testRequest, getCsrf }
 * from '@webjsdev/server/testing'` resolves precise types instead of emitting
 * TS7016. The same declarations are re-exported from the package's main
 * `index.d.ts` (the helpers ship from both entry points). Zero runtime cost.
 */

/** The `handle(req)` function returned by `createRequestHandler`. */
export type Handle = (req: Request) => Promise<Response> | Response;

/** A `createRequestHandler` return value, or a bare `handle` function. */
export type AppOrHandle = { handle: Handle; appDir: string } | Handle;

/** A CSRF token + cookie + header-name triple minted off the first SSR response. */
export interface CsrfPair {
  /** The bare token value for the `x-webjs-csrf` request header. */
  token: string;
  /** The header NAME (`x-webjs-csrf`). */
  header: string;
  /** The `name=value` cookie string for the `Cookie` request header. */
  cookie: string;
}

/**
 * Coerce a bare path, full URL string, or pre-built `Request` into a `Request`.
 * A bare path is prefixed with a dummy origin; `init` is merged when provided.
 */
export declare function toRequest(input: string | Request, init?: RequestInit): Request;

/**
 * Fire a request through the real `handle()` pipeline and return the `Response`.
 * The documented one-liner: `await testRequest(app.handle, '/about')`.
 */
export declare function testRequest(
  handle: Handle,
  input: string | Request,
  init?: RequestInit,
): Promise<Response>;

/** Read the `webjs_csrf` cookie value off a response's `Set-Cookie` header(s). */
export declare function readCsrfCookie(res: Response): string | null;

/** Collect all `Set-Cookie` header values off a response. */
export declare function getSetCookies(res: Response): string[];

/** Reduce raw `Set-Cookie` strings to a single `name=value; name2=value2` `Cookie` header value. */
export declare function cookiesToHeader(setCookies: string[]): string;

/**
 * Mint a `{ token, header, cookie }` CSRF triple off the first SSR response.
 * `path` is the GET path used to issue the cookie (default `/`).
 */
export declare function getCsrf(handle: Handle, path?: string): Promise<CsrfPair>;

/** Merge an extra cookie string into a `RequestInit`'s `Cookie` header. */
export declare function withCookies(init: RequestInit | undefined, cookieValue: string): RequestInit;

/** Merge a session cookie string into a `RequestInit`'s `Cookie` header. */
export declare function withSessionCookie(init: RequestInit | undefined, sessionCookie: string): RequestInit;

/**
 * Drive the REAL credentials login (`POST /api/auth/signin/credentials` by
 * default) and capture the genuine signed session `Set-Cookie`.
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
 * error sanitization) and return the parsed return value.
 */
export declare function invokeActionForTest<T = unknown>(
  app: AppOrHandle,
  serverFilePath: string,
  fnName: string,
  args?: unknown[],
  opts?: {
    csrf?: CsrfPair;
    appDir?: string;
    extraCookies?: string;
    throwOnError?: boolean;
  },
): Promise<T>;

/**
 * Lower-level variant of `invokeActionForTest` that returns the raw `Response`
 * (never throws on a non-2xx), so a test can assert the status directly.
 */
export declare function rawActionRequest(
  app: AppOrHandle,
  serverFilePath: string,
  fnName: string,
  args?: unknown[],
  opts?: {
    csrf?: CsrfPair | null;
    omitCsrf?: boolean;
    appDir?: string;
    extraCookies?: string;
    contentType?: string;
  },
): Promise<Response>;
