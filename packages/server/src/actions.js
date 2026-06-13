import { digestHex } from './crypto-utils.js';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { getExposed } from '@webjsdev/core';
import { walk } from './fs-walk.js';
import { verify as verifyCsrf, CSRF_COOKIE, CSRF_HEADER } from './csrf.js';
import { getSerializer } from './serializer.js';
import { resolveOrigin } from './cors.js';
import { readTextBounded, payloadTooLarge, DEFAULT_MAX_BODY_BYTES } from './body-limit.js';
import {
  actionMethod, actionFunctionNames, actionCache, actionConfigFn, resolveTags,
  cacheControlFor, allowedRequestMethods, URL_ARG_VERBS, SAFE_VERBS, MAX_URL_ARGS,
  RESERVED_CONFIG,
} from './action-config.js';
import { revalidateTags } from './cache-tags.js';
import { ifNoneMatchSatisfied } from './conditional-get.js';
import { getBodyLimits } from './context.js';
import { basePath } from './importmap.js';
import { withBasePath } from './base-path.js';

/**
 * The JSON / RPC body cap in effect for the current request: the per-request
 * limit the handler stamped, or the secure default outside a request scope (a
 * direct unit-test invocation). `0` disables the cap.
 * @returns {number}
 */
function jsonBodyLimit() {
  const limits = getBodyLimits();
  return limits ? limits.json : DEFAULT_MAX_BODY_BYTES;
}

/**
 * Internal RPC wire-format content type. Distinguishes webjs action
 * responses from plain `application/json` so the stub can pick the right
 * parser and external JSON consumers aren't confused.
 *
 * Uses the content type from the active serializer (defaults to
 * `application/vnd.webjs+json` with the built-in webjs serializer).
 */
export const RPC_CONTENT_TYPE = 'application/vnd.webjs+json';

/**
 * Run an attached input validator against an action's input, shared by the RPC
 * path (`invokeAction`) and the `expose()` REST path (`invokeExposedAction`) so
 * the contract is identical across transports (#245). The framework only CALLS
 * the validator and shapes the result; it ships no validation library.
 *
 * @param {(input: any) => any} validate the attached validator
 * @param {any} input the value handed to the validator (the action's first arg
 *   on RPC, the merged query/params/body object on REST)
 * @returns {{ ok: true, value: any } | { ok: false, result: { success: false, fieldErrors?: Record<string,string>, error?: string, status: number }, thrown?: unknown }}
 *   `ok: true` carries the value to pass to the action (the validated `data`,
 *   the transformed return, or the original input). `ok: false` carries the
 *   structured failure result the caller serializes back; on a THROWN validator
 *   it also carries the original error on `thrown` so a caller can salvage a
 *   schema lib's structured `issues` (the REST path does, for back-compat).
 */
export function runValidate(validate, input) {
  let out;
  try {
    out = validate(input);
  } catch (e) {
    // Throw-to-reject (the classic `Schema.parse` contract). Map to a sanitized
    // failure result; a thrown validator is a 400 (bad input), not a 500.
    // Surface only the message; `thrown` lets the REST caller recover `issues`.
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, result: { success: false, error: msg, status: 400 }, thrown: e };
  }
  // Disambiguate an ActionResult envelope from a plain transformed value: a
  // return is an envelope ONLY when it is an object carrying a boolean
  // `success` OR a `fieldErrors`. Anything else is a transformed input.
  if (out && typeof out === 'object' && !Array.isArray(out) &&
      (typeof (/** @type any */ (out).success) === 'boolean' || 'fieldErrors' in out)) {
    const env = /** @type any */ (out);
    if (env.success === true) {
      // `{ success: true, data? }` → valid; use `data` when present, else input.
      return { ok: true, value: 'data' in env ? env.data : input };
    }
    // Failure: `{ success: false, ... }` or `{ fieldErrors }` (no literal
    // success). Shape the structured field-error result.
    return {
      ok: false,
      result: {
        success: false,
        ...(env.fieldErrors ? { fieldErrors: env.fieldErrors } : {}),
        ...(env.message || env.error ? { error: env.message || env.error } : {}),
        status: typeof env.status === 'number' ? env.status : 422,
      },
    };
  }
  // A non-envelope return transforms the input (back-compat with
  // `validate: Schema.parse`); `undefined` means "no transform", keep input.
  return { ok: true, value: out === undefined ? input : out };
}

