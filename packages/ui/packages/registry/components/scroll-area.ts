import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Scroll area — scrolling container with a Radix-style custom scrollbar UI.
 *
 *   <ui-scroll-area style="height:200px">…</ui-scroll-area>
 *   <ui-scroll-area type="always">…</ui-scroll-area>   // always-on thumbs
 *
 * `type` controls thumb visibility:
 *   - "hover"  (default) — thumbs fade in on hover
 *   - "always"            — thumbs always visible
 *   - "auto" | "scroll"   — visible (same as always for v1)
 *
 * Native scrollbars are hidden; custom thumbs track scroll position and are
 * pointer-draggable. Thumb size = (viewport / content) * trackLength.
 */
export class UiScrollArea extends WebComponent {
  static properties = { type: { type: String, reflect: true } };
  declare type: string;

  private _slot = '';
  private _viewport: HTMLElement | null = null;
  private _vThumb: HTMLElement | null = null;
  private _hThumb: HTMLElement | null = null;
  private _ro: ResizeObserver | null = null;
  private _rafPending = false;
  private _dragAxis: 'y' | 'x' | null = null;
  private _dragStart = { pointer: 0, scroll: 0 };

  constructor() {
    super();
    this.type = 'hover';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._ro?.disconnect();
    this._ro = null;
  }

  firstUpdated() {
    this._viewport = this.querySelector('[data-slot="scroll-area-viewport"]');
    this._vThumb = this.querySelector('[data-slot="scroll-area-thumb"][data-orientation="vertical"]');
    this._hThumb = this.querySelector('[data-slot="scroll-area-thumb"][data-orientation="horizontal"]');
    if (!this._viewport) return;
    this._viewport.addEventListener('scroll', this._onScroll, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._updateThumbs());
      this._ro.observe(this._viewport);
      const inner = this._viewport.firstElementChild;
      if (inner) this._ro.observe(inner);
    }
    this._vThumb?.addEventListener('pointerdown', (e) => this._onThumbDown(e, 'y'));
    this._hThumb?.addEventListener('pointerdown', (e) => this._onThumbDown(e, 'x'));
    queueMicrotask(() => this._updateThumbs());
  }

  _onScroll = () => {
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      this._updateThumbs();
    });
  };

  _updateThumbs() {
    const v = this._viewport;
    if (!v) return;
    // Vertical
    if (this._vThumb) {
      const ratio = v.clientHeight / Math.max(v.scrollHeight, 1);
      const visible = ratio < 1;
      const track = v.clientHeight;
      const thumbSize = Math.max(ratio * track, 20);
      const maxScroll = v.scrollHeight - v.clientHeight;
      const pos = maxScroll > 0 ? (v.scrollTop / maxScroll) * (track - thumbSize) : 0;
      this._vThumb.style.height = `${thumbSize}px`;
      this._vThumb.style.transform = `translateY(${pos}px)`;
      this._vThumb.parentElement?.setAttribute('data-visible', String(visible));
    }
    // Horizontal
    if (this._hThumb) {
      const ratio = v.clientWidth / Math.max(v.scrollWidth, 1);
      const visible = ratio < 1;
      const track = v.clientWidth;
      const thumbSize = Math.max(ratio * track, 20);
      const maxScroll = v.scrollWidth - v.clientWidth;
      const pos = maxScroll > 0 ? (v.scrollLeft / maxScroll) * (track - thumbSize) : 0;
      this._hThumb.style.width = `${thumbSize}px`;
      this._hThumb.style.transform = `translateX(${pos}px)`;
      this._hThumb.parentElement?.setAttribute('data-visible', String(visible));
    }
  }

  _onThumbDown = (e: PointerEvent, axis: 'y' | 'x') => {
    const v = this._viewport;
    if (!v) return;
    e.preventDefault();
    this._dragAxis = axis;
    this._dragStart = {
      pointer: axis === 'y' ? e.clientY : e.clientX,
      scroll: axis === 'y' ? v.scrollTop : v.scrollLeft,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove', this._onThumbMove);
    window.addEventListener('pointerup', this._onThumbUp);
  };

  _onThumbMove = (e: PointerEvent) => {
    const v = this._viewport;
    if (!v || !this._dragAxis) return;
    const axis = this._dragAxis;
    if (axis === 'y') {
      const track = v.clientHeight;
      const ratio = v.clientHeight / Math.max(v.scrollHeight, 1);
      const thumbSize = Math.max(ratio * track, 20);
      const usable = track - thumbSize;
      const maxScroll = v.scrollHeight - v.clientHeight;
      const delta = e.clientY - this._dragStart.pointer;
      const ratioDelta = usable > 0 ? delta / usable : 0;
      v.scrollTop = this._dragStart.scroll + ratioDelta * maxScroll;
    } else {
      const track = v.clientWidth;
      const ratio = v.clientWidth / Math.max(v.scrollWidth, 1);
      const thumbSize = Math.max(ratio * track, 20);
      const usable = track - thumbSize;
      const maxScroll = v.scrollWidth - v.clientWidth;
      const delta = e.clientX - this._dragStart.pointer;
      const ratioDelta = usable > 0 ? delta / usable : 0;
      v.scrollLeft = this._dragStart.scroll + ratioDelta * maxScroll;
    }
  };

  _onThumbUp = () => {
    this._dragAxis = null;
    window.removeEventListener('pointermove', this._onThumbMove);
    window.removeEventListener('pointerup', this._onThumbUp);
  };

  render() {
    const alwaysOn = this.type === 'always' || this.type === 'auto' || this.type === 'scroll';
    const barVisibility = alwaysOn
      ? 'opacity-100'
      : 'opacity-0 group-hover/scroll-area:opacity-100 data-[visible=false]:opacity-0';
    return html`<div
      data-slot="scroll-area"
      class=${cn('group/scroll-area relative')}
    >
      <div
        data-slot="scroll-area-viewport"
        class=${cn(
          'size-full overflow-auto rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
        style="scrollbar-width:none"
      ><div>${unsafeHTML(this._slot)}</div></div>
      <div
        data-slot="scroll-area-scrollbar"
        data-orientation="vertical"
        data-visible="false"
        class=${cn('absolute top-0 right-0 flex h-full w-2.5 touch-none p-px border-l border-l-transparent select-none transition-colors', barVisibility)}
      >
        <div
          data-slot="scroll-area-thumb"
          data-orientation="vertical"
          class=${cn('relative w-full flex-1 rounded-full bg-border')}
        ></div>
      </div>
      <div
        data-slot="scroll-area-scrollbar"
        data-orientation="horizontal"
        data-visible="false"
        class=${cn('absolute bottom-0 left-0 flex h-2.5 w-full flex-col touch-none p-px border-t border-t-transparent select-none transition-colors', barVisibility)}
      >
        <div
          data-slot="scroll-area-thumb"
          data-orientation="horizontal"
          class=${cn('relative h-full flex-1 rounded-full bg-border')}
        ></div>
      </div>
    </div>`;
  }
}
UiScrollArea.register('ui-scroll-area');
