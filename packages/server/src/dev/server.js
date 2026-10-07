import { existsSync, readFileSync } from 'node:fs';
import { strongerVerdict } from '../dev-classify.js';
import { watchTree } from './watch-tree.js';
import { relative, resolve } from 'node:path';
import {
  hotRerunCapable, hotHostKey, getHotHost, setHotHost, deleteHotHost,
  armHotSentinel, pokeHotSentinel, removeHotSentinel, needsHotReset, announceHotInPlace,
} from './hot-host.js';
import { createServer as createHttp1Server } from 'node:http';
import { createRequestHandler } from './handler.js';
import { readServerTimeoutsFromApp, readDevWatchPathsFromApp } from './config.js';
import { defaultLogger } from '../logger.js';
import { SseHub, makeShutdown, installProcessHandlers, serverRuntime, DEV_BOOT_ID } from '../listener-core.js';
import { setDevReloadState } from '../dev-reload-state.js';
import { urlFromRequest } from '../forwarded.js';
import { stripBasePath } from '../base-path.js';
import { basePath } from '../importmap.js';
import { attachWebSocket } from '../websocket.js';
import { toWebRequest, sendWebResponse } from './helpers.js';
import { isAddrInUse, portInUseError, reusePortRequested } from '../port-in-use.js';

/** This copy of `@webjsdev/server`'s version, so a hot re-run can tell the framework itself changed. */
const SERVER_VERSION = (() => {
  try { return JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version || ''; } catch { return ''; }
})();

/**
 * How long a poked re-run (#1575) may take before the dev server stops waiting
 * for it and rebuilds anyway, so an edit is never lost to a sentinel `bun --hot`
 * did not see.
 */
const POKE_FALLBACK_MS = 1500;

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Start a WebJs HTTP server. Thin wrapper around `createRequestHandler`.
 *
 * Speaks plain HTTP/1.1. TLS termination + HTTP/2 to the browser is
 * expected to be handled by a reverse proxy (PaaS edge, nginx, Caddy,
 * etc.) sitting in front of this process. See the deployment docs for
 * the recommended topology.
 *
/**
 * Paths under the app root whose changes must NOT trigger a dev rebuild.
 * `node_modules` / `.git` are noise. `.webjs/` is the framework's generated
 * artefact dir (the #258 routes.d.ts and the vendor pin) that the dev server
 * itself writes on startup and on every rebuild, so without this skip the
 * write fires a watch event, triggers a rebuild, re-writes the file, and loops
 * forever. `db/dev.db*` (the SQLite file + sidecars) and `db/migrations`
 * (drizzle-kit output) churn during db:migrate. The `db/dev.db` branch is
 * prefix-only (no trailing separator) so the `-journal` / `-wal` sidecars match
 * too, while staying anchored to `db/dev.db` so a SOURCE file like
 * `db/schema.server.ts` still triggers a reload. The others stay
 * separator-anchored so an unrelated name like `node_modules.bak/foo` does not.
 *
 * @param {string} filename relative path from an fs.watch `event.filename`
 * @returns {boolean} true when the change should be ignored
 */
export function shouldIgnoreWatchPath(filename) {
  return /(?:^|[\\/])(?:node_modules|\.git|\.webjs)(?:[\\/]|$)|(?:^|[\\/])db[\\/](?:dev\.db|migrations)/.test(filename || '');
}

/**
 * Install signal handlers that stop accepting new connections, close SSE
 * clients, and exit once in-flight requests drain.
 * @param {import('node:http').Server} server
 * @param {Set<import('node:http').ServerResponse>} sseClients
 * @param {import('../logger.js').Logger} logger
 */
/**
 * Create a plain HTTP/1.1 server. WebJs deploys are expected to sit
 * behind a reverse proxy (PaaS edge, nginx, Caddy, etc.) that handles
 * TLS termination and speaks HTTP/2 to clients: Node's http2 module
 * doesn't need to be involved on the framework side.
 *
 * @param {(req: any, res: any) => void} handler
 */
function makeHttpServer(handler) {
  return createHttp1Server(handler);
}

/* ------------ helpers ------------ */

/**
 * The node:http listener shell: the original `startServer` socket path, now
 * reading the shared `ListenerContext`. Bridges node `IncomingMessage` ->
 * `Request` (`toWebRequest`) and `Response` -> `ServerResponse`
 * (`sendWebResponse`), emits 103 Early Hints, and drives SSE + WS over node
 * primitives, sharing the SSE registry + lifecycle wiring with the Bun shell.
 * @param {import('../listener-types.js').ListenerContext} ctx
 * @returns {{ server: import('node:http').Server, close: () => Promise<void> }}
 */
