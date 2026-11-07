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
 * Which active link to scroll to is shadcn's getActiveItem: the longest href
 * (a Sections link also matches by prefix), and among equal ones the link
 * nearest the middle of the sidebar, so /ui/docs/installation stays on
 * Sections rather than jumping to its second copy under Get Started. It
 * scrolls only when that link is out of view, and a path the reader already
 * scrolled the sidebar on gets that position back (sessionStorage, shadcn's
 * `docs-sidebar-scroll` key).
 *
 * `webjs:navigate` and `popstate` are both listened to, for the reason
 * components/docs-drawer.ts gives: a back or forward served from the snapshot
 * cache may never fire `webjs:navigate`. Both handlers are idempotent.
 */
const SCROLL_KEY = 'docs-sidebar-scroll';

export class UiDocsSidebar extends WebComponent {
  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('webjs:navigate', this._sync);
    window.addEventListener('popstate', this._sync);
    this._scroller()?.addEventListener('scroll', this._save, { passive: true });
    // On a full load the element connects before layout has sized the
    // scroller, so a scroll measured now would be against a box of height 0.
    requestAnimationFrame(this._sync);
  }

  disconnectedCallback() {
    document.removeEventListener('webjs:navigate', this._sync);
    window.removeEventListener('popstate', this._sync);
    this._scroller()?.removeEventListener('scroll', this._save);
    super.disconnectedCallback();
  }

  _scroller(): HTMLElement | null {
    return this.querySelector<HTMLElement>('[data-docs-sidebar-content]');
  }

  _save = (): void => {
    const scroller = this._scroller();
    if (!scroller) return;
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ pathname: location.pathname, scrollTop: scroller.scrollTop }));
    } catch {}
  };

  _sync = (): void => {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    for (const a of Array.from(this.querySelectorAll<HTMLAnchorElement>('a[data-slot="sidebar-menu-button"]'))) {
      const href = a.getAttribute('href') ?? '';
      const active = a.dataset.match === 'prefix' ? path === href || path.startsWith(href + '/') : path === href;
      a.dataset.active = active ? 'true' : 'false';
      if (active && a.dataset.match !== 'prefix') a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    const scroller = this._scroller();
    if (!scroller) return;
    let saved: { pathname?: string; scrollTop?: number } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? '');
    } catch {}
    if (saved?.pathname === location.pathname && typeof saved.scrollTop === 'number') {
      scroller.scrollTop = saved.scrollTop;
    } else {
      const best = activeItem(scroller);
      if (best) {
        // Bring it into view, centred, only when it is outside the scroller.
        const box = scroller.getBoundingClientRect();
        const r = best.getBoundingClientRect();
        if (r.top < box.top || r.bottom > box.bottom) {
          scroller.scrollTop += r.top - box.top - (scroller.clientHeight - r.height) / 2;
        }
      }
    }
    this._save();
  };

  render() {
    return html`<slot></slot>`;
  }
}

/** shadcn's getActiveItem: the longest active href, then the one nearest the middle. */
export function activeItem(scroller: HTMLElement): HTMLElement | null {
  const box = scroller.getBoundingClientRect();
  const middle = box.top + scroller.clientHeight / 2;
  let best: HTMLElement | null = null;
  let bestLength = -1;
  let bestDistance = Infinity;
  for (const a of Array.from(scroller.querySelectorAll<HTMLElement>('[data-active="true"]'))) {
    const length = (a.getAttribute('href') ?? '').length;
    const r = a.getBoundingClientRect();
    const distance = Math.abs(r.top + r.height / 2 - middle);
    if (length > bestLength || (length === bestLength && distance < bestDistance)) {
      best = a;
      bestLength = length;
      bestDistance = distance;
    }
  }
  return best;
}

UiDocsSidebar.register('ui-docs-sidebar');
