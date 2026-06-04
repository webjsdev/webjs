import { WebComponent, html } from '@webjsdev/core';

/**
 * <cursor-glow> paints a soft accent halo that follows the mouse, a
 * decorative layer behind the page content.
 *
 * Pure progressive enhancement. With no JS, under prefers-reduced-motion,
 * or from a touch / pen pointer, the element stays fully transparent and the
 * static background glow (.glow-layer in app/layout.ts) carries the page. The
 * move handler writes CSS custom properties on the host (no per-frame
 * re-render, the correct pattern for a high-frequency pointer update), and
 * render() outputs a .cg-blob gradient that the `cursor-glow .cg-blob` rule in
 * app/layout.ts translates to the pointer via transform, a compositor-only
 * property, so the cursor-follow never triggers a repaint.
 */
export class CursorGlow extends WebComponent {
  private _raf = 0;
  private _x = 0;
  private _y = 0;
  private _mql?: MediaQueryList;

  _onMove = (e: PointerEvent) => {
    // Mouse only. Touch / pen pointermove would drag the halo under the
    // finger, which is not the effect, so ignore it.
    if (e.pointerType === 'touch' || e.pointerType === 'pen') return;
    this._x = e.clientX;
    this._y = e.clientY;
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this.style.setProperty('--cg-x', this._x + 'px');
      this.style.setProperty('--cg-y', this._y + 'px');
      this.style.setProperty('--cg-on', '1');
    });
  };

  // Re-evaluate when the OS reduced-motion preference flips mid-session, so
  // turning it ON detaches the tracker and turning it OFF re-attaches it
  // (addEventListener with the same handler is idempotent, removeEventListener
  // when absent is a no-op).
  _onMotionPref = () => {
    if (this._mql?.matches) window.removeEventListener('pointermove', this._onMove);
    else window.addEventListener('pointermove', this._onMove, { passive: true });
  };

  connectedCallback() {
    super.connectedCallback();
    this._mql = matchMedia('(prefers-reduced-motion: reduce)');
    this._mql.addEventListener('change', this._onMotionPref);
    if (!this._mql.matches) window.addEventListener('pointermove', this._onMove, { passive: true });
  }

  disconnectedCallback() {
    this._mql?.removeEventListener('change', this._onMotionPref);
    window.removeEventListener('pointermove', this._onMove);
    if (this._raf) cancelAnimationFrame(this._raf);
    super.disconnectedCallback?.();
  }

  render() {
    // A fixed-size blob translated to the pointer. Moving it is a transform
    // (compositor-only), so the cursor-follow never triggers a repaint.
    return html`<div class="cg-blob"></div>`;
  }
}
CursorGlow.register('cursor-glow');
