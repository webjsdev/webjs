import { WebComponent, html } from '@webjsdev/core';

/**
 * <cursor-glow> paints a soft accent halo that follows the mouse, a
 * decorative layer behind the page content.
 *
 * Pure progressive enhancement. With no JS, under prefers-reduced-motion,
 * or from a touch / pen pointer, the element stays fully transparent and the
 * static background glow (.glow-layer in app/layout.ts) carries the page. The
 * host element IS the layer: the move handler writes CSS custom properties on
 * it (no per-frame re-render, the correct pattern for a high-frequency pointer
 * update), and the gradient itself is declared by the `cursor-glow` rule in
 * app/layout.ts. render() is intentionally empty.
 */
export class CursorGlow extends WebComponent {
  private _raf = 0;
  private _x = 0;
  private _y = 0;

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

  connectedCallback() {
    super.connectedCallback();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    window.addEventListener('pointermove', this._onMove, { passive: true });
  }

  disconnectedCallback() {
    window.removeEventListener('pointermove', this._onMove);
    if (this._raf) cancelAnimationFrame(this._raf);
    super.disconnectedCallback?.();
  }

  render() {
    return html``;
  }
}
CursorGlow.register('cursor-glow');
