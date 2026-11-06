import { WebComponent, html } from '@webjsdev/core';

/**
 * `<ui-docs-sidebar>` keeps the /ui docs sidebar's active link right across a
 * soft navigation, and keeps the active link in view, as shadcn's DocsSidebar
 * does (apps/v4/components/docs-sidebar.tsx).
 *
 * The markup is the server's (lib/ui/docs/sidebar.ts), which marks the active
 * link for the request it rendered. A navigation from one docs page to
 * another MORPHS the docs layout instead of re-rendering it, so without this
 * the first page's link would stay marked. Each link carries `data-match`
 * (`exact`, or `prefix` for a Sections link that covers its subtree).
 *
 * `webjs:navigate` and `popstate` are both listened to, for the reason
 * components/docs-drawer.ts gives: a back or forward served from the snapshot
 * cache may never fire `webjs:navigate`. Both handlers are idempotent.
 */
export class UiDocsSidebar extends WebComponent {
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('webjs:navigate', this._sync);
    window.addEventListener('popstate', this._sync);
    // On a full load the element connects before layout has sized the
    // scroller, so a scroll measured now would be against a box of height 0.
    requestAnimationFrame(this._sync);
  }

  disconnectedCallback() {
    document.removeEventListener('webjs:navigate', this._sync);
    window.removeEventListener('popstate', this._sync);
    super.disconnectedCallback();
  }

  _sync = (): void => {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    let best: HTMLElement | null = null;
    for (const a of Array.from(this.querySelectorAll<HTMLAnchorElement>('a[data-slot="sidebar-menu-button"]'))) {
      const href = a.getAttribute('href') ?? '';
      const active = a.dataset.match === 'prefix' ? path === href || path.startsWith(href + '/') : path === href;
      a.dataset.active = active ? 'true' : 'false';
      if (active && a.dataset.match !== 'prefix') {
        a.setAttribute('aria-current', 'page');
        best = a;
      } else {
        a.removeAttribute('aria-current');
      }
    }
    // Bring the page's own link into view if it is outside the scroller,
    // centred, the way shadcn restores it. A link already visible stays put.
    const scroller = this.querySelector<HTMLElement>('[data-docs-sidebar-content]');
    if (best && scroller) {
      const box = scroller.getBoundingClientRect();
      const r = best.getBoundingClientRect();
      if (r.top < box.top || r.bottom > box.bottom) {
        scroller.scrollTop += r.top - box.top - (scroller.clientHeight - r.height) / 2;
      }
    }
  };

  render() {
    return html`<slot></slot>`;
  }
}
UiDocsSidebar.register('ui-docs-sidebar');
