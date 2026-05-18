/**
 * `<webjs-frame id="...">`: escape-hatch partial-swap region.
 *
 * The framework's primary partial-nav mechanism auto-derives swap
 * boundaries from the folder structure (each `layout.{js,ts}`'s
 * children-slot is wrapped in a `<!--wj:children:<segment>-->` marker
 * pair). For 99% of apps that's all you need.
 *
 * `<webjs-frame>` is the escape hatch for the 1%: partial-swap
 * regions that are NOT tied to a folder layout. Typical use cases:
 *
 *   - A widget on a marketing page that updates on a navigation
 *     without changing the URL hierarchy.
 *   - A tabbed UI where each tab navigates to a sub-route but the
 *     surrounding tab strip should not re-render.
 *   - Lazy-loaded cards on a dashboard where a click swaps just the
 *     card's content.
 *
 * Usage:
 *
 *   html`
 *     <section>
 *       <h2>Activity</h2>
 *       <webjs-frame id="activity">
 *         <!-- contents that should be swapped on internal nav -->
 *         <p>Showing today's activity.</p>
 *       </webjs-frame>
 *     </section>
 *   `
 *
 * On a link click, the router checks `closest('webjs-frame')` from
 * the click target. If a frame is found AND the incoming response
 * contains a `<webjs-frame id="<matching-id>">`, the swap is scoped
 * to that frame's children: outer DOM is untouched. If no matching
 * frame appears in the response, the router falls through to the
 * normal layout-marker mechanism (and then to full body swap).
 *
 * The element is **light DOM**: no shadow root, no slot mechanics.
 * Children are normal light-DOM children that the router replaces
 * via the same keyed reconciler used for layout marker swaps. This
 * means scroll position, input values, and `<details>` open state
 * are preserved for any matched elements inside the frame.
 *
 * @element webjs-frame
 * @attr {string} id: Required. The frame's identifier, used by
 *   `closest()` on the client and `querySelector` on the response.
 */
// Defined lazily inside an IIFE so that importing this module on the
// server (Node) doesn't trip a `HTMLElement is not defined` reference
// error. Server-side renderers never touch the class: the element
// is always rendered as `<webjs-frame id=...>` plain HTML by the
// renderToString pipeline.
const WebjsFrame = (typeof HTMLElement !== 'undefined')
  ? class WebjsFrame extends HTMLElement {
    // No shadow root and no render(). The element exists purely as a
    // swap anchor with an addressable `id`. Children are normal
    // light-DOM children. The router does all the work.
  }
  : /** @type {any} */ (null);

if (typeof customElements !== 'undefined' && WebjsFrame && !customElements.get('webjs-frame')) {
  customElements.define('webjs-frame', WebjsFrame);
}

export { WebjsFrame };