async function startNodeListener(ctx) {
  const { app, dev, compress, logger, hub, port, basePathStr, timeouts, watcherAbort } = ctx;

  const server = makeHttpServer(async (req, res) => {
    try {
      const url = urlFromRequest(req);

      // SSE: handled specially; doesn't fit the req→Response model. Match the
      // base-path-stripped pathname so the reload stream answers at
      // `<basePath>/__webjs/events` under a sub-path deploy (#256). With no
      // basePath this is a pure pass-through (the bare path still matches).
      if (stripBasePath(url.pathname, basePathStr) === '/__webjs/events') {
        if (!dev) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        // `retry: 300` shrinks the browser's EventSource reconnect backoff from
        // its ~3s default so a reconnect after a `node --watch` restart happens
        // promptly. The `hello` data is a per-process boot id (#893): the client
        // reloads on a reconnect ONLY when it changes (a real restart), so a
        // transient reconnect never triggers a spurious reload.
        res.write(hub.helloFrame());
        // The stream is silent between events (#1507), so no socket timeout may
        // reap it. node:http sets none by default, but an inherited or future
        // one would close a live reload stream that is simply quiet, so it is
        // switched off for this request alone.
        req.setTimeout?.(0);
        res.setTimeout?.(0);
        // Register a node client wrapper in the shared hub: the fanout lives in
        // SseHub; only the transport write (res.write / res.end) is local.
        const client = {
          send: (s) => { try { res.write(s); } catch {} },
          close: () => { try { res.end(); } catch {} },
        };
        hub.add(client);
        // Replay an unresolved dev error (#264) so a tab that connects AFTER the
        // breaking edit (e.g. opened via a fresh navigation) still shows the
        // overlay, not only the tab that was open when the error fired.
        const pending = app.getLastDevError?.();
        if (pending) {
          try { res.write(`event: webjs-error\ndata: ${JSON.stringify(pending)}\n\n`); } catch {}
        }
        res.socket?.on('close', () => hub.remove(client));
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

  // node:http built-in timeouts: `requestTimeout` bounds the time to receive the
  // WHOLE request, `headersTimeout` just the headers (kept strictly under
  // requestTimeout so it actually fires), `keepAliveTimeout` the idle window
  // before a kept-alive socket is closed.
  server.requestTimeout = timeouts.requestTimeout;
  server.headersTimeout = timeouts.headersTimeout;
  server.keepAliveTimeout = timeouts.keepAliveTimeout;

  // WebSocket upgrade handling: any route.js that exports `WS` becomes a
  // WebSocket endpoint at its URL.
  attachWebSocket(server, () => app.getRouteTable(), { dev, logger });

  // Listening is awaited, so a bind failure rejects startServer instead of
  // surfacing as an unhandled 'error' event. A taken port fails fast with the
  // holder named (#1527); WEBJS_REUSE_PORT=1 shares the port on purpose
  // (SO_REUSEPORT, honoured on Linux by Node 22.12+ / 23.1+).
  await new Promise((resolve, reject) => {
    const onError = (/** @type {NodeJS.ErrnoException} */ e) => reject(isAddrInUse(e) ? portInUseError(port, e) : e);
    server.once('error', onError);
    const options = reusePortRequested() ? { port, reusePort: true } : { port };
    server.listen(options, () => {
      server.off('error', onError);
      resolve(undefined);
    });
  });
  logger.info(`webjs ${dev ? 'dev' : 'prod'} server ready on http://localhost:${port}`);
  // The server is now accepting connections; warm the first-request analysis
  // in the background so a real first request finds it memoized. Fire-and-
  // forget: listening (and thus readiness probes / load-balancer health) does
  // not wait on it, and a failure here does not bring the process down.
  app.warmup();

  const closeServer = () => new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve(undefined)));
  });
  const shutdown = makeShutdown({ closeServer, hub, logger });
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // Catch-all process handlers: log, but don't tear the process down on a
  // single mishandled promise. Uncaught exceptions are different: state may be
  // corrupted, so log + start an orderly shutdown rather than continuing.
  installProcessHandlers(logger, () => shutdown('uncaughtException', { fatal: true }), { dev });

  return {
    server,
    close: () => new Promise((r) => {
      if (watcherAbort) watcherAbort.abort();
      // Close every open live-reload stream.
      hub.closeAll();
      server.close(() => r());
    }),
  };
}

/**
 * The core request → response pipeline, minus middleware.
 * @param {Request} req
 * @param {{state: any, appDir: string, coreDir: string, dev: boolean}} ctx
 */
/**
 * @param {{
 *   appDir: string,
 *   port?: number,
 *   dev?: boolean,
 *   compress?: boolean,
 *   logger?: import('../logger.js').Logger,
 *   onError?: (error: unknown, ctx: { request: Request, requestId: string|null, phase: string }) => void,
 * }} opts
 */
