/**
 * The dev live-reload SharedWorker relay (#887), the BROWSER half. Kept as a
 * standalone browser-safe module (no node imports) so the served worker inlines
 * the EXACT source a browser test drives, with no drift, the same pattern as
 * `dev-overlay.js` (#264).
 *
 * BOTH served dev scripts inline this file, `export`-stripped. `reloadWorkerJs`
 * appends a `startReloadWorker(self, EventSource, '<eventsUrl>')` call for the
 * SharedWorker, and since #1397 `reloadClientJs` inlines it too, so the per-tab
 * fallback runs this same relay over a shim port instead of a second copy of
 * the boot-id rule and the reload debounce.
 *
 * One SharedWorker is shared across every tab of the origin (a SharedWorker is
 * keyed by its script URL), so it holds the ONE `EventSource` to
 * `/__webjs/events` and fans each `reload` / `webjs-error` out to every tab over
 * its `MessagePort`. Tab count never touches the browser's per-host HTTP/1.1
 * connection cap, which the per-tab `EventSource` it replaces used to exhaust.
 */

/**
 * Reload coalescing (#1397). An agent saves several files a second or two
 * apart, and EACH save produces TWO reload signals: the in-process `reload`
 * frame from the fs.watch rebuild, then a changed boot id when the browser
 * reconnects to the process `node --watch` restarted (measured 429ms apart, and
 * 1071ms between one save's reconnect and the next save's in-process frame).
 * Acting on every one reloads into a server that is about to be killed again,
 * which is how the page ends up unstyled.
 *
 * 2000ms is above the measured 1071ms inter-save gap so a realistic burst
 * collapses to one reload, and deliberately not NEAR it, since a window close
 * to that gap fires just as the next restart begins. It also lands just past
 * the 1900ms analysis warm measured on the website app, which is the useful
 * place for it: the restarted process kicks off `warmup()` as soon as it
 * listens, so the wait overlaps work the reload request would have blocked on
 * anyway and the reload arrives at a server that has finished warming.
 */
export const RELOAD_QUIET_MS = 2000;

/**
 * The longest a reload is ever held, measured from the FIRST signal of a batch
 * (#1397). A quiet window alone would freeze the page on stale content for a
 * whole agent burst, so a sustained burst still repaints at least this often.
 * 2.5x the quiet window, so it never fires for an ordinary pair of edits.
 */
export const RELOAD_MAX_HOLD_MS = 5000;

/**
 * Verdict strength, STRONGEST FIRST (#1398). Mirrors `RELOAD_VERDICTS` in the
 * server's `dev-classify.js`; duplicated rather than imported because this file
 * is inlined verbatim into two served browser scripts and must stay
 * import-free.
 *
 * A batch collapses to ONE emitted reload, so it must take the STRONGEST
 * verdict in the batch and never the last one: a burst mixing a page edit and a
 * component edit is a component edit, and morphing it would leave the old
 * component class running against fresh markup.
 */
export const VERDICT_STRENGTH = ['reload', 'shell', 'page'];

/**
 * Resolve an SSE `reload` frame's `data` to a verdict name.
 *
 * ANY failure resolves to `reload`: an absent payload, malformed JSON, a
 * non-object, a `v` outside the three literals, or the legacy bare `data: now`.
 * That is what makes the wire-format change safe in both directions between a
 * long-running browser tab and a restarted server, since the worst a skew can
 * produce is the full reload that was the behaviour before this existed.
 *
 * @param {string} data
 * @returns {string} one of VERDICT_STRENGTH
 */
export function parseVerdict(data) {
  try {
    const o = JSON.parse(data);
    if (o && typeof o === 'object' && VERDICT_STRENGTH.indexOf(o.v) !== -1) return o.v;
  } catch (_) { /* fall through to the fail-safe */ }
  return 'reload';
}

/** First reconnect wait after the stream drops (#1507), doubled per failure. */
export const RECONNECT_BASE_MS = 300;
/** The longest wait between reconnect attempts (#1507). */
export const RECONNECT_MAX_MS = 30000;

/**
 * Read a `hello` frame's data (#893, #1507): `{ boot, seq }` JSON, or the bare
 * boot id an older server sends (seq unknown).
 * @param {string} data
 * @returns {{ boot: string, seq: number | null }}
 */
export function parseHello(data) {
  try {
    const o = JSON.parse(data);
    if (o && typeof o === 'object' && typeof o.boot === 'string') {
      return { boot: o.boot, seq: typeof o.seq === 'number' ? o.seq : null };
    }
  } catch (_) { /* a bare boot id */ }
  return { boot: String(data), seq: null };
}

/** A reload frame's `seq` (#1507), or null when it carries none. @param {string} data */
function reloadSeq(data) {
  try {
    const o = JSON.parse(data);
    return o && typeof o.seq === 'number' ? o.seq : null;
  } catch (_) { return null; }
}

