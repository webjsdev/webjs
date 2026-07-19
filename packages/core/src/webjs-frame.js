/**
 * `<webjs-frame id="...">`: escape-hatch partial-swap region.
 *
 * The framework's primary partial-nav mechanism auto-derives swap
 * boundaries from the folder structure (each `layout.{js,ts}`'s
 * children-slot is wrapped in a keyed `<!--wj:children:<segment>:<route-key>-->` boundary
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
 * External targeting (Turbo's `data-turbo-frame`): a trigger (an `<a>`
 * or a `<form>`) that is NOT nested inside the frame can still drive it
 * by carrying `data-webjs-frame="<id>"`. The router resolves the id via
 * `getElementById` in the current document, so an external nav/sidebar
 * link or a filter form drives a content frame it does not enclose. An
 * id that does not resolve to a live `<webjs-frame>` warns once and falls
 * back to a normal navigation (fail-safe, never a wrong-region swap). The
 * reserved token `data-webjs-frame="_top"` on a trigger INSIDE a frame
 * breaks OUT to a full-page navigation instead of swapping the frame.
 *
 * Busy state: while a frame's navigation is in flight the router sets the
 * native `aria-busy="true"` on the frame element and clears it (to
 * `"false"`) on completion, success, failure, or abort, so assistive tech
 * announces the loading state and CSS can style `webjs-frame[aria-busy="true"]`.
 * It also dispatches a bubbling `webjs:frame-busy` event on the frame at
 * both edges (detail `{ frameId, busy: true }` then `{ frameId, busy: false }`),
 * so app code can hook the start and finish.
 *
 * The element is **light DOM**: no shadow root, no slot mechanics.
 * Children are normal light-DOM children that the router replaces
 * via the same keyed reconciler used for layout marker swaps. This
 * means scroll position, input values, and `<details>` open state
 * are preserved for any matched elements inside the frame.
 *
 * With JS disabled a `data-webjs-frame` link is an inert attribute on a
 * plain `<a href>`, so the click is a normal full-page navigation, the
 * correct progressive-enhancement fallback.
 *
 * Self-loading (`src` + `loading`): a frame MAY fetch its own content. With
 * a `src` attribute the frame self-fetches that URL as a frame nav and applies
 * the matching `<webjs-frame id>` subtree from the response into itself, through
 * the SAME router frame-swap path a click-driven frame nav uses (so the busy
 * lifecycle, the navigation-error recovery, and the frame-missing fallback all
 * apply). The `loading` attribute picks WHEN:
 *
 *   - `loading="eager"` (or absent, the default): fetch on `connectedCallback`.
 *   - `loading="lazy"`: fetch when the frame first scrolls into view, reusing
 *     the same IntersectionObserver budget (`rootMargin: '200px'`) as a
 *     `static lazy = true` component.
 *
 * A `src` change after connect re-loads. Eager-connect, the lazy observer, and
 * a `src` mutation never double-fire: a per-element loaded/loading guard keyed
 * on the resolved URL coalesces them.
 *
 * PROGRESSIVE ENHANCEMENT CAVEAT: a `src`-driven frame is JS-DEPENDENT. The
 * browser does NOT natively fetch `<webjs-frame src>` (unlike `<iframe>`), so
 * with JS off the frame shows only whatever children were server-rendered into
 * it. Use `src`/`loading` for DEFERRED content (comments, a recommendations
 * rail, an expensive card) where a JS-off empty/placeholder state is acceptable.
 * For content that MUST exist without JS, render it server-side into the frame
 * instead of using `src` (the self-load then replaces those fallback children).
 *
 * @element webjs-frame
 * @attr {string} id: Required. The frame's identifier, used by
 *   `closest()` on the client, `getElementById` for external
 *   `data-webjs-frame` targeting, and `querySelector` on the response.
 * @attr {string} src: Optional. A same-origin URL the frame self-fetches as a
 *   frame nav, applying the matching `<webjs-frame id>` subtree into itself.
 * @attr {string} loading: Optional. `eager` (default) fetches `src` on connect;
 *   `lazy` fetches when the frame scrolls into view.
 * @fires webjs:frame-busy: Bubbling. Dispatched on the frame when its
 *   navigation starts (`detail.busy === true`) and finishes
 *   (`detail.busy === false`); `detail.frameId` names the frame.
 */
