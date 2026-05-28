import { createServer as createHttp1Server } from 'node:http';
import { stat, readFile, watch as fsWatch } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createGzip, createBrotliCompress, constants as zlibConstants } from 'node:zlib';
import { join, extname, resolve, dirname, relative, sep } from 'node:path';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Server-side `.ts` imports are handled natively by Node 24+'s default
// type-stripping (`process.features.typescript === 'strip'`). No loader
// hook required. The browser-bound TypeScript request handler uses
// `module.stripTypeScriptTypes` for the same transform, so SSR and
// hydration produce identical JS.
//
// Runtime backing: Node ships `stripTypeScriptTypes` via the `amaro`
// package internally (wraps SWC's WASM TypeScript transform in a
// position-preserving strip-only mode). If the framework ever needs
// to run on Bun, Deno, or another runtime that does NOT expose the
// equivalent built-in, we will need to install `amaro` directly (or
// an equivalent: Sucrase preserves lines but not columns; SWC's
// strip-only also works). The fast-path `stripTs` helper would
// change one import line.
//
// Suppress the one-shot ExperimentalWarning that Node prints the
// first time `stripTypeScriptTypes` is called. The API is committed
// per Node 24's release notes; the warning is a holdover. We keep
// every other warning intact.
const _origEmitWarning = process.emitWarning.bind(process);
process.emitWarning = function (warning, type, code, ctor) {
  const msg = warning && warning.message ? warning.message : String(warning);
  if (
    (type === 'ExperimentalWarning' || (warning && warning.name === 'ExperimentalWarning')) &&
    msg.includes('stripTypeScriptTypes')
  ) {
    return;
  }
  return _origEmitWarning(warning, type, code, ctor);
};

import { buildRouteTable, matchPage, matchApi } from './router.js';
import { ssrPage, ssrNotFound } from './ssr.js';
import { handleApi } from './api.js';
import {
  buildActionIndex,
  serveActionStub,
  serveServerOnlyStub,
  invokeAction,
  matchExposedAction,
  matchAllAtPath,
  invokeExposedAction,
  buildPreflightResponse,
  withCors,
  isServerFile,
  hasUseServerDirective,
  hashFile,
} from './actions.js';
import { defaultLogger } from './logger.js';
import { withRequest } from './context.js';
import { attachWebSocket } from './websocket.js';
import { scanBareImports, resolveVendorImports, serveDownloadedBundle, clearVendorCache } from './vendor.js';
import { buildModuleGraph, transitiveDeps } from './module-graph.js';
import { primeComponentRegistry, findOrphanComponents } from './component-scanner.js';

/** PascalCase → kebab-case for a helpful diagnostic example tag name. */
function kebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
import { setVendorEntries } from './importmap.js';
import { urlFromRequest } from './forwarded.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.ts': 'application/javascript; charset=utf-8',
  '.mts': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Cache of stripped `.ts` / `.mts` source.
 * Keyed by absolute file path. Entries expire when mtime changes.
 * Capped at 500 entries to prevent unbounded memory growth in
 * long-running production servers.
 *
 * Stripper: `module.stripTypeScriptTypes` (Node 24+ built-in).
 * Position-preserving whitespace replacement. No sourcemap is
 * emitted because every (line, column) maps to itself in the source.
 *
 * Only erasable TypeScript is supported. Non-erasable syntax (`enum`,
 * `namespace` with values, parameter properties, legacy decorators
 * with `emitDecoratorMetadata`, `import = require`) throws at strip
 * time. The `erasable-typescript-only` and `no-non-erasable-typescript`
 * lint rules catch these at edit time. webjs is buildless end-to-end:
 * there is no bundler fallback.
 *
 * @type {Map<string, { mtimeMs: number, code: string, map: string | null }>}
 */
const TS_CACHE_MAX = 500;
const TS_CACHE = new Map();

/**
 * Auto-load `<appDir>/.env` into `process.env` once at boot. Mirrors
 * what Rails / Next / Astro do out of the box: a scaffolded app with
 * a committed `.env.example` and a developer-copied `.env` should
 * "just work" without the user having to add a dotenv import or set
 * the file path on the CLI.
 *
 * Uses Node 24+'s built-in `process.loadEnvFile`, which is dotenv-
 * compatible and DOES NOT override pre-existing `process.env` values.
 * Calls that hit a missing file or parse error are silenced; the
 * server should still come up cleanly when there's no `.env`.
 *
 * Idempotent: re-running is a no-op for any env var the user already
 * exported (e.g. via the host shell or a process manager). That
 * keeps the "shell-set wins over file" precedence Rails users
 * expect.
 *
 * Must run before any server-only module is loaded by
 * buildActionIndex, since module-init code in `lib/*.server.ts`
 * (e.g. `createAuth({ secret: process.env.AUTH_SECRET })`) reads
 * process.env at import time. createRequestHandler is the
 * single entry point where this is guaranteed.
 *
 * @param {string} appDir
 */
