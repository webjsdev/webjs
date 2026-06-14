/**
 * Bun.serve listener adapter (#511): the `Bun.serve` shell for `startServer`,
 * selected when the host runtime is Bun. Bun's server is `Request`/`Response`
 * native, so this path skips the node:http `toWebRequest` / `sendWebResponse`
 * bridge entirely and hands the app's `handle(req): Response` straight to
 * `Bun.serve({ fetch })`. A benchmark on the full listening path (node:http
 * compat on Bun vs `Bun.serve`) measured ~1.9x more req/s, which is what justifies
 * a second shell rather than running the node compat path on Bun.
 *
 * Feature parity with the node shell, routed through the shared
 * `listener-core.js` so the two cannot drift:
 *   - **SSE live-reload** (#264): a streaming `text/event-stream` `Response` whose
 *     `ReadableStream` controller is registered in the shared `SseHub`; the
 *     request `AbortSignal` (and the stream `cancel`) deregister it on disconnect.
 *   - **WebSocket upgrade**: a `route.ts` `WS` export. Bun's native WS dispatches
 *     through server-level `websocket` handlers (not the node `ws`-library
 *     EventEmitter contract the `WS(ws, …)` export expects), so a small
 *     `BunWsAdapter` re-exposes `.on('message')` / `.on('close')` / `.send()` /
 *     `.readyState` over Bun's `ServerWebSocket`, keeping the handler contract and
 *     the `broadcast()` registry identical across runtimes.
 *   - **Compression**: gzip / deflate via the web `CompressionStream`. Bun's
 *     `CompressionStream` has no brotli (not in the web standard), so the node
 *     shell's brotli-preferred path narrows to gzip on Bun; same media-type set
 *     (`isCompressible`).
 *   - **Timeouts** (#237): the node `requestTimeout` maps to Bun's single
 *     `idleTimeout` (seconds), clamped above the 25s SSE keepalive so a dev
 *     live-reload stream is never reaped.
 *   - **Proxy IP**: `server.requestIP(req).address` stamps the framework-trusted
 *     `x-webjs-remote-ip` (the node socket-address equivalent), after stripping
 *     any spoofed inbound value.
 *
 * Not supported on Bun (documented, node-only): **103 Early Hints**. `Bun.serve`
 * exposes no API to write an informational response before the body.
 *
 * This module is imported DYNAMICALLY by `dev.js` only when `serverRuntime()` is
 * `'bun'`, so the `Bun.*` global is never referenced on Node. It still LINKS on
 * Node (the global is only read inside functions), but it is never loaded there.
 */
import { EventEmitter } from 'node:events';
import { matchApi } from './router.js';
import { registerClient } from './broadcast.js';
import {
  isCompressible,
  isEventsPath,
  loadWsModule,
  installProcessHandlers,
  makeShutdown,
} from './listener-core.js';

/* global Bun */

/**
 * Start the Bun.serve listener.
 * @param {import('./listener-types.js').ListenerContext} ctx
 * @returns {{ server: any, close: () => Promise<void> }}
 */