// Defined lazily inside an IIFE so that importing this module on the
// server (Node) doesn't trip a `HTMLElement is not defined` reference
// error. Server-side renderers never touch the class: the element
// is always rendered as `<webjs-frame id=... src=... loading=...>` plain
// HTML by the renderToString pipeline.
const WebjsFrame = (typeof HTMLElement !== 'undefined')
  ? class WebjsFrame extends HTMLElement {
    constructor() {
      super();
      /**
       * The `src` value most recently loaded (or loading). Guards against a
       * double-load when eager connect, the lazy observer, and a `src`
       * mutation all want to fire: a load only starts when the resolved URL
       * differs from this. `null` means "nothing loaded yet".
       * @type {string | null}
       */
      this._webjsLoadedSrc = null;
      /**
       * Teardown for the lazy IntersectionObserver subscription, so a
       * disconnect or a `src` change stops observing.
       * @type {(() => void) | null}
       */
      this._webjsLazyTeardown = null;
    }

    static get observedAttributes() { return ['src']; }

    connectedCallback() {
      this._webjsScheduleLoad();
    }

    disconnectedCallback() {
      if (this._webjsLazyTeardown) { this._webjsLazyTeardown(); this._webjsLazyTeardown = null; }
    }

    /**
     * @param {string} name
     * @param {string | null} _old
     * @param {string | null} _next
     */
    attributeChangedCallback(name, _old, _next) {
      // Only react to a `src` change AFTER the element is connected (the
      // initial attribute parse fires this before connectedCallback; the
      // connect path handles the first load). A live `src` swap re-loads.
      if (name === 'src' && this.isConnected) this._webjsScheduleLoad();
    }

    /**
     * Decide whether and when to self-load based on `src` + `loading`,
     * coalescing the three triggers (eager connect, lazy viewport, `src`
     * mutation) so the frame never double-fetches the same URL.
     */
    _webjsScheduleLoad() {
      const src = this.getAttribute('src');
      // No src: nothing to self-load (a normal swap-anchor frame). Drop any
      // pending lazy observation left over from a previous src.
      if (!src) {
        if (this._webjsLazyTeardown) { this._webjsLazyTeardown(); this._webjsLazyTeardown = null; }
        this._webjsLoadedSrc = null;
        return;
      }
      // Resolve so the dedupe key matches what loadFrame requests, and so a
      // relative `src` compares stably.
      let resolved = src;
      try { resolved = new URL(src, location.href).href; } catch { /* keep raw */ }
      // Already loaded (or loading) this exact URL: no double-load.
      if (resolved === this._webjsLoadedSrc) return;

      // A new src supersedes any in-flight lazy observation.
      if (this._webjsLazyTeardown) { this._webjsLazyTeardown(); this._webjsLazyTeardown = null; }

      const lazy = (this.getAttribute('loading') || 'eager').toLowerCase() === 'lazy';
      if (lazy) {
        // Defer the fetch until the frame enters the viewport, reusing the
        // shared per-element IntersectionObserver. Mark the URL as claimed
        // NOW so a redundant schedule (e.g. attributeChanged firing again
        // with the same src) does not re-observe.
        this._webjsLoadedSrc = resolved;
        import('./lazy-loader.js').then(({ observeViewportOnce }) => {
          // Bail if the src changed again while the import was in flight.
          if (this._webjsLoadedSrc !== resolved || !this.isConnected) return;
          this._webjsLazyTeardown = observeViewportOnce(this, () => {
            this._webjsLazyTeardown = null;
            this._webjsLoad(resolved);
          });
        });
      } else {
        this._webjsLoadedSrc = resolved;
        this._webjsLoad(resolved);
      }
    }

    /**
     * Run the actual frame self-load through the router's frame-swap path.
     * @param {string} resolved  The already-resolved absolute URL.
     */
    _webjsLoad(resolved) {
      import('./router-client.js').then(({ loadFrame }) => {
        // The src may have changed again (or the frame disconnected) between
        // scheduling and the import resolving; only load if we still own it.
        if (this._webjsLoadedSrc !== resolved || !this.isConnected) return;
        loadFrame(this, resolved);
      });
    }
  }
  : /** @type {any} */ (null);

if (typeof customElements !== 'undefined' && WebjsFrame && !customElements.get('webjs-frame')) {
  customElements.define('webjs-frame', WebjsFrame);
}

export { WebjsFrame };