function loadAppEnv(appDir) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(join(appDir, '.env'));
    }
  } catch {
    // No .env file, malformed file, or Node version without
    // loadEnvFile. Either way, fall through silently: the user
    // may not need any env vars, or they may set them via shell.
  }
}

/**
 * Create a reusable, framework-agnostic request handler for a webjs app.
 * The returned `handle(req)` takes a standard `Request` and resolves to a
 * standard `Response`: suitable for Node http, Deno, Bun, Cloudflare Workers,
 * or embedding inside an Express/Fastify app.
 *
 * @param {{
 *   appDir: string,
 *   dev?: boolean,
 *   logger?: import('./logger.js').Logger,
 *   onReload?: () => void,
 * }} opts
 */
export async function createRequestHandler(opts) {
  const appDir = resolve(opts.appDir);
  // Load <appDir>/.env into process.env BEFORE anything else.
  // buildActionIndex below imports server-only files (lib/*.server.ts,
  // modules/**/*.server.ts), some of which read process.env at module
  // init (e.g. createAuth reads AUTH_SECRET). Without this call,
  // scaffolded apps with a committed .env.example + .env would fail
  // to boot until the user discovered the missing env-load. See
  // tracker #37.
  loadAppEnv(appDir);
  const dev = !!opts.dev;
  const logger = opts.logger || defaultLogger({ dev });
  const coreDir = locateCoreDir(appDir);

  // Scan for bare npm imports and register vendor import map entries.
  const bareImports = await scanBareImports(appDir);
  const initialVendor = await resolveVendorImports(bareImports, appDir);
  setVendorEntries(initialVendor.imports, initialVendor.integrity);

  // Build module dependency graph for transitive preload hints.
  const moduleGraph = await buildModuleGraph(appDir);

  // Scan for component classes and prime their module URLs into the
  // core registry. SSR uses this for modulepreload hints without
  // requiring authors to pass `import.meta.url` themselves.
  await primeComponentRegistry(appDir);

  // Dev-time guardrail: warn about any class extending WebComponent
  // that isn't registered via customElements.define() in its own
  // module. Without registration, <my-tag> elements silently stay as
  // HTMLUnknownElement in the browser: a common early-stage footgun.
  if (dev) {
    const orphans = await findOrphanComponents(appDir);
    for (const { className, file } of orphans) {
      logger.warn?.(
        `[webjs] ${className} extends WebComponent but has no customElements.define(...) call in ${file}. ` +
          `Add \`customElements.define('<tag-name>', ${className});\` at the bottom of the file ` +
          `or <${kebab(className)}> tags won't upgrade in the browser.`,
      );
    }
  }

  const state = {
    routeTable: await buildRouteTable(appDir),
    actionIndex: await buildActionIndex(appDir, dev),
    middleware: await loadMiddleware(appDir, dev, logger),
    logger,
    bareImports,
    moduleGraph,
  };

  // Rebuilds are serialized so a slow rebuild #1 (e.g. waiting on a
  // jspm.io fetch) cannot overwrite a fresher rebuild #2's
  // setVendorEntries / route table when it finally finishes. Without
  // this, two file edits inside one fs.watch debounce window could
  // produce a permanently-stale importmap until the next rebuild.
  // Each rebuild also gets a monotonic token; setVendorEntries is only
  // applied if its token still matches the latest scheduled rebuild.
  let rebuildInFlight = Promise.resolve();
  let latestRebuildToken = 0;

  async function rebuild() {
    const token = ++latestRebuildToken;
    rebuildInFlight = rebuildInFlight.then(() => doRebuild(token)).catch((e) => {
      logger.error?.(`[webjs] rebuild failed:`, e);
    });
    return rebuildInFlight;
  }

  async function doRebuild(token) {
    state.routeTable = await buildRouteTable(appDir);
    state.actionIndex = await buildActionIndex(appDir, dev);
    state.middleware = await loadMiddleware(appDir, dev, logger);
    // Re-scan bare imports and module graph on rebuild
    clearVendorCache();
    state.bareImports = await scanBareImports(appDir);
    const v = await resolveVendorImports(state.bareImports, appDir);
    // Defensive: if a newer rebuild has been queued while we were
    // awaiting resolveVendorImports, drop our result. The newer one
    // will overwrite anyway, but checking the token here avoids a
    // brief window of stale entries.
    if (token === latestRebuildToken) {
      setVendorEntries(v.imports, v.integrity);
    }
    state.moduleGraph = await buildModuleGraph(appDir);
    // Re-scan components in case a new file was added or a tag renamed.
    await primeComponentRegistry(appDir);
    if (dev) {
      const orphans = await findOrphanComponents(appDir);
      for (const { className, file } of orphans) {
        logger.warn?.(
          `[webjs] ${className} extends WebComponent but has no customElements.define(...) call in ${file}. ` +
            `Add \`customElements.define('<tag-name>', ${className});\` or <${kebab(className)}> tags won't upgrade.`,
        );
      }
    }
    opts.onReload?.();
  }

  /** @param {Request} req */
  function handle(req) {
    return withRequest(req, async () => {
      const next = () => handleCore(req, { state, appDir, coreDir, dev });
      if (state.middleware) {
        try {
          return await state.middleware(req, next);
        } catch (e) {
          logger.error('middleware threw', { err: String(e) });
          return new Response('Server error', { status: 500 });
        }
      }
      return next();
    });
  }

  /**
   * Lightweight lookup used by the HTTP layer to emit 103 Early Hints
   * BEFORE running SSR: resolves a pathname to its page-route module URLs
   * without loading them. Returns null for non-page paths.
   *
   * @param {string} pathname
   */
  function routeFor(pathname) {
    const page = matchPage(state.routeTable, pathname);
    if (!page) return null;
    const moduleUrls = [page.route.file, ...page.route.layouts].map((f) => {
      let rel = f.startsWith(appDir) ? f.slice(appDir.length) : f;
      return rel.split('\\').join('/').replace(/^\/?/, '/');
    });
    return { moduleUrls };
  }

  return {
    handle,
    rebuild,
    routeFor,
    /** current route table getter: used by the WebSocket subsystem */
    getRouteTable: () => state.routeTable,
    appDir,
    dev,
    logger,
  };
}

