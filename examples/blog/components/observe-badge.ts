/**
 * A shipping side-effect module that OBSERVES `<observed-badge>`'s
 * registration via `customElements.whenDefined`. This is the cross-module
 * observation the #169 fix detects: because a graph-reachable module waits
 * for the tag to upgrade, the analyser forces `observed-badge` to ship
 * instead of eliding it. Without the observation the badge would be elided
 * (like `<build-stamp>`), and this `whenDefined` would never resolve.
 *
 * The returned promise is intentionally unused. The call is SSR-safe: the
 * server's `customElements` shim returns a promise that simply never
 * resolves there, so no browser-only API is touched during SSR.
 */
void customElements.whenDefined('observed-badge');