export async function startServer(opts) {
  const dev = !!opts.dev;
  const port = opts.port ?? 8080;
  // Compression default: on in prod, off in dev (cheaper to debug raw bytes).
  const compress = opts.compress ?? !dev;
  const logger = opts.logger || defaultLogger({ dev });

  // `bun --hot` re-runs the CLI, and so this function, on every edit to a
  // module it loaded (#1575). The first run owns the process; a later one only
  // tells it the module registry was reset. See dev/hot-host.js.
  const hotKey = dev && hotRerunCapable() ? hotHostKey(resolve(opts.appDir), port) : null;
  const host = hotKey ? getHotHost(hotKey) : undefined;
  if (host) {
    if (host.version !== SERVER_VERSION) {
      // The framework itself changed under a running dev server (an upgrade).
      // Its first-run code cannot load the new copy in place, so exit and let
      // the `webjs dev` supervisor start a fresh process on the new version.
      logger.warn(`[webjs] @webjsdev/server changed (${host.version || '?'} -> ${SERVER_VERSION || '?'}), restarting the dev server`);
      if (process.env.__WEBJS_DEV_CHILD === '1') process.exit(0);
    }
    return /** @type {any} */ (await host.rerun());
  }

  // Runtime-neutral SSE registry + fanout (shared by the node:http and Bun.serve
  // shells via listener-core.js, so live-reload + the dev error overlay behave
  // identically on both). Built before the handler so its onReload / onDevError
  // callbacks can fan out through it.
  // A Bun hot host, or a server outside the dev supervisor (`--no-hot`, an
  // embedder), applies an edit in place; a supervised Node child is restarted.
  const hub = new SseHub({ inPlace: dev && (!!hotKey || process.env.__WEBJS_DEV_CHILD !== '1') });
  // Pages render the stream's state into a meta tag (#1516), so the relay can
  // re-check a page against the server on every reconnect.
  if (dev) setDevReloadState(() => ({ boot: DEV_BOOT_ID, seq: hub.seq }));
  let app;
  try {
    app = await createRequestHandler({
      ...opts,
      logger,
      onReload: (verdict) => hub.reload(verdict),
      // Dev error overlay (#264): push a frame to every open tab over the SAME
      // SSE channel. A distinct `webjs-error` event name (NOT `error`, which is
      // EventSource's native connection-error event) carries the JSON frame.
      onDevError: (frame) => hub.devError(frame),
    });
  } catch (e) {
    hub.closeAll();
    throw e;
  }

  /** @type {AbortController | null} */
  let watcherAbort = null;
  /** The strongest verdict of the edits a poked re-run has yet to apply. */
  /** @type {import('../dev-classify.js').ReloadVerdict | null} */
  let pokedVerdict = null;
  /** @type {any} */ let pokeFallback = null;
  if (dev) {
    // Watch the app tree with Node's built-in `fs.watch` (no external dep):
    // `watchTree` (#1521) watches the root plus each non-ignored top-level dir,
    // so `node_modules` is never walked, and handles a per-path watch error
    // (EACCES, ENOENT) with a warning instead of an uncaughtException.
    //
    // Paths are reported relative to the watched root. `shouldIgnoreWatchPath`
    // (module-level, exported for tests) skips node_modules, .git, .webjs/, and
    // the SQLite dev DB (db/dev.db) + db/migrations so a file the dev server itself writes never loops.
    // Live-reload classification (#1398). Several files can change inside one
    // 50ms debounce window (80ms before #1575), so hold the STRONGEST verdict of the window and
    // hand it to the rebuild. Same rule as the browser relay's cross-batch
    // accumulation, for the same reason: a window mixing a page edit and a
    // component edit is a component edit, and taking the last one would morph
    // fresh markup onto the old component class.
    /** @type {import('../dev-classify.js').ReloadVerdict | null} */
    let pendingVerdict = null;
    // Under `bun --hot`, a window that changed a module a `Bun.plugin` serves
    // pokes the re-run sentinel instead of rebuilding (#1575): the rebuild has
    // to wait for the registry reset, or the next request would still import
    // the stale module. The re-run (`hotRerun` below) rebuilds with the verdict.
    let pendingPoke = false;
    const rebuild = debounce(() => {
      const v = pendingVerdict;
      pendingVerdict = null;
      if (pendingPoke) {
        pendingPoke = false;
        pokedVerdict = strongerVerdict(pokedVerdict, v);
        pokeHotSentinel(app.appDir);
        clearTimeout(pokeFallback);
        pokeFallback = setTimeout(() => {
          const pv = pokedVerdict;
          pokedVerdict = null;
          if (pv) app.rebuild(pv);
        }, POKE_FALLBACK_MS);
        return;
      }
      app.rebuild(v || undefined);
    }, 50);
    watcherAbort = new AbortController();
    // One warning per unwatchable path (#1521): an EACCES / ENOENT on a single
    // file must never stop the dev server, and a burst of the same temp file
    // must not flood the log either.
    const warned = new Set();
    const onWatchError = (err) => {
      const key = `${err && err.code}:${err && err.path}`;
      if (warned.has(key) || warned.size > 200) return;
      warned.add(key);
      logger.warn(`file watcher skipped ${err && err.path ? err.path : 'a path'} (${err && err.code ? err.code : String(err)})`);
    };
    const watchRoot = (root) => {
      const close = watchTree(root, {
        ignore: shouldIgnoreWatchPath,
        onEvent: (filename) => {
          // A regenerate output (#967) is a build product the server itself
          // writes on request; ignoring it stops a spurious rebuild + reload
          // (and a reload -> refetch -> recompile -> reload cycle), same as the
          // db/dev.db carve-out above. `app` exposes the check because `state`
          // lives in createRequestHandler's scope, not here.
          if (app.isRegenerateOutput(filename)) return;
          pendingVerdict = strongerVerdict(pendingVerdict, app.classifyWatchPath(filename, root));
          if (hotKey && needsHotReset(filename, (f) => !app.needsRegistryReset(f, root))) pendingPoke = true;
          rebuild();
        },
        onError: onWatchError,
      });
      watcherAbort.signal.addEventListener('abort', close, { once: true });
    };
    watchRoot(app.appDir);
    // Extra roots the app reads from OUTSIDE its appDir (#894): repo-root content
    // dirs (blog markdown, data fixtures) the recursive appDir watch can't see.
    // Opt-in via `webjs.dev.watch`; each funnels into the same debounced rebuild.
    const extraWatch = (await readDevWatchPathsFromApp(app.appDir)).filter((p) => existsSync(p));
    for (const root of extraWatch) watchRoot(root);
    if (extraWatch.length) logger.info?.(`[webjs] also watching ${extraWatch.length} extra dev path(s): ${extraWatch.join(', ')}`);
  }

  // Inbound server timeouts (issue #237). On node these are the node:http
  // built-ins; on Bun the node `requestTimeout` maps to Bun's single
  // `idleTimeout`. Defends against slowloris and hung connections. Overridable
  // via `webjs.requestTimeoutMs` / `headersTimeoutMs` / `keepAliveTimeoutMs` in
  // package.json or the matching WEBJS_*_MS env vars; `0` disables that timeout.
  const timeouts = await readServerTimeoutsFromApp(app.appDir);

  // The shared context both listener shells consume. The transport-specific glue
  // (node:http `res.write`, Bun.serve streaming Response) lives in each shell;
  // the SSE registry, the live-reload path predicate, the WS module loader, and
  // the lifecycle wiring are shared via listener-core.js so the shells can't drift.
  /** @type {import('../listener-types.js').ListenerContext} */
  const ctx = { app, dev, compress, logger, hub, port, basePathStr: basePath(), timeouts, watcherAbort };

  // Pick the adapter by runtime. Bun is Request/Response-native, so its shell
  // skips the node:http bridge (toWebRequest/sendWebResponse) for ~1.9x more
  // req/s on the listening path (#511); the Bun shell is dynamically imported so
  // the `Bun.*` global is never referenced on Node.
  try {
    /** @type {{ server: any, close: () => Promise<void> }} */
    let handle;
    if (serverRuntime() === 'bun') {
      const { startBunListener } = await import('../listener-bun.js');
      handle = startBunListener(ctx);
    } else {
      handle = await startNodeListener(ctx);
    }
    if (hotKey) {
      // Own the process for every later `bun --hot` re-run (#1575).
      await armHotSentinel(app.appDir);
      const close = handle.close;
      handle = { ...handle, close: () => { deleteHotHost(hotKey); removeHotSentinel(app.appDir); return close(); } };
      const owned = handle;
      setHotHost(hotKey, {
        version: SERVER_VERSION,
        /**
         * The registry was reset: re-watch the sentinel from the fresh registry,
         * then re-derive the analysis so it re-imports the app's modules (the
         * middleware, the components it primes) from that registry. A re-run a
         * poke asked for carries the verdict of the edits behind it and tells the
         * browser; any other is silent, since the watcher already sent that
         * edit's own reload frame.
         */
        rerun: async () => {
          await armHotSentinel(app.appDir);
          const pv = pokedVerdict;
          pokedVerdict = null;
          clearTimeout(pokeFallback);
          await app.rebuild(pv || undefined, { notify: !!pv });
          return owned;
        },
        poke: () => pokeHotSentinel(app.appDir),
      });
      announceHotInPlace();
    }
    return handle;
  } catch (e) {
    // The listener never came up (a taken port, #1527): stop what was started
    // for it, so an embedding caller that catches this is not left with a
    // live file watcher keeping the process alive.
    if (watcherAbort) watcherAbort.abort();
    hub.closeAll();
    throw e;
  }
}