/**
 * Start a webjs HTTP server. Thin wrapper around `createRequestHandler`.
 *
 * Speaks plain HTTP/1.1. TLS termination + HTTP/2 to the browser is
 * expected to be handled by a reverse proxy (PaaS edge, nginx, Caddy,
 * etc.) sitting in front of this process. See the deployment docs for
 * the recommended topology.
 *
 * @param {{
 *   appDir: string,
 *   port?: number,
 *   dev?: boolean,
 *   compress?: boolean,
 *   logger?: import('./logger.js').Logger,
 * }} opts
 */
export async function startServer(opts) {
  const dev = !!opts.dev;
  const port = opts.port ?? 8080;
  // Compression default: on in prod, off in dev (cheaper to debug raw bytes).
  const compress = opts.compress ?? !dev;
  const logger = opts.logger || defaultLogger({ dev });

  /** @type {Set<import('node:http').ServerResponse>} */
  const sseClients = new Set();
  const app = await createRequestHandler({
    ...opts,
    logger,
    onReload: () => {
      for (const res of sseClients) {
        try { res.write(`event: reload\ndata: now\n\n`); } catch {}
      }
    },
  });

  if (dev) {
    // Watch the app root recursively via Node's built-in
    // `fs.promises.watch`. Stable on macOS, Windows, and Linux as of
    // Node 24. No external dep needed.
    //
    // fs.watch returns relative paths (POSIX separators in the
    // event payload on all platforms). We apply the same ignore
    // filter chokidar used before: skip node_modules, .git, and
    // prisma's dev artefacts (dev.db, migrations/) which the dev
    // server writes during db:migrate and would otherwise loop.
    const IGNORE = /(^|[\\/])(?:node_modules|\.git)(?:[\\/]|$)|(?:^|[\\/])prisma[\\/](?:dev|migrations)(?:[\\/]|$)/;
    const rebuild = debounce(() => app.rebuild(), 80);
    const ac = new AbortController();
    (async () => {
      try {
        const events = fsWatch(app.appDir, { recursive: true, signal: ac.signal });
        for await (const event of events) {
          const filename = event.filename || '';
          if (IGNORE.test(filename)) continue;
          rebuild();
        }
      } catch (err) {
        if (err && /** @type any */(err).name !== 'AbortError') {
          logger.warn({ err }, 'file watcher exited');
        }
      }
    })();
    // Stop watching on graceful shutdown.
    process.once('SIGTERM', () => ac.abort());
    process.once('SIGINT', () => ac.abort());
  }

  // SSE keepalive: send a comment frame every 25s to defeat proxy idle timeouts.
  // Cheap (no event listeners on the client side) and safe: comments are ignored.
  const keepalive = setInterval(() => {
    for (const res of sseClients) {
      try { res.write(`: ka\n\n`); } catch {}
    }
  }, 25_000);
  keepalive.unref();

  const server = makeHttpServer(async (req, res) => {
    try {
      const url = urlFromRequest(req);

      // SSE: handled specially; doesn't fit the req→Response model.
      if (url.pathname === '/__webjs/events') {
        if (!dev) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        res.write(`event: hello\ndata: webjs\n\n`);
        sseClients.add(res);
        res.socket?.on('close', () => sseClients.delete(res));
        return;
      }

      // 103 Early Hints: before running SSR, send preload hints for the
      // page's module URLs so the browser can begin fetching them while
      // the server is still computing the body. Skipped in dev (file churn
      // would send stale URLs after rebuilds) and for non-GET/HEAD.
      if (
        !dev &&
        (req.method === 'GET' || req.method === 'HEAD') &&
        typeof res.writeEarlyHints === 'function'
      ) {
        const match = app.routeFor(url.pathname);
        if (match && match.moduleUrls.length) {
          try {
            res.writeEarlyHints({
              link: match.moduleUrls.map((u) => `<${u}>; rel=modulepreload`),
            });
          } catch (e) {
            logger.warn('writeEarlyHints failed', { err: String(e) });
          }
        }
      }

      const webReq = toWebRequest(req, url);
      const resp = await app.handle(webReq);
      await sendWebResponse(res, resp, req, { compress });
    } catch (e) {
      logger.error('request pipeline threw', { err: e instanceof Error ? e.stack : String(e) });
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(dev && e instanceof Error ? `webjs error: ${e.stack}` : 'Internal server error');
    }
  });

  // WebSocket upgrade handling: any route.js that exports `WS` becomes a
  // WebSocket endpoint at its URL.
  attachWebSocket(server, () => app.getRouteTable(), { dev, logger });

  server.listen(port, () => {
    logger.info(`webjs ${dev ? 'dev' : 'prod'} server ready on http://localhost:${port}`);
  });

  const shutdown = gracefulShutdown(server, sseClients, logger);
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // Catch-all process handlers: log, but don't tear the process down on a
  // single mishandled promise. Uncaught exceptions are different: state may be
  // corrupted, so log + start an orderly shutdown rather than continuing.
  installProcessHandlers(logger, () => shutdown('uncaughtException'));

  return { server, close: () => new Promise((r) => server.close(() => r())) };
}

