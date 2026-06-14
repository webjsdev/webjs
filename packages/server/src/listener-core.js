/**
 * Runtime-neutral listener core (#511): the pieces both the node:http shell and
 * the `Bun.serve` shell share, so the two adapters cannot drift.
 *
 * `createRequestHandler` already returns a runtime-agnostic `handle(req): Response`.
 * The remaining shell work (accept a socket, dispatch SSE live-reload, upgrade a
 * WebSocket, apply timeouts + compression, run graceful shutdown) is split here
 * into the genuinely-shared decision logic (this module) and the irreducibly
 * transport-specific glue (the node `res.write` path in `dev.js`, the `Bun.serve`
 * streaming-`Response` path in `listener-bun.js`). The SSE registry + fanout, the
 * live-reload path predicate, the WS module loader, the runtime detector, and the
 * lifecycle wiring all live here so a feature added to one shell is added to both.
 *
 * The seam also sets up future `Deno.serve` / embedded-host adapters: a new shell
 * supplies its own client wrapper to `SseHub`, its own socket-to-`Request` bridge,
 * and its own `closeServer` thunk, and reuses everything else verbatim.
 */
import { pathToFileURL } from 'node:url';
import { stripBasePath } from './base-path.js';

/** The dev live-reload SSE path (matched after base-path stripping). */
export const EVENTS_PATH = '/__webjs/events';

/**
 * Detect the host runtime so `startServer` can pick an adapter. Bun sets
 * `process.versions.bun` (and also reports a `node` version via its compat
 * layer, so the Bun check must come first).
 * @returns {'bun' | 'node'}
 */
export function serverRuntime() {
  return (typeof process !== 'undefined' && process.versions && process.versions.bun)
    ? 'bun'
    : 'node';
}

/**
 * Is this request the dev live-reload SSE stream? Base-path-aware so the stream
 * answers at `<basePath>/__webjs/events` under a sub-path deploy (#256); a no-op
 * pass-through when there is no base path.
 * @param {string} pathname
 * @param {string} basePathStr
 */
export function isEventsPath(pathname, basePathStr) {
  return stripBasePath(pathname, basePathStr) === EVENTS_PATH;
}

/**
 * Whether a response body of this content type is worth compressing. Shared by
 * the node `sendWebResponse` and the Bun `maybeCompress` so both shells gzip the
 * exact same set of media types.
 * @param {string | string[] | null | undefined} contentType
 */
export function isCompressible(contentType) {
  if (!contentType) return false;
  const ct = Array.isArray(contentType) ? contentType[0] : contentType;
  // Never compress an event stream: a compressor buffers/chunk-delays bytes that
  // an SSE body (a user route.ts returning text/event-stream) is meant to flush
  // incrementally, so it would stall the stream. The framework's own
  // /__webjs/events stream is intercepted before compression; this guards a
  // user-authored one on both shells.
  if (/^text\/event-stream/i.test(ct)) return false;
  return /^(?:text\/|application\/(?:javascript|json|xml|wasm|manifest)|image\/svg\+xml)/i.test(ct);
}

/**
 * Load a `route.{js,ts}` module for its `WS` export, cache-busting in dev so a
 * code edit is picked up per connection. Shared by the node WebSocket subsystem
 * (`websocket.js`) and the Bun upgrade path so both resolve the handler identically.
 * @param {string} file
 * @param {boolean} dev
 */
export function loadWsModule(file, dev) {
  const url = pathToFileURL(file).toString();
  const bust = dev ? `?t=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
  return import(url + bust);
}

/**
 * Runtime-neutral SSE registry + fanout for dev live-reload and the dev error
 * overlay (#264). Owns the connected-client Set and the keepalive timer; the
 * fanout writes plain SSE frames through each client's `send`. Each shell adds a
 * thin client wrapper over its own transport (node `res.write`, a Bun
 * `ReadableStreamDefaultController`), so this fanout logic is written once.
 */
export class SseHub {
  /** @param {{ keepaliveMs?: number }} [opts] */
  constructor(opts = {}) {
    /** @type {Set<{ send: (s: string) => void, close: () => void }>} */
    this.clients = new Set();
    // Keepalive: a comment frame every 25s defeats proxy idle timeouts (and, on
    // Bun, keeps the connection under the server idleTimeout). Cheap and safe:
    // SSE comments are ignored by the client. Unref'd so it never holds the
    // process open.
    this._timer = setInterval(() => this._raw(': ka\n\n'), opts.keepaliveMs ?? 25_000);
    if (typeof this._timer.unref === 'function') this._timer.unref();
  }

  /** @param {{ send: (s: string) => void, close: () => void }} client */
  add(client) { this.clients.add(client); }
  /** @param {{ send: (s: string) => void, close: () => void }} client */
  remove(client) { this.clients.delete(client); }

  /** @param {string} frame */
  _raw(frame) {
    for (const c of this.clients) {
      try { c.send(frame); } catch { /* a dead client is dropped by its own close handler */ }
    }
  }

  /** Push a live-reload event to every open tab. */
  reload() { this._raw('event: reload\ndata: now\n\n'); }

  /** Push a dev-error overlay frame (#264) to every open tab. @param {object} frame */
  devError(frame) { this._raw(`event: webjs-error\ndata: ${JSON.stringify(frame)}\n\n`); }

  /** Close every client and stop the keepalive (graceful shutdown). */
  closeAll() {
    for (const c of this.clients) { try { c.close(); } catch {} }
    this.clients.clear();
    clearInterval(this._timer);
  }
}

/**
 * Install once-only process error handlers. Idempotent across multiple
 * `startServer` calls in the same process. Runtime-neutral (plain `process.on`).
 * @param {import('./logger.js').Logger} logger
 * @param {() => void} onFatal
 */
export function installProcessHandlers(logger, onFatal) {
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

/**
 * Build a graceful-shutdown signal handler. Runtime-neutral: the shell supplies a
 * `closeServer()` thunk that resolves once the server has stopped accepting
 * connections (node `server.close`, Bun `server.stop(true)`). Closes the SSE hub,
 * then drains, then exits; hard-exits after 10s if the drain hangs.
 * @param {{ closeServer: () => Promise<unknown>, hub: SseHub, logger: import('./logger.js').Logger }} opts
 * @returns {(signal: string) => void}
 */
export function makeShutdown({ closeServer, hub, logger }) {
  let shuttingDown = false;
  return (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`received ${signal}, shutting down`);
    try { hub.closeAll(); } catch {}
    const hard = setTimeout(() => {
      logger.warn('shutdown timed out, forcing exit');
      process.exit(1);
    }, 10_000);
    if (typeof hard.unref === 'function') hard.unref();
    Promise.resolve()
      .then(closeServer)
      .then(
        () => { logger.info('bye'); process.exit(0); },
        (err) => { logger.error('server close error', { err: String(err) }); process.exit(1); },
      );
  };
}
