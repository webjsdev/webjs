import { WebComponent, html } from '@webjsdev/core';

/**
 * <scroll-reveal> fades page sections up as they enter the viewport.
 *
 * Pure progressive enhancement. The initial hidden state lives under a
 * `reveal-ready` class that THIS component adds at connect time, so with no
 * JS (or under prefers-reduced-motion) every [data-reveal] section is fully
 * visible and the class is never added. Sections already in view at connect
 * are revealed synchronously in the same frame the class is added, so they
 * never flash; the rest reveal on scroll via IntersectionObserver. The paired
 * CSS lives in app/layout.ts. The component renders nothing itself.
 *
 * On disconnect it drops `reveal-ready` again, so a page that swaps in without
 * a reveal observer can never be left with hidden content.
 */
export class ScrollReveal extends WebComponent {
  _io?: IntersectionObserver;
  private _mql?: MediaQueryList;

  // If the OS reduced-motion preference turns ON mid-session, stop observing
  // and drop the hidden-state class so nothing stays gated behind a reveal
  // that will not run. Re-enabling it does nothing: the sections are already
  // visible, and re-hiding them to re-animate would flash.
  _onMotionPref = () => {
    if (this._mql?.matches) {
      this._io?.disconnect();
      this._io = undefined;
      this.ownerDocument.documentElement.classList.remove('reveal-ready');
    }
  };

  connectedCallback() {
    super.connectedCallback();
    this._mql = matchMedia('(prefers-reduced-motion: reduce)');
    this._mql.addEventListener('change', this._onMotionPref);
    if (this._mql.matches) return;
    const doc = this.ownerDocument;
    const els = Array.from(doc.querySelectorAll('[data-reveal]'));
    if (!els.length) return;

    doc.documentElement.classList.add('reveal-ready');
    this._io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          this._io?.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });

    const vh = window.innerHeight || doc.documentElement.clientHeight;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      // Already in view: reveal in this same frame so it does not flash.
      if (r.top < vh && r.bottom > 0) el.classList.add('is-revealed');
      else this._io.observe(el);
    }
  }

  disconnectedCallback() {
    this._mql?.removeEventListener('change', this._onMotionPref);
    this._io?.disconnect();
    this._io = undefined;
    this.ownerDocument.documentElement.classList.remove('reveal-ready');
    super.disconnectedCallback?.();
  }

  render() {
    return html``;
  }
}
ScrollReveal.register('scroll-reveal');