/** Build a serialized Response with webjs content-type. */
async function rpcResponse(payload, init = {}) {
  const s = getSerializer();
  const headers = new Headers(init.headers || {});
  headers.set('content-type', s.contentType);
  return new Response(await s.serialize(payload), { ...init, headers });
}

/**
 * Server-actions subsystem.
 *
 * Two complementary markers describe server-side files:
 *
 *   - `.server.{js,ts,mts,mjs}` extension: file is **server-only**. The
 *     file router refuses to serve its source to the browser. This is
 *     the path-level boundary.
 *   - `'use server'` directive at the top: file's exports are
 *     **RPC-callable** from client code. This is the semantic opt-in.
 *
 * The two together (`.server.ts` AND `'use server'`) define a server
 * action: source-protected AND RPC-exposed. The extension alone marks
 * a server-only utility (source-protected, NOT RPC-exposed: browser
 * imports get an error stub that throws at load). The directive alone
 * (no extension) does nothing: a `webjs check` lint rule
 * (`use-server-needs-extension`) flags it because the file is served
 * to the browser as plain source and the directive is silently
 * ignored.
 *
 * The server:
 *   1. Scans the app tree lazily on the first request (in `ensureReady`),
 *      classifying server files into RPC-callable actions vs. server-only
 *      utilities. Hashing is eager-per-file; only `expose()` files load.
 *   2. Serves a generated ES-module stub when the browser imports
 *      the file URL (an RPC stub for actions, a throw-at-load stub
 *      for server-only utilities).
 *   3. Exposes POST endpoints at /__webjs/action/:hash/:fn for
 *      RPC-callable actions only.
 *   4. If an exported function was wrapped in `expose('METHOD /path', fn)`,
 *      also registers it as a first-class REST endpoint.
 *
 * @typedef {{
 *   method: string,
 *   pattern: RegExp,
 *   paramNames: string[],
 *   file: string,
 *   fnName: string,
 *   validate: ((input: any) => any) | null,
 *   cors: { origin: string | string[], credentials: boolean, maxAge: number, headers: string[] | null } | null,
 * }} ExposedRoute
 *
 * @typedef {{
 *   hashToFile: Map<string,string>,
 *   fileToHash: Map<string,string>,
 *   httpRoutes: ExposedRoute[],
 *   appDir: string,
 *   dev: boolean,
 * }} ActionIndex
 */

/**
 * Build the action index by scanning the app directory.
 *
 * @param {string} appDir
 * @param {boolean} dev
 * @param {{ skipExposeLoad?: boolean }} [opts]
 *   `skipExposeLoad: true` builds the (load-free) `fileToHash` / `hashToFile`
 *   maps WITHOUT importing any `expose()`-referencing module, so `httpRoutes`
 *   stays empty. A read-only introspection caller (the MCP `list_actions` tool,
 *   #262) uses this to derive RPC endpoint hashes without running a server
 *   module's top-level side effects (Prisma init, DB connect) or risking a
 *   stray stdout write. The request pipeline keeps the default (loads expose
 *   routes, which the router must know before a request can hit them).
 * @returns {Promise<ActionIndex>}
 */
