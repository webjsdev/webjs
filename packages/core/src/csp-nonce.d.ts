/** Per-request CSP nonce provider (#259). Server-side; the browser bundle drops setCspNonceProvider. */
export function setCspNonceProvider(fn: () => string): void;
/**
 * The current request's CSP nonce while rendering on the server, `''` when CSP
 * is off and always `''` in the browser. Turn CSP on with `"webjs": { "csp": true }`
 * in package.json; the framework already stamps its own scripts.
 *
 * @example
 * ```ts
 * // app/layout.ts (the root layout): stamp it on an inline script you write yourself
 * import { html, cspNonce } from '@webjsdev/core';
 * import type { LayoutProps } from '@webjsdev/core';
 *
 * export default function RootLayout({ children }: LayoutProps) {
 *   return html`<!doctype html><html><head>
 *     <script nonce=${cspNonce()}>document.documentElement.dataset.js = 'on'</script>
 *   </head><body>${children}</body></html>`;
 * }
 * ```
 */
export function cspNonce(): string;
