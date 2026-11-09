/**
 * `isServer`, lit's flag: `true` when this module runs outside a browser (the
 * SSR pass on Node or Bun), `false` in a browser.
 *
 * Use it to guard browser-only work in code that also runs at SSR (a
 * component's constructor, `render()`, `willUpdate()`, a controller's
 * `hostUpdate()`):
 *
 * ```js
 * import { isServer } from '@webjsdev/core';
 * if (!isServer) this.width = window.innerWidth;
 * ```
 *
 * Decided by the presence of `window` and `document`, the same test the
 * `WebComponent` base uses to pick between `HTMLElement` and its server shim,
 * so the two can never disagree.
 */
export const isServer = !(typeof window !== 'undefined' && typeof document !== 'undefined');