export async function buildActionIndex(appDir, dev, opts = {}) {
  /** @type {Map<string,string>} */
  const hashToFile = new Map();
  /** @type {Map<string,string>} */
  const fileToHash = new Map();
  /** @type {ExposedRoute[]} */
  const httpRoutes = [];

  for await (const file of walk(appDir, (p) => /\.m?[jt]s$/.test(p))) {
    // Path-level: only `.server.{ts,js,mts,mjs}` files are server-only.
    // A bare `'use server'` directive without the extension is a lint
    // violation (use-server-needs-extension) and the file is treated as
    // plain browser code: no source protection, no RPC registration.
    if (!isServerFile(file)) continue;
    // Semantic-level: only files that ALSO have `'use server'` are
    // RPC-callable. `.server.ts` without the directive is server-only
    // (still source-protected by the file router) but its exports are
    // NOT registered as RPC endpoints. The browser-side import gets a
    // throw-at-load stub via `serveServerOnlyStub` instead.
    if (!(await hasUseServerDirective(file))) continue;

    const h = await hashFile(file);
    hashToFile.set(h, file);
    fileToHash.set(file, h);
    // Pure-RPC actions are NOT executed at boot: invokeAction and
    // serveActionStub import the module on demand (first RPC call / first stub
    // fetch), so the hash index above is all the analysis needs. Eagerly
    // running every server module (and its transitive Prisma init, DB
    // connects, etc.) would be wasted work. The one thing that DOES need eager loading is expose(),
    // which registers a REST route the router must know before any request can
    // hit it. So load only files that REFERENCE expose. We match the bare
    // `expose` identifier (not `expose(`) so an aliased import
    // (`import { expose as exp }`, whose import clause still names `expose`) is
    // not missed: missing it would silently 404 that file's REST route. A stray
    // mention in a comment or string only over-matches, costing one harmless
    // extra module load; the common pure-RPC file never names `expose` and so
    // still defers entirely.
    // A read-only caller (MCP introspection) only needs the file -> hash maps
    // above, so skip the expose-load entirely (no module side effects).
    if (opts.skipExposeLoad) continue;
    let src = '';
    try { src = await readFile(file, 'utf8'); } catch {}
    if (!/\bexpose\b/.test(src)) continue;
    try {
      const mod = await loadModule(file, dev);
      for (const [name, fn] of Object.entries(mod)) {
        if (typeof fn !== 'function') continue;
        const http = getExposed(fn);
        if (!http) continue;
        // A `validateInput(fn, ...)` attachment writes `__webjsHttp` with a
        // `validate` but NO `method`/`path` (it does not create a REST route),
        // so it is not an exposed route. Only `expose()` sets a path; skip a
        // validate-only attachment here (its validator is read at RPC call
        // time via getExposed in invokeAction).
        if (!http.path || !http.method) continue;
        const { pattern, paramNames } = pathToPattern(http.path);
        httpRoutes.push({
          method: http.method,
          pattern,
          paramNames,
          file,
          fnName: name,
          validate: http.validate || null,
          cors: http.cors || null,
        });
      }
    } catch (e) {
      console.error(`[webjs] failed to scan server module ${file}:`, e);
    }
  }

  return { hashToFile, fileToHash, httpRoutes, appDir, dev };
}

/** @param {string} file @returns {Promise<string>} */
export async function hashFile(file) {
  return (await digestHex('SHA-256', file)).slice(0, 10);
}

/**
 * Predicate: file is server-only (source-protected, never served as
 * source to the browser). True for `.server.{js,ts,mts,mjs}` files.
 * Synchronous, name-only check, the path-level boundary.
 *
 * The `'use server'` directive without the extension does NOT make a
 * file server-only: a `webjs check` lint rule
 * (`use-server-needs-extension`) flags that pattern instead, and the
 * file is treated as plain browser code.
 *
 * @param {string} file
 * @returns {boolean}
 */
export function isServerFile(file) {
  return /\.server\.m?[jt]s$/.test(file);
}

/**
 * Predicate: file has the `'use server'` directive in its first 5 lines.
 * Semantic-level marker: when paired with `.server.ts`, registers the
 * file's exports as RPC-callable from client code.
 *
 * @param {string} file
 * @returns {Promise<boolean>}
 */