/**
 * The core request → response pipeline, minus middleware.
 * @param {Request} req
 * @param {{state: any, appDir: string, coreDir: string, dev: boolean}} ctx
 */
async function handleCore(req, ctx) {
  const { state, appDir, coreDir, dev } = ctx;
  const url = new URL(req.url);
  // Decode percent-encoded characters so filesystem lookups match real
  // filenames. Dynamic route segments like `[slug]` and route groups like
  // `(marketing)` contain chars that browsers percent-encode in URLs
  // (`%5B`, `%5D`, `%28`, `%29`). Without decoding, the server joins the
  // encoded path with the app directory → file not found → 404 → no JS
  // loads → no interactivity.
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { path = url.pathname; }
  const method = req.method.toUpperCase();

  // Health / readiness probes for orchestrators (k8s, fly, etc.)
  if (path === '/__webjs/health' || path === '/__webjs/ready') {
    return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
  }

  // Dev live-reload client
  if (path === '/__webjs/reload.js') {
    if (!dev) return new Response('Not found', { status: 404 });
    return new Response(RELOAD_CLIENT_JS, {
      headers: { 'content-type': 'application/javascript; charset=utf-8' },
    });
  }

  // Core module: /__webjs/core/*
  //
  // ETag + ~1h max-age, NOT immutable. The URL path is un-versioned
  // (`/__webjs/core/src/render-client.js` etc.), so bumping
  // `@webjsdev/core` ships different bytes at the same URL. An
  // `immutable` cache-control directive at an edge CDN (Cloudflare,
  // Vercel, Fly) keeps the prior bytes pinned for up to a year, which
  // silently bricks the next deploy: browsers load the old client
  // renderer against a server emitting the new SSR shape, and any
  // exports added in the bump (e.g., the slot.js entry points landed
  // for 0.6.0) resolve to undefined in the cached file.
  // Regression: 2026-05-20, ui.webjs.dev tier-2 components after
  // @webjsdev/core 0.5.0 -> 0.6.0 republish.
  if (path.startsWith('/__webjs/core/')) {
    const rel = path.slice('/__webjs/core/'.length);
    const abs = resolve(coreDir, rel);
    if (!abs.startsWith(coreDir)) return new Response('forbidden', { status: 403 });
    return fileResponse(abs, { dev, immutable: false });
  }

  // Vendor URL handler for `webjs vendor pin --download` mode only.
  // In default pin mode (or no-pin mode) the importmap routes bare
  // imports straight to ga.jspm.io URLs and the browser bypasses this
  // server entirely. When the user ran `webjs vendor pin --download`,
  // the importmap has local `/__webjs/vendor/<file>.js` URLs and this
  // handler serves the committed bundle files from `.webjs/vendor/`.
  if (path.startsWith('/__webjs/vendor/') && path.endsWith('.js')) {
    // Vendor bundles are read-only static content. Allow GET/HEAD for
    // the normal fetch, OPTIONS for any cross-origin preflight (we
    // return 204 with the same Allow header rather than 405, which
    // some intermediaries treat as a hard failure even for a CORS
    // probe), and 405 everything else.
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { allow: 'GET, HEAD, OPTIONS' } });
    }
    if (method !== 'GET' && method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { allow: 'GET, HEAD, OPTIONS' } });
    }
    const filename = path.slice('/__webjs/vendor/'.length);
    const resp = await serveDownloadedBundle(filename, appDir, dev);
    if (method === 'HEAD') {
      // HEAD must return same headers as GET with no body.
      return new Response(null, { status: resp.status, headers: resp.headers });
    }
    return resp;
  }

  // Internal server-action RPC endpoint
  const actMatch = /^\/__webjs\/action\/([a-f0-9]+)\/([A-Za-z0-9_$]+)$/.exec(path);
  if (actMatch) {
    if (method !== 'POST') return new Response('POST only', { status: 405 });
    return invokeAction(state.actionIndex, actMatch[1], actMatch[2], req);
  }

  // expose()d server actions (first-class REST), with optional CORS support.
  if (method === 'OPTIONS') {
    const allAtPath = matchAllAtPath(state.actionIndex, path);
    if (allAtPath.length) {
      const corsRoute = allAtPath.find((r) => r.cors);
      const methods = [...new Set(allAtPath.map((r) => r.method))];
      if (corsRoute) {
        // Preflight: respond with cors headers + the union of methods at this path.
        const preflight = buildPreflightResponse(corsRoute, req);
        const newHeaders = new Headers(preflight.headers);
        newHeaders.set('access-control-allow-methods', `${methods.join(', ')}, OPTIONS`);
        return new Response(null, { status: preflight.status, headers: newHeaders });
      }
      return new Response(null, { status: 204, headers: { allow: `${methods.join(', ')}, OPTIONS` } });
    }
  } else {
    const exposed = matchExposedAction(state.actionIndex, method, path);
    if (exposed) {
      const resp = await invokeExposedAction(state.actionIndex, exposed.route, exposed.params, req);
      return withCors(resp, exposed.route, req);
    }
  }

  // Static: /public/*
  if (path.startsWith('/public/') || path === '/favicon.ico') {
    const p = path === '/favicon.ico' ? '/public/favicon.ico' : path;
    const abs = join(appDir, p);
    // Containment check. `join` normalises `..` segments, so a path
    // like `/public/%2E%2E/secret/x.svg` decodes (after URL parsing,
    // which doesn't touch `%2E`) to `/public/../secret/x.svg` and
    // `join(appDir, ...)` resolves it to `appDir/secret/x.svg`. The
    // resulting `abs` could be inside `appDir` but OUTSIDE `appDir/
    // public/`, exposing files the user reasonably thought were
    // private under their non-public directories. Reject anything
    // that doesn't stay under `appDir/public/` (and the favicon
    // exception, which is already validated above).
    const publicRoot = join(appDir, 'public') + sep;
    if (!abs.startsWith(publicRoot)) {
      return new Response(null, { status: 404 });
    }
    if (await exists(abs)) return fileResponse(abs, { dev, immutable: false });
  }

  // User source modules (served as ES modules, with action-file rewriting)
  if (method === 'GET' && /\.(js|mjs|ts|mts|css|svg|png|jpg|jpeg|gif|webp|json|ico|txt)$/.test(path)) {
    let abs = join(appDir, path);
    // When the browser asks for `.js`, allow falling through to a sibling
    // `.ts` (the TypeScript-with-"allowImportingTsExtensions: false" pattern).
    if (!(await exists(abs)) && /\.js$/.test(abs)) {
      const tsAbs = abs.replace(/\.js$/, '.ts');
      if (await exists(tsAbs)) abs = tsAbs;
      else {
        const mtsAbs = abs.replace(/\.js$/, '.mts');
        if (await exists(mtsAbs)) abs = mtsAbs;
      }
    }
    if (abs.startsWith(appDir) && (await exists(abs))) {
      // Server-file guardrail: a file matching `.server.{js,ts,mjs,mts}`
      // MUST NEVER be served as source to the browser. The extension is
      // the path-level boundary; we re-verify it on every request (not
      // just the action-index snapshot taken at boot) so files created
      // after boot, FS races, or developer error never punch through.
      //
      // What the browser gets depends on the file's `'use server'` status:
      //   - With `'use server'` => server action: a generated RPC stub
      //     whose exports POST to /__webjs/action/:hash/:fn.
      //   - Without `'use server'` => server-only utility: a stub that
      //     throws at module load with a clear error. The file's source
      //     never reaches the browser either way.
      if (isServerFile(abs)) {
        if (await hasUseServerDirective(abs)) {
          // Lazily ensure the index knows about this file so serveActionStub
          // can mint a stable hash and function list.
          if (!state.actionIndex.fileToHash.has(abs)) {
            const h = hashFile(abs);
            state.actionIndex.fileToHash.set(abs, h);
            state.actionIndex.hashToFile.set(h, abs);
          }
          const stub = await serveActionStub(state.actionIndex, abs);
          return new Response(stub, {
            headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' },
          });
        }
        const relPath = relative(appDir, abs);
        const stub = serveServerOnlyStub(relPath);
        return new Response(stub, {
          headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' },
        });
      }
      // TypeScript source: strip types via Node 24+'s built-in, cache by mtime.
      if (/\.m?ts$/.test(abs)) {
        return tsResponse(abs, dev);
      }
      return fileResponse(abs, { dev, immutable: false });
    }
  }

  // Metadata routes: /sitemap.xml, /robots.txt, /icon, /opengraph-image, etc.
  if (method === 'GET' && state.routeTable.metadataRoutes) {
    const meta = state.routeTable.metadataRoutes.find((r) => r.urlPath === path);
    if (meta) {
      try {
        const mod = await import(pathToFileURL(meta.file).toString() + (dev ? `?t=${Date.now()}` : ''));
        if (mod.default) {
          const result = await mod.default();
          // If the function returns a Response, use it directly.
          if (result instanceof Response) return result;
          // If it returns a string, determine content type from the URL path.
          const ct = path.endsWith('.xml') ? 'application/xml; charset=utf-8'
            : path.endsWith('.txt') ? 'text/plain; charset=utf-8'
            : path.endsWith('.json') ? 'application/json; charset=utf-8'
            : 'application/octet-stream';
          return new Response(typeof result === 'string' ? result : JSON.stringify(result), {
            headers: { 'content-type': ct, 'cache-control': dev ? 'no-cache' : 'public, max-age=3600' },
          });
        }
      } catch (e) {
        if (dev) console.error(`[webjs] metadata route error (${meta.stem}):`, e);
        return new Response('Internal error', { status: 500 });
      }
    }
  }

  // API route (route.js handler)
  const api = matchApi(state.routeTable, path);
  if (api) {
    const handler = () => handleApi(api.route, api.params, req, dev);
    return runWithSegmentMiddleware(req, api.route.middlewares, handler, dev);
  }

  // Page route (only for GET/HEAD)
  if (method === 'GET' || method === 'HEAD') {
    const page = matchPage(state.routeTable, path);
    if (page) {
      const handler = () => ssrPage(page.route, page.params, url, {
        dev, appDir, req, moduleGraph: state.moduleGraph,
        serverFiles: state.actionIndex.fileToHash,
      });
      return runWithSegmentMiddleware(req, page.route.middlewares, handler, dev);
    }
  }

  // Fallback: content-negotiated 404
  if (wantsJson(req, path)) {
    return Response.json({ error: 'Not found', path }, { status: 404 });
  }
  return ssrNotFound(state.routeTable.notFound, { dev, appDir, req, url });
}

