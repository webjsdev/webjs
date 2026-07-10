/**
 * The dev live-reload SharedWorker relay (#887), the BROWSER half. Kept as a
 * standalone browser-safe module (no node imports) so the served worker inlines
 * the EXACT source a browser test drives, with no drift, the same pattern as
 * `dev-overlay.js` (#264). `reloadWorkerJs` in dev.js reads this file, strips
 * the `export` keyword, and appends a
 * `startReloadWorker(self, EventSource, '<eventsUrl>')` call.
 *
 * One SharedWorker is shared across every tab of the origin (a SharedWorker is
 * keyed by its script URL), so it holds the ONE `EventSource` to
 * `/__webjs/events` and fans each `reload` / `webjs-error` out to every tab over
 * its `MessagePort`. Tab count never touches the browser's per-host HTTP/1.1
 * connection cap, which the per-tab `EventSource` it replaces used to exhaust.
 *
 * @param {{ onconnect: any }} scope  the worker global (`self`)
 * @param {new (url: string) => any} EventSourceCtor  the `EventSource` constructor
 * @param {string} eventsUrl  the base-path-aware `/__webjs/events` URL
 */
export function startReloadWorker(scope, EventSourceCtor, eventsUrl) {
  /** @type {Set<any>} */
  const ports = new Set();
  /** @type {string | null} the last error frame, cached for late-joining tabs */
  let lastError = null;

  // A MessagePort has no reliable close event, so prune a port when a post to it
  // throws (a closed tab). Some browsers silently no-op instead of throwing,
  // leaving a dead port in the set, but that is a harmless dev-only no-op and
  // the set is bounded by the tabs opened in one session.
  function fanout(msg) {
    for (const p of ports) {
      try { p.postMessage(msg); } catch (_) { ports.delete(p); }
    }
  }

  const es = new EventSourceCtor(eventsUrl);
  es.addEventListener('reload', () => { lastError = null; fanout({ type: 'reload' }); });
  es.addEventListener('webjs-error', (e) => { lastError = e.data; fanout({ type: 'webjs-error', data: e.data }); });

  scope.onconnect = (e) => {
    const port = e.ports[0];
    ports.add(port);
    port.start();
    // A tab that connects AFTER a breaking edit still needs the current overlay.
    // The single shared EventSource already consumed the server's replay (#264),
    // so the worker caches the last error and hands it to each new tab itself.
    if (lastError != null) {
      try { port.postMessage({ type: 'webjs-error', data: lastError }); } catch (_) { ports.delete(port); }
    }
  };

  // Returned for tests; the served worker ignores it.
  return { ports, es };
}