export async function hasUseServerDirective(file) {
  try {
    const text = await readFile(file, 'utf8');
    const head = text.split('\n').slice(0, 5).join('\n');
    return /^\s*(['"])use server\1\s*;?\s*$/m.test(head);
  } catch {
    return false;
  }
}

/**
 * Predicate: file is a server action (server-only + RPC-callable).
 * True when both markers are present: `.server.{js,ts}` extension AND
 * `'use server'` directive.
 *
 * @param {string} file
 * @returns {Promise<boolean>}
 */
export async function isServerAction(file) {
  if (!isServerFile(file)) return false;
  return await hasUseServerDirective(file);
}

/**
 * @param {ActionIndex} idx
 * @param {string} urlPath - a browser-visible URL path like `/actions/foo.server.js`
 */
export function resolveServerModule(idx, urlPath) {
  const abs = join(idx.appDir, urlPath.split('/').join(sep));
  return idx.fileToHash.has(abs) ? abs : null;
}

/**
 * Generate a throw-at-load stub for a server-only file (a `.server.ts`
 * file WITHOUT a `'use server'` directive). When a browser-side module
 * imports this file, the stub throws synchronously at module load time
 * with a clear error pointing at the file, so the developer immediately
 * sees that server-only code can't be reached from the browser.
 *
 * @param {string} relPath path relative to appDir for the error message
 * @returns {string} JavaScript module source
 */
export function serveServerOnlyStub(relPath) {
  const msg =
    `Cannot import "${relPath}" from browser code. ` +
    `This file is server-only (a .server.{js,ts} file with no 'use server' directive). ` +
    `Either add 'use server' at the top of the file to expose its exports as RPC, ` +
    `or wrap the server-only logic in a separate *.server.{js,ts} action and import that instead. ` +
    `Docs: https://docs.webjs.com/docs/server-actions`;
  return `// webjs: server-only module stub for ${relPath} (no 'use server' directive)
throw new Error(${JSON.stringify(msg)});
`;
}

/**
 * Serve the generated client stub for a server module.
 * @param {ActionIndex} idx
 * @param {string} absFile
 */
export async function serveActionStub(idx, absFile) {
  const mod = await loadModule(absFile, idx.dev);
  const hash = idx.fileToHash.get(absFile) || await hashFile(absFile);
  // HTTP-verb actions (#488): the file declares its verb via `export const
  // method` (default POST). The function exports are the actions; the reserved
  // config exports (method/cache/tags/invalidates/validate) are excluded.
  const fnNames = actionFunctionNames(mod);
  const method = actionMethod(mod);
  // The RPC endpoint is a framework-emitted same-origin URL, so it must
  // carry the basePath prefix under a sub-path deploy (#256), exactly like
  // the importmap targets and the boot module specifiers. Without this the
  // stub would POST to a bare /__webjs/action/... that the ingress strip
  // 404s, breaking every server action when webjs.basePath is set.
  const actionUrl = withBasePath(`/__webjs/action/${hash}/`, basePath());
  const body = buildStubBody({ hash, method, fnNames, actionUrl });
  return body;
}

/**
 * Build the generated client stub source for a `'use server'` action file. The
 * transport depends on the file's declared `method`:
 *   - GET: args ride the URL (`?a=`), the SSR seed (#472) is read first, the
 *     browser HTTP cache is consulted, and a tag-invalidated key revalidates;
 *     CSRF-exempt (a safe read). Over-large args fall back to a POST.
 *   - DELETE: args ride the URL, CSRF-protected, over-large args fall back to a
 *     POST.
 *   - POST / PUT / PATCH: rich body, CSRF-protected.
 * Every path reads `X-Webjs-Invalidate` (mark tags stale) and a GET reads
 * `X-Webjs-Tags` (register the key's tags), so a later read sees a mutation.
 * @param {{ hash: string, method: string, fnNames: string[], actionUrl: string }} opts
 * @returns {string}
 */
function buildStubBody({ hash, method, fnNames, actionUrl }) {
  const URL_ARG = URL_ARG_VERBS.has(method);
  const SAFE = SAFE_VERBS.has(method);
  const J = JSON.stringify;
  const lines = [];
  lines.push(`// webjs: generated server-action stub (${method})`);
  // Every verb reads the SSR seed (#472) first: an async-render READ invoked
  // during SSR is seeded regardless of its declared verb (a read with no
  // `method` is a default POST), so the first client call resolves from the
  // seed with no hydration round-trip. The browser-cache staleness check is
  // GET-only (only a GET is browser-cached).
  const imports = ['stringify as __s', 'parse as __p', 'takeSeed as __seedTake', 'SEED_MISS as __MISS', 'markStale as __markStale', 'parseTagHeader as __tagHdr'];
  if (method === 'GET') {
    imports.push('registerKeyTags as __regTags', 'consumeStale as __stale', 'fetchMark as __mark');
  }
  lines.push(`import { ${imports.join(', ')} } from '@webjsdev/core';`);
  lines.push(`const __URL = ${J(actionUrl)};`);
  lines.push(`const __HASH = ${J(hash)};`);
  lines.push(`const __METHOD = ${J(method)};`);
  lines.push(`const __MAX = ${MAX_URL_ARGS};`);
  lines.push(`const __CT = ${J(RPC_CONTENT_TYPE)};`);
  lines.push(`function __csrf() { const m = document.cookie.match(/(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; }`);
  // Shared: parse a response, surface invalidation, register a GET's tags
  // (stamped with the clock SAMPLED BEFORE the fetch, so a mutation in flight is
  // caught on the next read).
  lines.push(`async function __handle(res, fn, key, since) {`);
  lines.push(`  const inv = __tagHdr(res.headers.get('x-webjs-invalidate')); if (inv.length) __markStale(inv);`);
  lines.push(`  if (key != null) { const t = __tagHdr(res.headers.get('x-webjs-tags')); if (t.length) __regTags(key, t, since); }`);
  lines.push(`  const ct = res.headers.get('content-type') || '';`);
  lines.push(`  const text = await res.text();`);
  lines.push(`  const parsed = ct.includes(__CT) ? __p(text) : (ct.includes('application/json') ? JSON.parse(text) : text);`);
  lines.push(`  if (!res.ok) throw new Error((parsed && parsed.error) || ('webjs action ' + fn + ' -> ' + res.status));`);
  lines.push(`  return parsed;`);
  lines.push(`}`);
  // Body sender (POST/PUT/PATCH, and the URL-arg too-large fallback).
  lines.push(`async function __body(fn, body, m, csrf) {`);
  lines.push(`  const headers = { 'content-type': __CT }; if (csrf) headers[${J(CSRF_HEADER)}] = __csrf();`);
  lines.push(`  const res = await fetch(__URL + fn, { method: m, headers, credentials: 'same-origin', body });`);
  lines.push(`  return __handle(res, fn, null);`);
  lines.push(`}`);
  if (URL_ARG) {
    // GET/DELETE: args in the URL, with a POST fallback when too large.
    lines.push(`async function __call(fn, args) {`);
    lines.push(`  const key = await __s(args);`);
    lines.push(`  const seeded = __seedTake(__HASH, fn, key); if (seeded !== __MISS) return seeded;`);
    lines.push(`  if (key.length > __MAX) return __body(fn, key, 'POST', ${SAFE ? 'false' : 'true'});`);
    if (method === 'GET') {
      lines.push(`  const bypass = __stale(key);`);
      lines.push(`  const since = __mark();`);
      lines.push(`  const res = await fetch(__URL + fn + '?a=' + encodeURIComponent(key), { method: 'GET', credentials: 'same-origin', cache: bypass ? 'no-cache' : 'default' });`);
      lines.push(`  return __handle(res, fn, key, since);`);
    } else {
      lines.push(`  const res = await fetch(__URL + fn + '?a=' + encodeURIComponent(key), { method: __METHOD, headers: { ${J(CSRF_HEADER)}: __csrf() }, credentials: 'same-origin' });`);
      lines.push(`  return __handle(res, fn, null);`);
    }
    lines.push(`}`);
  } else {
    // POST/PUT/PATCH: rich body. The seed read makes a default-POST async-render
    // read resolve from the SSR seed on hydration (#472); a true mutation is
    // never SSR-invoked, so the seed simply misses.
    lines.push(`async function __call(fn, args) {`);
    lines.push(`  const key = await __s(args);`);
    lines.push(`  const seeded = __seedTake(__HASH, fn, key); if (seeded !== __MISS) return seeded;`);
    lines.push(`  return __body(fn, key, __METHOD, true);`);
    lines.push(`}`);
  }
  for (const name of fnNames) {
    lines.push(
      name === 'default'
        ? `export default (...args) => __call('default', args);`
        : `export const ${name} = (...args) => __call(${J(name)}, args);`,
    );
  }
  return lines.join('\n') + '\n';
}

/**
 * Invoke a server action via the internal RPC wire format.
 * @param {ActionIndex} idx
 * @param {string} hash
 * @param {string} fnName
 * @param {Request} req
 * @param {(error: unknown) => void} [onError] best-effort sink (issue #239)
 *   invoked when the action throws unexpectedly, BEFORE the sanitized 500 is
 *   returned, so an APM integration sees the original error. The caller wraps
 *   it so a throwing sink can never affect the response.
 */
export async function invokeAction(idx, hash, fnName, req, onError) {
  const file = idx.hashToFile.get(hash);
  if (!file) return rpcResponse({ error: 'Unknown action' }, { status: 404 });
  const mod = await loadModule(file, idx.dev);
  const fn = fnName === 'default' ? mod.default : mod[fnName];
  // A reserved config export (method/cache/tags/invalidates/validate) is never
  // a callable action even though some are functions (#488).
  if (typeof fn !== 'function' || RESERVED_CONFIG.has(fnName)) {
    return rpcResponse({ error: `Unknown action ${fnName}` }, { status: 404 });
  }

  // HTTP-verb dispatch (#488). The action declares its method (default POST). A
  // URL-arg verb (GET/DELETE) also accepts a POST fallback for over-large args.
  const method = actionMethod(mod);
  const reqMethod = req.method.toUpperCase();
  const allowed = allowedRequestMethods(method);
  if (!allowed.has(reqMethod)) {
    return rpcResponse(
      { error: `expected ${method} for ${fnName}, got ${reqMethod}` },
      { status: 405, headers: { allow: [...allowed].join(', ') } },
    );
  }
  // CSRF: required for every verb except a safe GET (a read with no state
  // change, which is also browser-cacheable so it cannot carry a fresh token).
  if (!SAFE_VERBS.has(method) && !verifyCsrf(req)) {
    return rpcResponse({ error: 'CSRF validation failed' }, { status: 403 });
  }

  // Args ride the URL for a URL-arg request (GET / DELETE), else the body.
  let args = [];
  const fromUrl = reqMethod === 'GET' || reqMethod === 'DELETE';
  try {
    if (fromUrl) {
      const a = new URL(req.url).searchParams.get('a');
      args = a ? getSerializer().deserialize(a) : [];
    } else {
      const { tooLarge, text: body } = await readTextBounded(req, jsonBodyLimit());
      if (tooLarge) return payloadTooLarge();
      args = body ? getSerializer().deserialize(body) : [];
    }
    if (!Array.isArray(args)) args = [args];
  } catch {
    return rpcResponse({ error: 'Invalid request body' }, { status: 400 });
  }
  // Input validation (#245): a validator attached via `validateInput(fn, ...)`
  // or `expose(spec, fn, { validate })` runs SERVER-SIDE before the body on
  // this RPC path too, not just the REST path. The RPC stub sends an args
  // array; an action conventionally takes one input object, so validate the
  // FIRST arg (matching how the REST path validates its single merged object).
  // Validation is a BOUNDARY concern (#488): the validator is the `validate`
  // config export (the new model), or the legacy `expose`/`validateInput`
  // attachment. It runs on this RPC boundary on the FIRST arg (the conventional
  // single input object), never on a direct server-to-server call.
  const attached = getExposed(fn);
  const validate = actionConfigFn(mod, 'validate') || (attached && attached.validate);
  if (typeof validate === 'function') {
    const v = runValidate(validate, args[0]);
    if (!v.ok) {
      if (v.thrown !== undefined) {
        // A THROWN validator behaves like a thrown action: a sanitized error
        // response (non-200, so the client stub throws), with prod stack
        // sanitization. The onError sink sees the original error too.
        if (typeof onError === 'function') onError(v.thrown);
        return actionErrorResponse(v.thrown, idx.dev);
      }
      // A structured `{ success: false, fieldErrors }` envelope is a NORMAL
      // result the action author renders (`result.fieldErrors`): serialized as
      // a 200 RPC payload so the client stub returns it as a real object rather
      // than throwing, the failure status riding inside the envelope.
      return rpcResponse(v.result);
    }
    args = [v.value, ...args.slice(1)];
  }
  try {
    const result = await fn(...args);
    if (method === 'GET') return await getActionResponse(result, mod, args, req);
    // A mutation (POST/PUT/PATCH/DELETE): resolve `invalidates`, evict those
    // server `cache()` tags, and report them to the client via
    // `X-Webjs-Invalidate` so the browser-cache coordinator marks them stale.
    const headers = {};
    const inv = resolveTags(actionConfigFn(mod, 'invalidates'), args);
    if (inv.length) {
      await revalidateTags(inv);
      headers['x-webjs-invalidate'] = inv.join(',');
    }
    return rpcResponse(result ?? null, { headers });
  } catch (e) {
    if (typeof onError === 'function') onError(e);
    return actionErrorResponse(e, idx.dev);
  }
}

/**
 * Build a GET action's response (#488): the serialized body plus a weak ETag
 * (content hash), the `Cache-Control` from the `cache` config (else `no-store`),
 * and `X-Webjs-Tags`. Answers `If-None-Match` with a 304 itself rather than
 * relying on the conditional-GET funnel, which EXCLUDES `private` responses (the
 * default here); a per-user browser cache may still revalidate to a 304.
 * @param {unknown} result
 * @param {Record<string, unknown>} mod
 * @param {unknown[]} args
 * @param {Request} req
 * @returns {Promise<Response>}
 */
async function getActionResponse(result, mod, args, req) {
  const s = getSerializer();
  const bodyStr = await s.serialize(result ?? null);
  const cache = actionCache(mod);
  const etag = `W/"${(await digestHex('SHA-256', bodyStr)).slice(0, 16)}"`;
  const headers = new Headers({ 'content-type': s.contentType, etag });
  headers.set('cache-control', cacheControlFor('GET', cache) || 'no-store');
  if (cache) {
    const tags = resolveTags(actionConfigFn(mod, 'tags'), args);
    if (tags.length) headers.set('x-webjs-tags', tags.join(','));
  }
  if (ifNoneMatchSatisfied(req.headers.get('if-none-match'), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(bodyStr, { status: 200, headers });
}

/**
 * Match an incoming request against an expose()d action route.
 * Returns the single matched route+params for normal methods.
 * @param {ActionIndex} idx
 * @param {string} method
 * @param {string} pathname
 */
export function matchExposedAction(idx, method, pathname) {
  for (const r of idx.httpRoutes) {
    if (r.method !== method) continue;
    const m = r.pattern.exec(pathname);
    if (!m) continue;
    /** @type {Record<string,string>} */
    const params = {};
    r.paramNames.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1] || '')));
    return { route: r, params };
  }
  return null;
}