export function startBunListener(ctx) {
  const { app, dev, compress, logger, hub, port, basePathStr, timeouts, watcherAbort } = ctx;

  const server = Bun.serve({
    port,
    idleTimeout: bunIdleTimeout(timeouts),
    // webjs owns its dev error overlay (over SSE) and handles thrown errors in
    // `fetch`, so Bun's own development error page must never interfere; keep it
    // deterministic (off) rather than tied to NODE_ENV.
    development: false,
    /**
     * @param {Request} req
     * @param {any} srv  the Bun server (requestIP / upgrade)
     */
    async fetch(req, srv) {
      try {
        const url = new URL(req.url);

        // SSE live-reload stream (dev only); does not fit the req->Response model
        // on node, but on Bun it is a perfectly ordinary streaming Response.
        if (isEventsPath(url.pathname, basePathStr)) {
          if (!dev) return new Response(null, { status: 404 });
          return bunSseResponse(req, hub, app);
        }

        // WebSocket upgrade: a route.ts exporting WS.
        if ((req.headers.get('upgrade') || '').toLowerCase() === 'websocket') {
          return await bunUpgrade(req, srv, ctx);
        }

        // 103 Early Hints are intentionally skipped: Bun.serve has no API to
        // write an informational response before the body. The modulepreload
        // hints still ship in the rendered <head>, so the only loss is the
        // head-start during SSR compute, not the preloads themselves.

        const webReq = stampRemoteIp(req, srv);
        const resp = await app.handle(webReq);
        return compress ? maybeCompress(resp, req) : resp;
      } catch (e) {
        logger.error('request pipeline threw', { err: e instanceof Error ? e.stack : String(e) });
        return new Response(
          dev && e instanceof Error ? `webjs error: ${e.stack}` : 'Internal server error',
          { status: 500, headers: { 'content-type': 'text/plain' } },
        );
      }
    },
    websocket: {
      /** @param {any} ws */
      open(ws) {
        const d = ws.data;
        try {
          d.wrapper._bind(ws);
          registerClient(d.pathname, d.wrapper);
          d.mod.WS(d.wrapper, d.req, { params: d.params });
        } catch (e) {
          logger.error('WebSocket handler threw', {
            err: e instanceof Error ? e.stack || e.message : String(e),
          });
          try { ws.close(1011, 'Internal error'); } catch {}
        }
      },
      /** @param {any} ws @param {string | Buffer} message */
      message(ws, message) {
        try { ws.data.wrapper.emit('message', message); } catch {}
      },
      /** @param {any} ws @param {number} code @param {string} reason */
      close(ws, code, reason) {
        const w = ws.data.wrapper;
        w.readyState = 3;
        try { w.emit('close', code, reason); } catch {}
      },
    },
  });

  logger.info(
    `webjs ${dev ? 'dev' : 'prod'} server ready on http://localhost:${server.port} (Bun ${process.versions.bun})`,
  );
  // Warm the first-request analysis in the background; listening does not wait
  // on it, matching the node shell.
  app.warmup();

  const closeServer = () => Promise.resolve(server.stop(true));
  const shutdown = makeShutdown({ closeServer, hub, logger });
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  installProcessHandlers(logger, () => shutdown('uncaughtException'));

  return {
    server,
    close: () => {
      if (watcherAbort) watcherAbort.abort();
      hub.closeAll();
      return Promise.resolve(server.stop(true)).then(() => undefined);
    },
  };
}

/**
 * The node `ws`-library WebSocket contract (`.on('message')` / `.on('close')` /
 * `.send()` / `.readyState` / `.close()`) re-exposed over a Bun `ServerWebSocket`,
 * which otherwise dispatches messages through server-level handlers rather than
 * per-socket events. Constructed at upgrade time and bound to the real socket in
 * the `open` handler; messages/close are forwarded to its emitter from the
 * `websocket.message` / `websocket.close` handlers.
 */
class BunWsAdapter extends EventEmitter {
  constructor() {
    super();
    /** @type {any} */
    this._ws = null;
    // WebSocket.readyState constants: 0 CONNECTING, 1 OPEN, 2 CLOSING, 3 CLOSED.
    this.readyState = 0;
  }

  /** @param {any} ws  the Bun ServerWebSocket, available once `open` fires */
  _bind(ws) {
    this._ws = ws;
    this.readyState = 1;
  }

  /** @param {string | ArrayBufferView | ArrayBuffer} data */
  send(data) {
    try { if (this._ws) this._ws.send(data); } catch {}
  }

  /** @param {number} [code] @param {string} [reason] */
  close(code, reason) {
    try { if (this._ws) this._ws.close(code, reason); } catch {}
  }

  get bufferedAmount() {
    try { return this._ws ? this._ws.getBufferedAmount() : 0; } catch { return 0; }
  }
}

/**
 * Resolve a `route.ts` `WS` export and upgrade the connection. Mirrors the node
 * `attachWebSocket` path (match the route, load the module, require a `WS`
 * function) but drives Bun's `server.upgrade`. Returns `undefined` on a
 * successful upgrade (Bun's contract: the fetch handler must not return a
 * Response once the socket is taken over).
 * @param {Request} req
 * @param {any} srv
 * @param {import('./listener-types.js').ListenerContext} ctx
 */
async function bunUpgrade(req, srv, ctx) {
  const url = new URL(req.url);
  // Matches the node WS path, which keys on the full pathname (no base-path
  // stripping) and on `registerClient(url.pathname, …)`.
  const match = matchApi(ctx.app.getRouteTable(), url.pathname);
  if (!match) return new Response('Not Found', { status: 404 });

  let mod;
  try {
    mod = await loadWsModule(match.route.file, ctx.dev);
  } catch (e) {
    ctx.logger.error('WebSocket module load failed', { err: String(e) });
    return new Response('Upgrade failed', { status: 500 });
  }
  if (typeof mod.WS !== 'function') {
    return new Response('Upgrade not supported at this route', { status: 426 });
  }

  const wrapper = new BunWsAdapter();
  const handlerReq = upgradeRequest(req, url);
  const ok = srv.upgrade(req, {
    data: { wrapper, mod, req: handlerReq, params: match.params, pathname: url.pathname },
  });
  if (ok) return undefined;
  return new Response('Upgrade failed', { status: 500 });
}

