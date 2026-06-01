/**
 * A shipping side-effect module that observes the observed-badge element's
 * registration. This is the cross-module observation the #169 fix detects:
 * because a graph-reachable module waits for the tag to upgrade, the
 * analyser forces observed-badge to ship instead of eliding it. Without
 * the observation the badge would be elided like the build-stamp element.
 *
 * The returned promise is intentionally unused. The call is SSR-safe: the
 * server's customElements shim returns a promise that simply never resolves
 * there, so no browser-only API is touched during SSR.
 *
 * Note: the doc prose avoids angle-bracket tag syntax on purpose. The
 * elision analyser scans raw source including comments, so a tag written in
 * angle brackets would be misread as a rendered tag. The real observation
 * is the executable line below.
 */
void customElements.whenDefined('observed-badge');