/** @param {Request} req @param {string} path */
function wantsJson(req, path) {
  const accept = req.headers.get('accept') || '';
  if (accept.includes('application/json') && !accept.includes('text/html')) return true;
  if (path.startsWith('/api/') || path.startsWith('/__webjs/')) return true;
  return false;
}

/**
 * Chain segment-level middleware.js (outermost first) around a handler.
 * Each middleware is `(req, next) => Response`. If any throws, log and 500.
 *
 * @param {Request} req
 * @param {string[]} files   absolute paths of middleware.js files, outermost → innermost
 * @param {() => Promise<Response>} terminal
 * @param {boolean} dev
 */
async function runWithSegmentMiddleware(req, files, terminal, dev) {
  if (!files || !files.length) return terminal();
  const handlers = [];
  for (const f of files) {
    try {
      const url = pathToFileURL(f).toString();
      const bust = dev ? `?t=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
      const mod = await import(url + bust);
      if (typeof mod.default === 'function') handlers.push(mod.default);
    } catch {
      // Bad middleware file: skip; top-level error handler will catch real problems.
    }
  }
  let i = 0;
  const next = () => {
    if (i >= handlers.length) return terminal();
    const fn = handlers[i++];
    return fn(req, next);
  };
  return next();
}

/**
 * Load the optional top-level `middleware.js`.
 * @param {string} appDir
 * @param {boolean} dev
 * @param {import('./logger.js').Logger} logger
 */
async function loadMiddleware(appDir, dev, logger) {
  const file = join(appDir, 'middleware.js');
  if (!(await exists(file))) return null;
  const url = pathToFileURL(file).toString();
  const bust = dev ? `?t=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
  try {
    const mod = await import(url + bust);
    return typeof mod.default === 'function' ? mod.default : null;
  } catch (e) {
    logger.error('failed to load middleware.js', { err: String(e) });
    return null;
  }
}

/**
 * Install signal handlers that stop accepting new connections, close SSE
 * clients, and exit once in-flight requests drain.
 * @param {import('node:http').Server} server
 * @param {Set<import('node:http').ServerResponse>} sseClients
 * @param {import('./logger.js').Logger} logger
 */
/**
 * Create a plain HTTP/1.1 server. webjs deploys are expected to sit
 * behind a reverse proxy (PaaS edge, nginx, Caddy, etc.) that handles
 * TLS termination and speaks HTTP/2 to clients: Node's http2 module
 * doesn't need to be involved on the framework side.
 *
 * @param {(req: any, res: any) => void} handler
 */
function makeHttpServer(handler) {
  return createHttp1Server(handler);
}

/**
 * Install once-only process error handlers. Idempotent across multiple
 * `startServer` calls in the same process.
 *
 * @param {import('./logger.js').Logger} logger
 * @param {() => void} onFatal
 */
function installProcessHandlers(logger, onFatal) {
  if (/** @type any */ (globalThis).__webjsProcHandlers) return;
  /** @type any */ (globalThis).__webjsProcHandlers = true;
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection', {
      err: reason instanceof Error ? reason.stack || reason.message : String(reason),
    });
  });
  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException', { err: err.stack || err.message });
    // Begin orderly shutdown; process state may be corrupt.
    try { onFatal(); } catch {}
  });
}

