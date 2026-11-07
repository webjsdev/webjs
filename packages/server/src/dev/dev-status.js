/**
 * The dev server's "has my edit settled, and did it break anything" state
 * (#1664), behind `GET /__webjs/dev/status` and the `webjs status` command.
 *
 * An agent editing a running app could not tell when the reload finished or
 * whether it errored, so it slept a few seconds, fetched a page, and grepped
 * the HTML for "Server error". The reload frame does not answer it either: it
 * is sent before anything is re-imported, so a syntax error only surfaces on
 * the next request.
 *
 * This module holds two things the handler feeds:
 *
 *   - A short ring of recent errors: render, TS strip, rebuild, route,
 *     action, middleware, metadata, and request-pipeline failures, each as a
 *     dev error frame (message, file, line, code frame). The overlay keeps only
 *     the newest one, and never saw an action error at all. A rebuild clears
 *     every kind EXCEPT `render`: a page broken by an edit stays broken across
 *     an unrelated rebuild, so its error stays listed until that page renders
 *     again (`renderSucceeded`).
 *   - Whether a change is still in flight: a watcher event not yet rebuilt, or
 *     a rebuild still running. The handler adds readiness on top, since the
 *     lazy analysis is what actually re-imports the app.
 *
 * Dev only. Nothing here runs in production, where the endpoint is a 404.
 *
 * @module
 */

/** How many recent errors the ring keeps. */
export const DEV_STATUS_MAX_ERRORS = 20;

/**
 * How long a watcher event may stay pending without a rebuild before it is
 * treated as settled anyway (an event that classified to nothing, a poke that
 * never re-ran), so a status wait can never hang on a lost signal.
 */
export const PENDING_CHANGE_TTL_MS = 10_000;

/**
 * @typedef {{
 *   kind: string, message: string, file?: string | null, line?: number | null,
 *   column?: number | null, codeFrame?: string | null, hint?: string | null,
 *   url?: string | null, at: string,
 * }} DevStatusError
 */

/**
 * @param {{ now?: () => number }} [opts] `now` is injectable for tests.
 */
export function createDevStatus({ now = Date.now } = {}) {
  /** @type {DevStatusError[]} */
  let errors = [];
  let rebuilds = 0;
  let rebuildsInFlight = 0;
  /** @type {number | null} */
  let changeAt = null;

  return {
    /**
     * Record an error frame (the shape `buildDevErrorFrame` returns).
     * @param {Record<string, unknown>} frame
     */
    record(frame) {
      if (!frame || typeof frame !== 'object') return;
      const entry = /** @type {DevStatusError} */ ({
        kind: String(frame.kind || 'error'),
        message: String(frame.message || ''),
        file: /** @type {any} */ (frame.file) ?? null,
        line: /** @type {any} */ (frame.line) ?? null,
        column: /** @type {any} */ (frame.column) ?? null,
        codeFrame: /** @type {any} */ (frame.codeFrame) ?? null,
        hint: /** @type {any} */ (frame.hint) ?? null,
        url: /** @type {any} */ (frame.url) ?? null,
        at: new Date(now()).toISOString(),
      });
      // The same failure seen again (a broken page requested twice) is one
      // entry; the newer one replaces it, so `at` is the latest sighting.
      errors = errors.filter((e) => !(e.kind === entry.kind && e.message === entry.message
        && e.file === entry.file && e.line === entry.line && e.url === entry.url));
      errors.push(entry);
      if (errors.length > DEV_STATUS_MAX_ERRORS) errors = errors.slice(-DEV_STATUS_MAX_ERRORS);
    },
    /** A watcher saw an app change that a rebuild will follow. */
    noteChange() { changeAt = now(); },
    /**
     * A rebuild started. It builds every change noted so far, so the pending
     * marker clears HERE; a change noted while it runs sets it again and keeps
     * the status unsettled until the rebuild that change schedules.
     */
    rebuildStarted() { rebuildsInFlight++; changeAt = null; },
    /**
     * A rebuild finished.
     * @param {{ cleared?: boolean }} [opts] `cleared` drops the recorded errors
     *   that described the build just replaced. Render errors are kept: only a
     *   successful render of that page proves it was fixed.
     */
    rebuildFinished({ cleared = true } = {}) {
      rebuildsInFlight = Math.max(0, rebuildsInFlight - 1);
      rebuilds++;
      if (cleared) errors = errors.filter((e) => e.kind === 'render');
    },
    /**
     * A page rendered without a server error, so its recorded render error is
     * stale. Each candidate is matched with its query string ignored.
     * @param {Array<string | null | undefined>} urls the page's path, and its
     *   public url (base path included) as the overlay stamps it
     */
    renderSucceeded(urls) {
      const paths = new Set(urls.filter(Boolean).map((u) => String(u).split('?')[0]));
      errors = errors.filter((e) => !(e.kind === 'render' && e.url && paths.has(String(e.url).split('?')[0])));
    },
    /** True while a change is waiting on, or inside, a rebuild. */
    changing() {
      if (rebuildsInFlight > 0) return true;
      if (changeAt === null) return false;
      if (now() - changeAt > PENDING_CHANGE_TTL_MS) { changeAt = null; return false; }
      return true;
    },
    /** @returns {{ rebuilds: number, errors: DevStatusError[] }} */
    snapshot() { return { rebuilds, errors: errors.slice() }; },
  };
}
