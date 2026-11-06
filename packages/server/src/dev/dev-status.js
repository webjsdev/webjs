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
 *   - A short ring of the errors seen since the last rebuild: render, TS strip,
 *     rebuild, action, middleware, metadata, and request-pipeline failures,
 *     each as a dev error frame (message, file, line, code frame). The overlay
 *     keeps only the newest one, and never saw an action error at all.
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
      // The same failure reported twice in a row (a render error the overlay
      // and the onError funnel both see) is one entry, not two.
      const last = errors[errors.length - 1];
      if (last && last.kind === entry.kind && last.message === entry.message
        && last.file === entry.file && last.line === entry.line && last.url === entry.url) return;
      errors.push(entry);
      if (errors.length > DEV_STATUS_MAX_ERRORS) errors = errors.slice(-DEV_STATUS_MAX_ERRORS);
    },
    /** A watcher saw an app change that a rebuild will follow. */
    noteChange() { changeAt = now(); },
    /** A rebuild started. */
    rebuildStarted() { rebuildsInFlight++; },
    /**
     * A rebuild finished.
     * @param {{ cleared?: boolean }} [opts] `cleared` drops the recorded errors,
     *   which describe the build that was just replaced.
     */
    rebuildFinished({ cleared = true } = {}) {
      rebuildsInFlight = Math.max(0, rebuildsInFlight - 1);
      rebuilds++;
      if (rebuildsInFlight === 0) changeAt = null;
      if (cleared) errors = [];
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
