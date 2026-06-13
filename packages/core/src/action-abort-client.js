/**
 * Client-side action abort plumbing (#492).
 *
 * An `async render()` that supersedes an in-flight one should ABORT the previous
 * render's action fetches, not just drop their results. The component sets a
 * fresh AbortController's signal as the "active" signal right before each render
 * (`setActiveActionSignal`), and the generated RPC stub binds every `fetch` to
 * `activeActionSignal()`. When the next render supersedes, the component aborts
 * the previous controller, cancelling those fetches.
 *
 * Best-effort by design: the stub reads the active signal SYNCHRONOUSLY when the
 * action is called, so it binds for an action invoked in the synchronous portion
 * of `render()` (the common `const u = await getUser(id)` first statement). An
 * action invoked after a later `await` may see no active signal; it then simply
 * runs to completion and its result is dropped by the existing render-token
 * guard, exactly as before this feature. Inert server-side (never set there).
 */

/** The AbortSignal the currently-rendering component bound, or null. */
let active = null;

/**
 * Set (or clear with null) the signal the generated RPC stub binds its fetches
 * to. The component sets this around the synchronous portion of `render()`.
 * @param {AbortSignal | null} signal
 */
export function setActiveActionSignal(signal) {
  active = signal || null;
}

/**
 * The active abort signal a stub should bind a fetch to, or undefined when no
 * render is in flight (an action called from an event handler is not bound, so
 * a re-render never aborts a user-triggered mutation).
 * @returns {AbortSignal | undefined}
 */
export function activeActionSignal() {
  return active || undefined;
}