/**
 * Best-effort `Request` for the WS handler: headers + GET + URL, no body (it is a
 * handshake). Mirrors the node `buildRequestFromUpgrade` so the handler reads the
 * same cookies/auth either side.
 * @param {Request} req
 * @param {URL} url
 */
function upgradeRequest(req, url) {
  const headers = new Headers();
  req.headers.forEach((v, k) => { if (!k.startsWith(':')) headers.set(k, v); });
  return new Request(url, { method: 'GET', headers });
}

/**
 * Build the dev live-reload SSE `Response`: a streaming `text/event-stream` whose
 * controller is registered in the shared `SseHub`. The request `AbortSignal` and
 * the stream `cancel` both deregister the client on disconnect.
 * @param {Request} req
 * @param {import('./listener-core.js').SseHub} hub
 * @param {any} app
 */
function bunSseResponse(req, hub, app) {
  const enc = new TextEncoder();
  /** @type {{ send: (s: string) => void, close: () => void } | null} */
  let client = null;
  const stream = new ReadableStream({
    start(controller) {
      client = {
        send: (s) => { try { controller.enqueue(enc.encode(s)); } catch {} },
        close: () => { try { controller.close(); } catch {} },
      };
      controller.enqueue(enc.encode('event: hello\ndata: webjs\n\n'));
      hub.add(client);
      // Replay an unresolved dev error (#264) so a tab connecting AFTER the
      // breaking edit still shows the overlay.
      const pending = app.getLastDevError && app.getLastDevError();
      if (pending) {
        try { controller.enqueue(enc.encode(`event: webjs-error\ndata: ${JSON.stringify(pending)}\n\n`)); } catch {}
      }
    },
    cancel() { if (client) hub.remove(client); },
  });
  if (req.signal) {
    req.signal.addEventListener('abort', () => { if (client) hub.remove(client); });
  }
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' },
  });
}

/**
 * Stamp the framework-trusted remote IP from Bun's `server.requestIP`, after
 * stripping any spoofed inbound `x-webjs-remote-ip` (the node `toWebRequest`
 * equivalent, which reads `req.socket.remoteAddress`). Re-wraps the request with
 * the adjusted headers, preserving method + body.
 * @param {Request} req
 * @param {any} srv
 */
function stampRemoteIp(req, srv) {
  const headers = new Headers(req.headers);
  headers.delete('x-webjs-remote-ip');
  let ip;
  try { ip = srv.requestIP(req)?.address; } catch {}
  if (ip) headers.set('x-webjs-remote-ip', ip);
  return new Request(req, { headers });
}

/**
 * Apply gzip/deflate compression to a buffered/streamed `Response` via the web
 * `CompressionStream`. Skips an already-encoded body and a non-compressible media
 * type, mirroring the node `sendWebResponse` negotiation (minus brotli, which the
 * web `CompressionStream` does not provide).
 * @param {Response} resp
 * @param {Request} req
 */
function maybeCompress(resp, req) {
  if (!resp.body) return resp;
  if (resp.headers.has('content-encoding')) return resp;
  if (!isCompressible(resp.headers.get('content-type'))) return resp;
  const accept = req.headers.get('accept-encoding') || '';
  let format = null;
  if (/(?:^|,\s*)gzip(?:;|,|$)/.test(accept)) format = 'gzip';
  else if (/(?:^|,\s*)deflate(?:;|,|$)/.test(accept)) format = 'deflate';
  if (!format) return resp;

  const headers = new Headers(resp.headers);
  headers.set('content-encoding', format);
  headers.delete('content-length');
  const vary = headers.get('vary');
  headers.set('vary', vary && !/accept-encoding/i.test(vary) ? `${vary}, Accept-Encoding` : (vary || 'Accept-Encoding'));
  const body = resp.body.pipeThrough(new CompressionStream(format));
  return new Response(body, { status: resp.status, statusText: resp.statusText, headers });
}

/**
 * Map the node `requestTimeout` (ms) to Bun's single `idleTimeout` (seconds). Bun
 * caps it at 255s; we clamp it above the 25s SSE keepalive so a dev live-reload
 * stream is never reaped as idle. `0` (the node "disable" sentinel) disables it
 * on Bun too.
 * @param {{ requestTimeout?: number } | undefined} timeouts
 */
function bunIdleTimeout(timeouts) {
  const reqMs = timeouts && timeouts.requestTimeout;
  if (reqMs === 0) return 0;
  let secs = Math.ceil((reqMs || 30_000) / 1000);
  if (secs < 30) secs = 30;
  if (secs > 255) secs = 255;
  return secs;
}
