/**
 * The live-reload state a dev page was rendered at (#1516).
 *
 * `startServer` owns the reload stream's `SseHub`, which knows this process's
 * boot id and how many reload frames it has sent. SSR renders that pair into a
 * `webjs-dev-reload` meta tag, and the reload client hands it to the relay, so
 * on every reconnect the relay can tell whether the page on screen is behind
 * the server even when the reload frame that would have said so was lost.
 *
 * A module-level provider, the same shape as the base path and the embed
 * origins, because the head is rendered far from the listener. An embedded
 * `createRequestHandler` with no `startServer` has no reload stream, so no
 * provider is set and no meta tag is rendered.
 */

/** @type {(() => { boot: string, seq: number }) | null} */
let provider = null;

/**
 * Set (or clear with null) the function that reports the current state.
 * @param {(() => { boot: string, seq: number }) | null} fn
 */
export function setDevReloadState(fn) {
  provider = typeof fn === 'function' ? fn : null;
}

/** The current `{ boot, seq }`, or null when there is no reload stream. */
export function devReloadState() {
  if (!provider) return null;
  try { return provider(); } catch { return null; }
}
