import { digestHex } from './crypto-utils.js';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { getExposed } from '@webjsdev/core';
import { walk } from './fs-walk.js';
import { verify as verifyCsrf, CSRF_COOKIE, CSRF_HEADER } from './csrf.js';
import { getSerializer } from './serializer.js';

/**
 * Internal RPC wire-format content type. Distinguishes webjs action
 * responses from plain `application/json` so the stub can pick the right
 * parser and external JSON consumers aren't confused.
 *
 * Uses the content type from the active serializer (defaults to
 * `application/vnd.webjs+json` with the built-in webjs serializer).
 */
export const RPC_CONTENT_TYPE = 'application/vnd.webjs+json';

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
 * @returns {Promise<ActionIndex>}
 */
export async function buildActionIndex(appDir, dev) {
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
    // fetch), so the hash index above is all that boot needs. Running every
    // server module at boot (and its transitive Prisma init, DB connects, etc.)
    // is wasted work. The one thing that DOES need eager loading is expose(),
    // which registers a REST route the router must know before any request can
    // hit it. So load only files that REFERENCE expose. We match the bare
    // `expose` identifier (not `expose(`) so an aliased import
    // (`import { expose as exp }`, whose import clause still names `expose`) is
    // not missed: missing it would silently 404 that file's REST route. A stray
    // mention in a comment or string only over-matches, costing one harmless
    // extra module load; the common pure-RPC file never names `expose` and so
    // still defers entirely.
    let src = '';
    try { src = await readFile(file, 'utf8'); } catch {}
    if (!/\bexpose\b/.test(src)) continue;
    try {
      const mod = await loadModule(file, dev);
      for (const [name, fn] of Object.entries(mod)) {
        if (typeof fn !== 'function') continue;
        const http = getExposed(fn);
        if (!http) continue;
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
    `or wrap the server-only logic in a separate *.server.{js,ts} action and import that instead.`;
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
  const fnNames = Object.keys(mod).filter((k) => typeof mod[k] === 'function');
  if (typeof mod.default === 'function' && !fnNames.includes('default')) {
    fnNames.push('default');
  }
  const body = `// webjs: generated server-action stub for ${relative(idx.appDir, absFile)}\n` +
    `import { stringify as __wjStringify, parse as __wjParse } from '@webjsdev/core';\n` +
    `function __csrf() {\n` +
    `  const m = document.cookie.match(/(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)/);\n` +
    `  return m ? decodeURIComponent(m[1]) : '';\n` +
    `}\n` +
    `async function __rpc(fn, args) {\n` +
    `  const body = await __wjStringify(args);\n` +
    `  const res = await fetch(${JSON.stringify(`/__webjs/action/${hash}/`)} + fn, {\n` +
    `    method: 'POST',\n` +
    `    headers: {\n` +
    `      'content-type': ${JSON.stringify(RPC_CONTENT_TYPE)},\n` +
    `      ${JSON.stringify(CSRF_HEADER)}: __csrf()\n` +
    `    },\n` +
    `    credentials: 'same-origin',\n` +
    `    body\n` +
    `  });\n` +
    `  const ct = res.headers.get('content-type') || '';\n` +
    `  const text = await res.text();\n` +
    `  const parsed = ct.includes(${JSON.stringify(RPC_CONTENT_TYPE)})\n` +
    `    ? __wjParse(text)\n` +
    `    : (ct.includes('application/json') ? JSON.parse(text) : text);\n` +
    `  if (!res.ok) {\n` +
    `    const msg = (parsed && parsed.error) || ('webjs action ' + fn + ' -> ' + res.status);\n` +
    `    throw new Error(msg);\n` +
    `  }\n` +
    `  return parsed;\n` +
    `}\n` +
    fnNames
      .map((name) =>
        name === 'default'
          ? `export default (...args) => __rpc('default', args);`
          : `export const ${name} = (...args) => __rpc(${JSON.stringify(name)}, args);`
      )
      .join('\n') + '\n';
  return body;
}

/**
 * Invoke a server action via the internal RPC wire format.
 * @param {ActionIndex} idx
 * @param {string} hash
 * @param {string} fnName
 * @param {Request} req
 */
export async function invokeAction(idx, hash, fnName, req) {
  if (!verifyCsrf(req)) {
    return rpcResponse({ error: 'CSRF validation failed' }, { status: 403 });
  }
  const file = idx.hashToFile.get(hash);
  if (!file) return rpcResponse({ error: 'Unknown action' }, { status: 404 });
  let args = [];
  try {
    const body = await req.text();
    args = body ? getSerializer().deserialize(body) : [];
    if (!Array.isArray(args)) args = [args];
  } catch {
    return rpcResponse({ error: 'Invalid request body' }, { status: 400 });
  }
  const mod = await loadModule(file, idx.dev);
  const fn = fnName === 'default' ? mod.default : mod[fnName];
  if (typeof fn !== 'function') return rpcResponse({ error: `Unknown action ${fnName}` }, { status: 404 });
  try {
    const result = await fn(...args);
    return rpcResponse(result ?? null);
  } catch (e) {
    return actionErrorResponse(e, idx.dev);
  }
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

/** @param {string|string[]} configured @param {string} origin */
function matchOrigin(configured, origin) {
  if (configured === '*') return true;
  if (Array.isArray(configured)) return configured.includes(origin) ? origin : null;
  return configured === origin ? origin : null;
}

/**
 * Invoke an exposed action as a REST endpoint.
 * Builds a single object argument from URL params + query + JSON body.
 * @param {ActionIndex} idx
 * @param {ExposedRoute} route
 * @param {Record<string,string>} params
 * @param {Request} req
 */
export async function invokeExposedAction(idx, route, params, req) {
  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());
  let body = {};
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const text = await req.text();
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
    try {
      arg = route.validate(arg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Many schema libs (zod, valibot) throw structured errors: pass their
      // `issues` array through when present for easier client-side handling.
      const issues = e && typeof e === 'object' && 'issues' in e
        ? /** @type any */ (e).issues
        : undefined;
      return Response.json({ error: msg, issues }, { status: 400 });
    }
  }
  const mod = await loadModule(route.file, idx.dev);
  const fn = mod[route.fnName];
  if (typeof fn !== 'function') return new Response(`Unknown action ${route.fnName}`, { status: 404 });
  try {
    const result = await fn(arg, { req, params });
    if (result instanceof Response) return result;
    return Response.json(result ?? null);
  } catch (e) {
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