function gracefulShutdown(server, sseClients, logger) {
  let shuttingDown = false;
  return (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`received ${signal}, shutting down`);
    for (const res of sseClients) {
      try { res.end(); } catch {}
    }
    sseClients.clear();
    server.close((err) => {
      if (err) {
        logger.error('server close error', { err: String(err) });
        process.exit(1);
      }
      logger.info('bye');
      process.exit(0);
    });
    // Hard-fail after 10s if we can't drain.
    setTimeout(() => {
      logger.warn('shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000).unref();
  };
}

/* ------------ helpers ------------ */

/** @param {import('node:http').IncomingMessage} req @param {URL} url */
function toWebRequest(req, url) {
  const method = (req.method || 'GET').toUpperCase();
  /** @type {Record<string,string>} */
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    // Drop HTTP/2 pseudo-headers (`:method`, `:path`, `:scheme`, `:authority`) -
    // they're parsed separately into req.method / req.url and are rejected
    // by the standard Headers class if we pass them through verbatim.
    if (k.startsWith(':')) continue;
    headers[k] = Array.isArray(v) ? v.join(',') : String(v ?? '');
  }
  let body;
  if (method !== 'GET' && method !== 'HEAD') {
    body = new ReadableStream({
      start(controller) {
        req.on('data', (chunk) => controller.enqueue(chunk));
        req.on('end', () => controller.close());
        req.on('error', (e) => controller.error(e));
      },
    });
  }
  return new Request(url, /** @type any */ ({ method, headers, body, duplex: 'half' }));
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {Response} webRes
 * @param {import('node:http').IncomingMessage} [req]
 * @param {{ compress?: boolean }} [opts]
 */
async function sendWebResponse(res, webRes, req, opts) {
  /** @type {Record<string,string | string[]>} */
  const headers = {};
  // Preserve multi-value headers (Set-Cookie) via getSetCookie when available.
  if (typeof /** @type any */ (webRes.headers).getSetCookie === 'function') {
    const cookies = /** @type any */ (webRes.headers).getSetCookie();
    if (cookies.length) headers['set-cookie'] = cookies;
  }
  webRes.headers.forEach((v, k) => {
    if (k === 'set-cookie') return;
    headers[k] = v;
  });

  // Negotiate compression.
  let compressor = null;
  if (opts?.compress && req && webRes.body && isCompressible(headers['content-type'])) {
    const accept = String(req.headers['accept-encoding'] || '');
    if (/(?:^|,\s*)br(?:;|,|$)/.test(accept)) {
      compressor = createBrotliCompress({
        params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
      });
      headers['content-encoding'] = 'br';
    } else if (/(?:^|,\s*)gzip(?:;|,|$)/.test(accept)) {
      compressor = createGzip({ level: 6 });
      headers['content-encoding'] = 'gzip';
    }
    if (compressor) {
      headers['vary'] = 'Accept-Encoding';
      delete headers['content-length'];
    }
  }

  res.writeHead(webRes.status, headers);
  if (!webRes.body) { res.end(); return; }

  if (compressor) {
    compressor.pipe(res);
    const reader = webRes.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        compressor.write(value);
      }
    } finally {
      compressor.end();
    }
    return;
  }

  const reader = webRes.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

/** @param {string | string[] | undefined} contentType */
function isCompressible(contentType) {
  if (!contentType) return false;
  const ct = Array.isArray(contentType) ? contentType[0] : contentType;
  return /^(?:text\/|application\/(?:javascript|json|xml|wasm|manifest)|image\/svg\+xml)/i.test(ct);
}

/**
 * Read a file and return a Response with appropriate caching.
 * Dev: no-cache (always revalidate).
 * Prod: ETag + ~1h max-age for user files; `immutable` bumps to 1 year.
 *
 * @param {string} abs
 * @param {{ dev: boolean, immutable: boolean }} opts
 */
async function fileResponse(abs, opts) {
  try {
    const data = await readFile(abs);
    const type = MIME[extname(abs).toLowerCase()] || 'application/octet-stream';
    const headers = { 'content-type': type };
    if (opts.dev) {
      headers['cache-control'] = 'no-cache';
    } else {
      const etag = `"${createHash('sha1').update(data).digest('hex').slice(0, 16)}"`;
      headers['etag'] = etag;
      headers['cache-control'] = opts.immutable
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600';
    }
    return new Response(data, { status: 200, headers });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

/**
 * Strip TypeScript types from `source` via Node's built-in
 * `module.stripTypeScriptTypes`. Position-preserving whitespace
 * replacement: no sourcemap is needed because every (line, column)
 * maps to itself in the source.
 *
 * Only erasable TypeScript is supported. Non-erasable syntax
 * (`enum`, `namespace` with values, parameter properties, legacy
 * decorators with `emitDecoratorMetadata`, `import = require`)
 * throws `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` from Node and the
 * dev server returns the error to the caller. The
 * `erasable-typescript-only` and `no-non-erasable-typescript` lint
 * rules catch these at edit time. There is no bundler fallback;
 * webjs is buildless end-to-end.
 *
 * @param {string} source
 * @param {string} _abs  (unused; preserved for symmetry with prior signature)
 * @returns {Promise<string>}
 */
async function stripTs(source, _abs) {
  return stripTypeScriptTypes(source);
}

/**
 * Serve a `.ts` / `.mts` source file as JavaScript via {@link stripTs}.
 * Result is cached by mtime so subsequent requests are instant; a
 * file edit invalidates naturally.
 *
 * @param {string} abs
 * @param {boolean} dev
 */
async function tsResponse(abs, dev) {
  const st = await stat(abs);
  const cached = TS_CACHE.get(abs);
  if (cached && cached.mtimeMs === st.mtimeMs) {
    return new Response(cached.code, {
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': dev ? 'no-cache' : 'public, max-age=3600',
      },
    });
  }
  const source = await readFile(abs, 'utf8');
  let code;
  try {
    code = await stripTs(source, abs);
  } catch (err) {
    // Node's stripTypeScriptTypes throws ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX
    // for enum, namespace with values, parameter properties, legacy
    // decorators with emitDecoratorMetadata, and import = require.
    // Return a clean 500 with the file path and a pointer at the
    // erasable-typescript-only lint rule rather than letting the
    // error bubble up unstyled.
    if (err && err.code === 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX') {
      // Log full detail server-side regardless of mode so operators
      // see what went wrong in their logs.
      // eslint-disable-next-line no-console
      console.error(`[webjs] non-erasable TypeScript in ${abs}: ${err.message}`);
      const msg = dev
        // Dev: include the file path and Node's error message so the
        // developer's browser tooling can point them at the offending
        // construct. Replace `*` + `/` with `*\\/` so a path or
        // message containing the comment-close sequence cannot
        // terminate the wrapper comment early.
        ? `[webjs] non-erasable TypeScript in ${abs}: ${err.message}\n\n` +
          `webjs is buildless: only erasable TS syntax is supported. ` +
          `Replace enum / namespace / parameter-property / legacy-decorator / ` +
          `import = require constructs with their erasable equivalents. ` +
          `Run \`webjs check\` for guidance (no-non-erasable-typescript rule).`
        // Prod: terse, no path leak, no Node-message leak (Node's
        // message can include source snippets). Operators get the
        // detail in server logs above.
        : `[webjs] server error transforming a .ts response. Check server logs.`;
      return new Response(`/* ${msg.replace(/\*\//g, '*\\/')} */`, {
        status: 500,
        headers: { 'content-type': 'application/javascript; charset=utf-8' },
      });
    }
    throw err;
  }
  // Evict oldest entry if cache is full (simple FIFO: Map preserves insertion order).
  if (TS_CACHE.size >= TS_CACHE_MAX) {
    const oldest = TS_CACHE.keys().next().value;
    TS_CACHE.delete(oldest);
  }
  TS_CACHE.set(abs, { mtimeMs: st.mtimeMs, code, map: null });
  return new Response(code, {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': dev ? 'no-cache' : 'public, max-age=3600',
    },
  });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Find the absolute directory of the `@webjsdev/core` package, regardless of
 * whether we're running from the monorepo or an installed copy.
 * @param {string} appDir
 */
function locateCoreDir(appDir) {
  try {
    const require = createRequire(join(appDir, 'package.json'));
    const pkgPath = require.resolve('@webjsdev/core/package.json');
    return dirname(pkgPath);
  } catch {}
  const here = fileURLToPath(import.meta.url);
  return resolve(here, '..', '..', '..', 'core');
}

/**
 * Find an npm package's installed root folder in the app's node_modules graph.
 * @param {string} appDir
 * @param {string} pkgName
 * @returns {string | null}
 */
function locatePackageDir(appDir, pkgName) {
  // Many packages lock down `./package.json` in their exports field, so we
  // resolve the bare specifier (always exported) and trim back to the
  // folder named pkgName.
  const match = '/node_modules/' + pkgName + '/';
  const tryFrom = (from) => {
    const require = createRequire(from);
    const entry = require.resolve(pkgName).split(sep).join('/');
    const at = entry.lastIndexOf(match);
    if (at < 0) return null;
    return entry.slice(0, at + match.length - 1).split('/').join(sep);
  };
  try { const d = tryFrom(join(appDir, 'package.json')); if (d) return d; } catch {}
  try { const d = tryFrom(fileURLToPath(import.meta.url)); if (d) return d; } catch {}
  return null;
}

const RELOAD_CLIENT_JS = `// webjs dev reload client
const es = new EventSource('/__webjs/events');
es.addEventListener('reload', () => location.reload());
`;