/**
 * Find ALL exposed routes at a given path (any method). Used to build OPTIONS
 * preflight responses and Allow headers.
 * @param {ActionIndex} idx
 * @param {string} pathname
 */
export function matchAllAtPath(idx, pathname) {
  const out = [];
  for (const r of idx.httpRoutes) {
    if (r.pattern.exec(pathname)) out.push(r);
  }
  return out;
}

/**
 * Build CORS response headers given a route's CORS config + the request.
 * Returns null if CORS isn't configured for this route.
 *
 * @param {ExposedRoute} route
 * @param {Request} req
 */
export function corsHeadersFor(route, req) {
  if (!route.cors) return null;
  const cfg = route.cors;
  const origin = req.headers.get('origin') || '';
  const allowed = matchOrigin(cfg.origin, origin);
  if (!allowed && origin) return null;
  const h = new Headers();
  h.set('access-control-allow-origin', allowed === true ? '*' : allowed || origin);
  if (cfg.credentials) h.set('access-control-allow-credentials', 'true');
  h.append('vary', 'Origin');
  return h;
}

/** @param {ExposedRoute} route @param {Request} req */
export function buildPreflightResponse(route, req) {
  const headers = corsHeadersFor(route, req);
  if (!headers) return new Response(null, { status: 403 });
  headers.set('access-control-allow-methods', `${route.method}, OPTIONS`);
  const reqHdrs =
    route.cors?.headers?.join(',') || req.headers.get('access-control-request-headers') || 'content-type';
  headers.set('access-control-allow-headers', reqHdrs);
  headers.set('access-control-max-age', String(route.cors?.maxAge ?? 86400));
  return new Response(null, { status: 204, headers });
}