/**
 * Run the relay.
 *
 * The stream is open only while at least one tab is VISIBLE (#1507). Each tab
 * reports `{ type: 'visibility', visible }` on `visibilitychange` and
 * `{ type: 'bye' }` on `pagehide`; when the last visible tab goes away the
 * relay closes its `EventSource`, so a backgrounded dev tab holds no request
 * open and sends nothing, and it reopens the moment one becomes visible. An
 * edit made meanwhile is not lost: the reopened stream's `hello` carries the
 * server's boot id and reload `seq`, and a difference from what this relay last
 * saw is a reload.
 *
 * The browser's own EventSource retry is replaced by an explicit one with
 * backoff (300ms doubling to 30s, reset by the next `hello`), so a server that
 * is gone for a while is probed less and less often instead of every 300ms.
 *
 * @param {{ onconnect: any, setTimeout?: any, clearTimeout?: any }} scope  the
 *   worker global (`self`), or a plain shim object for the per-tab fallback.
 *   Timers are read off it when it has them, which is what lets a browser test
 *   drive the debounce on a fake clock.
 * @param {new (url: string) => any} EventSourceCtor  the `EventSource` constructor
 * @param {string} eventsUrl  the base-path-aware `/__webjs/events` URL
 */
export function startReloadWorker(scope, EventSourceCtor, eventsUrl) {
  /** @type {Map<any, boolean>} each connected tab's port, and whether it is visible */
  const ports = new Map();
  /** @type {string | null} the last error frame, cached for late-joining tabs */
  let lastError = null;
  /** @type {string | null} the last-seen per-process boot id (#893) */
  let lastBoot = null;
  /** @type {number | null} the last reload seq seen from that process (#1507) */
  let lastSeq = null;

  const timers = scope && typeof scope.setTimeout === 'function' ? scope : globalThis;

  function fanout(msg) {
    for (const p of ports.keys()) {
      try { p.postMessage(msg); } catch (_) { ports.delete(p); }
    }
  }

  /** @type {any} */ let quietTimer = null;
  /** @type {any} */ let capTimer = null;

  /** @type {string} the strongest verdict seen in the CURRENT batch (#1398) */
  let batchVerdict = 'page';

  function emitReload() {
    if (quietTimer !== null) { timers.clearTimeout(quietTimer); quietTimer = null; }
    if (capTimer !== null) { timers.clearTimeout(capTimer); capTimer = null; }
    const v = batchVerdict;
    batchVerdict = 'page';   // a fresh batch starts at the weakest verdict
    fanout({ type: 'reload', verdict: v });
  }

  /** Strength rank; an unrecognised name ranks strongest, so it can only ever
   * over-reload. @param {string} v */
  function rank(v) {
    const i = VERDICT_STRENGTH.indexOf(v);
    return i === -1 ? 0 : i;
  }

  /** @param {string} verdict */
  function requestReload(verdict) {
    if (rank(verdict) < rank(batchVerdict)) batchVerdict = VERDICT_STRENGTH[rank(verdict)];
    if (quietTimer !== null) timers.clearTimeout(quietTimer);
    quietTimer = timers.setTimeout(emitReload, RELOAD_QUIET_MS);
    if (capTimer === null) capTimer = timers.setTimeout(emitReload, RELOAD_MAX_HOLD_MS);
  }

  /** @type {any} */ let es = null;
  /** @type {any} */ let retryTimer = null;
  let retryDelay = RECONNECT_BASE_MS;

  function anyVisible() {
    for (const v of ports.values()) if (v) return true;
    return false;
  }

  function open() {
    if (es || retryTimer !== null) return;
    es = new EventSourceCtor(eventsUrl);
    const mine = es;
    es.addEventListener('hello', (e) => {
      retryDelay = RECONNECT_BASE_MS;
      const h = parseHello(e.data);
      if (lastBoot !== null && (h.boot !== lastBoot || (h.seq !== null && lastSeq !== null && h.seq !== lastSeq))) {
        requestReload('reload');
      }
      lastBoot = h.boot;
      lastSeq = h.seq;
    });
    es.addEventListener('reload', (e) => {
      lastError = null;
      const n = reloadSeq(e.data);
      if (n !== null) lastSeq = n;
      requestReload(parseVerdict(e.data));
    });
    es.addEventListener('webjs-error', (e) => { lastError = e.data; fanout({ type: 'webjs-error', data: e.data }); });
    // The stream dropped (a restarting server, a network blip, a host that
    // slept). Close it so the browser's fixed-interval retry never runs, and
    // come back with backoff, but only while someone is looking.
    es.addEventListener('error', () => {
      if (es !== mine) return;
      try { es.close(); } catch (_) { /* already closed */ }
      es = null;
      if (!anyVisible()) return;
      retryTimer = timers.setTimeout(() => { retryTimer = null; if (anyVisible()) open(); }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, RECONNECT_MAX_MS);
    });
  }

  function close() {
    if (retryTimer !== null) { timers.clearTimeout(retryTimer); retryTimer = null; }
    if (es) { try { es.close(); } catch (_) { /* already closed */ } es = null; }
    retryDelay = RECONNECT_BASE_MS;
  }

  function sync() {
    if (anyVisible()) open(); else close();
  }

  scope.onconnect = (e) => {
    const port = e.ports[0];
    // A tab counts as visible until it says otherwise, so a client older than
    // the visibility messages keeps the stream open exactly as before.
    ports.set(port, true);
    port.onmessage = (m) => {
      const d = (m && m.data) || {};
      if (d.type === 'visibility') ports.set(port, d.visible !== false);
      else if (d.type === 'bye') ports.delete(port);
      else return;
      sync();
    };
    port.start();
    if (lastError != null) {
      try { port.postMessage({ type: 'webjs-error', data: lastError }); } catch (_) { ports.delete(port); }
    }
    sync();
  };

  return {
    ports,
    /** The live EventSource, or null while paused or between retries. */
    get es() { return es; },
  };
}
