/**
 * `<webjs-suspense>`: the client side of the element-level streaming boundary
 * (#471).
 *
 * The SSR pipeline (render-server.js) does the real work: in a streaming
 * render each `<webjs-suspense .fallback=${...}>` flushes its fallback
 * immediately as `<webjs-suspense id="sN">FALLBACK</webjs-suspense>` and streams
 * the resolved children later as a `<template data-webjs-resolve="sN">` plus a
 * tiny inline swap `<script>` (the same mechanism page-level `Suspense` uses).
 * On initial load that swap script REPLACES the boundary element with the
 * resolved children (the transient `<webjs-suspense id>` wrapper is removed),
 * and the custom elements inside upgrade natively. So NO client runtime is
 * required for first-load streaming.
 *
 * This element exists for two reasons:
 *
 *   1. Layout neutrality. An unknown element defaults to `display: inline`,
 *      which would wrap a block-level fallback/content oddly. `display:
 *      contents` makes the boundary box disappear so its children lay out as
 *      if the wrapper were not there.
 *   2. A registration home. The client router imports this module so the
 *      element is defined app-wide; the SOFT-NAVIGATION streaming path
 *      (router-client.js) reuses the same `data-webjs-resolve` swap to apply a
 *      streamed response progressively (#473).
 *
 * SSR-inert: `renderToString` emits the plain `<webjs-suspense>` tag and never
 * touches this class (it is defined only when `HTMLElement` exists).
 */
const WebjsSuspense = (typeof HTMLElement !== 'undefined')
  ? class WebjsSuspense extends HTMLElement {
      connectedCallback() {
        // Layout-transparent wrapper. Set inline so no stylesheet is needed.
        if (!this.style.display) this.style.display = 'contents';
      }
    }
  : /** @type {any} */ (null);

if (typeof customElements !== 'undefined' && WebjsSuspense && !customElements.get('webjs-suspense')) {
  customElements.define('webjs-suspense', WebjsSuspense);
}

export { WebjsSuspense };