/** Apply CORS headers (if any) to an existing response. */
export function withCors(resp, route, req) {
  const h = corsHeadersFor(route, req);
  if (!h) return resp;
  const newHeaders = new Headers(resp.headers);
  h.forEach((v, k) => newHeaders.set(k, v));
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: newHeaders });
}

/**
 * Match a route's configured origin policy against the request origin,
 * preserving the expose() path's historical contract: `*` returns `true`
 * (literal wildcard), an allowed concrete origin echoes back, and a
 * mismatch returns `null`. Delegates the per-rule decision to the shared
 * cors.js resolver (so RegExp + function policies work here too) but keeps
 * the wildcard-as-`true` and echo-vs-null shape this caller expects.
 *
 * @param {string|string[]|RegExp|((origin: string) => boolean)} configured
 * @param {string} origin
 * @returns {true | string | null}
 */
function matchOrigin(configured, origin) {
  if (configured === '*') return true;
  const resolved = resolveOrigin(configured, origin, false);
  if (!resolved) return null;
  return resolved.allowOrigin === '*' ? true : resolved.allowOrigin;
}

/**
 * Invoke an exposed action as a REST endpoint.
 * Builds a single object argument from URL params + query + JSON body.
 * @param {ActionIndex} idx
 * @param {ExposedRoute} route
 * @param {Record<string,string>} params
 * @param {Request} req
 * @param {(error: unknown) => void} [onError] best-effort sink (issue #239)
 *   invoked when the exposed REST handler throws unexpectedly, BEFORE the
 *   sanitized 500 is returned, so an APM integration sees the original error.
 *   The caller wraps it so a throwing sink can never affect the response.
 */
