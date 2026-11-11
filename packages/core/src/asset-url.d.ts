/** Content-hashed `public/` asset urls (#1194). Server-side resolver; the browser bundle drops setAssetUrlProvider and `asset` returns its argument. */
export function setAssetUrlProvider(fn: (path: string) => string): void;
/**
 * The url of a `public/` file with a content hash added in production
 * (`/app.css?v=<hash>`, served `immutable` for a year), so a deploy can never
 * leave a stale copy cached. Unchanged in dev and in the browser.
 *
 * @example
 * ```ts
 * // app/(marketing)/layout.ts: a stylesheet link that leads a layout is moved into <head>
 * import { html, asset } from '@webjsdev/core';
 * import type { LayoutProps } from '@webjsdev/core';
 *
 * export default function MarketingLayout({ children }: LayoutProps) {
 *   return html`<link rel="stylesheet" href=${asset('/marketing.css')}>${children}`;
 * }
 * // Call it inside the render function of a page, layout or metadata route, not at
 * // module scope or in a component (hydration would swap the hashed url for the bare path).
 * ```
 */
export function asset(path: string): string;