export async function invokeExposedAction(idx, route, params, req, onError) {
  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());
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
  if (route.validate) {
    // Run the validator through the SHARED contract (#245) so the REST path and
    // the RPC path interpret a `{ success, fieldErrors }` envelope, a throw, and
    // a transform-return identically. A structured failure becomes a 422 JSON
    // `{ error?, fieldErrors }` (not just a thrown 400); a throw stays a 400; a
    // transform-return keeps replacing the input (back-compat).
    const v = runValidate(route.validate, arg);
    if (!v.ok) {
      if (v.thrown !== undefined) {
        // A thrown validator (the classic `Schema.parse` style): keep the exact
        // legacy REST shape, including a schema lib's structured `issues` array.
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
  const mod = await loadModule(route.file, idx.dev);
  const fn = mod[route.fnName];
  if (typeof fn !== 'function') return new Response(`Unknown action ${route.fnName}`, { status: 404 });
  try {
    const result = await fn(arg, { req, params });
    if (result instanceof Response) return result;
    return Response.json(result ?? null);
  } catch (e) {
    if (typeof onError === 'function') onError(e);
    return actionErrorResponse(e, idx.dev);
  }
}

/**
 * Return a JSON error response with dev-vs-prod sanitization.
 * In prod we return only the error message (not the stack), and we log the
 * full error server-side. Internal errors with no message become a generic
 * 500.
 *
 * @param {unknown} err
 * @param {boolean} dev
 */
function actionErrorResponse(err, dev) {
  console.error('[webjs] action threw:', err);
  if (dev) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return rpcResponse({ error: msg, stack }, { status: 500 });
  }
  // Prod: only expose the thrown message (author-controlled), never the stack.
  const msg =
    err instanceof Error && typeof err.message === 'string' && err.message
      ? err.message
      : 'Internal server error';
  return rpcResponse({ error: msg }, { status: 500 });
}

/**
 * Convert an `expose()` path like `/api/posts/:slug` to a regex + param list.
 * Also accepts NextJs-style `[slug]` brackets for familiarity.
 * @param {string} path
 */
function pathToPattern(path) {
  const paramNames = [];
  const re = path.replace(/:([A-Za-z_][A-Za-z0-9_]*)|\[([A-Za-z_][A-Za-z0-9_]*)\]/g, (_, a, b) => {
    paramNames.push(a || b);
    return '([^/]+)';
  });
  return { pattern: new RegExp(`^${re}/?$`), paramNames };
}

/**
 * @param {string} file
 * @param {boolean} dev
 */
async function loadModule(file, dev) {
  const url = pathToFileURL(file).toString();
  const bust = dev ? `?t=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
  return import(url + bust);
}
