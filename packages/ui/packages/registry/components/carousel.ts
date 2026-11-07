/**
 * Carousel: a row (or column) of slides you swipe, scroll or step through.
 * Tier-2. shadcn's is Embla; this is CSS scroll snap, so the slides scroll
 * and snap natively, by touch, trackpad and wheel, with no JavaScript at all.
 * The element adds the Previous / Next buttons, the arrow keys, and an `api`
 * for stepping.
 *
 * shadcn parity:
 *   Carousel orientation     → <ui-carousel orientation="horizontal" | "vertical" loop>
 *   CarouselContent          → <ui-carousel-content>
 *   CarouselItem             → <ui-carousel-item> (size a slide with basis-*, e.g. class="basis-1/3")
 *   CarouselPrevious / Next  → <ui-carousel-previous> / <ui-carousel-next> (`variant`, `size`)
 *   setApi / api             → the element itself: scrollPrev(), scrollNext(), scrollTo(i),
 *                              selectedIndex, canScrollPrev, canScrollNext
 *   api.on("select")         → `ui-slide-change` ({ detail: { index } })
 *
 * Slides are spaced the way shadcn spaces them (a start padding on each, a
 * negative margin on the track), and each snaps on its content, so a stepped
 * slide rests exactly where the first one does. A vertical carousel needs a
 * height: put it on `<ui-carousel-content>`.
 *
 * A11y (handled by the element, plus your part): the root is a
 * `role="region"` with `aria-roledescription="carousel"`, each slide a
 * `role="group"` with `aria-roledescription="slide"`, the buttons are named
 * "Previous slide" / "Next slide" and disabled at the ends, and ArrowLeft /
 * ArrowRight step while focus is inside. Your part: name the carousel
 * (`aria-label` on `<ui-carousel>`), and keep the buttons on screen, which
 * means room beside it, since they sit outside its edges as in shadcn.
 *
 * @example
 * ```html
 * <ui-carousel aria-label="Featured" class="w-full max-w-xs">
 *   <ui-carousel-content>
 *     <ui-carousel-item><div class="flex aspect-square items-center justify-center rounded-lg border p-6">1</div></ui-carousel-item>
 *     <ui-carousel-item><div class="flex aspect-square items-center justify-center rounded-lg border p-6">2</div></ui-carousel-item>
 *     <ui-carousel-item><div class="flex aspect-square items-center justify-center rounded-lg border p-6">3</div></ui-carousel-item>
 *   </ui-carousel-content>
 *   <ui-carousel-previous></ui-carousel-previous>
 *   <ui-carousel-next></ui-carousel-next>
 * </ui-carousel>
 * ```
 */
import { WebComponent, html, prop } from '@webjsdev/core';
import { cn, takeAuthoredClass } from '../lib/utils.ts';
import { buttonClass, type ButtonVariant, type ButtonSize } from './button.ts';

/** The scroller's classes (the element applies them). */
export function carouselContentClass(orientation: 'horizontal' | 'vertical' = 'horizontal'): string {
  return orientation === 'vertical'
    ? 'h-full overflow-x-hidden overflow-y-auto overscroll-y-contain snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    : 'overflow-x-auto overflow-y-hidden overscroll-x-contain snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';
}

/** A slide's classes (the element puts them on the slide itself). */
export function carouselItemClass(orientation: 'horizontal' | 'vertical' = 'horizontal'): string {
  return cn('relative min-w-0 shrink-0 grow-0 basis-full', orientation === 'vertical' ? 'pt-4' : 'ps-4');
}

const ROOT = 'ui-carousel';

function rootOf(el: Element): UiCarousel | null {
  return (typeof el.closest === 'function' ? el.closest(ROOT) : null) as UiCarousel | null;
}

function orientationOf(el: Element): 'horizontal' | 'vertical' {
  return rootOf(el)?.orientation === 'vertical' ? 'vertical' : 'horizontal';
}

// --------------------------------------------------------------------------
// <ui-carousel>
// --------------------------------------------------------------------------

export class UiCarousel extends WebComponent({
  orientation: prop<'horizontal' | 'vertical'>(String, { reflect: true }),
  loop: Boolean,
  edges: prop<{ prev: boolean; next: boolean }>({ state: true }),
}) {
  /** The slide nearest the start of the scroller. */
  selectedIndex = 0;
  _frame = 0;

  constructor() {
    super();
    this.orientation = 'horizontal';
    this.loop = false;
    this.edges = { prev: false, next: false };
  }

  get canScrollPrev(): boolean {
    return this.loop ? this._items().length > 1 : this.edges.prev;
  }

  get canScrollNext(): boolean {
    return this.loop ? this._items().length > 1 : this.edges.next;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    window.addEventListener('resize', this._measure);
    queueMicrotask(() => this._measure());
  }

  disconnectedCallback(): void {
    window.removeEventListener('resize', this._measure);
    cancelAnimationFrame(this._frame);
    super.disconnectedCallback?.();
  }

  render() {
    return html`<div
      data-slot="carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label=${this.getAttribute?.('aria-label') || null}
      class="relative"
      @keydown=${this._onKeyDown}
      @scroll=${this._onScroll}
    ><slot></slot></div>`;
  }

  _scroller(): HTMLElement | null {
    return this.querySelector<HTMLElement>('[data-slot="carousel-content"]');
  }

  _items(): HTMLElement[] {
    if (typeof this.querySelectorAll !== 'function') return [];
    return Array.from(this.querySelectorAll<HTMLElement>('ui-carousel-item')).filter((i) => rootOf(i) === this);
  }

  // Where a slide's content starts, which is where it snaps.
  _start(item: HTMLElement): number {
    const marker = item.querySelector<HTMLElement>('[data-carousel-snap]') ?? item;
    const r = marker.getBoundingClientRect();
    return this.orientation === 'vertical' ? r.top : (this._rtl() ? r.right : r.left);
  }

  _rtl(): boolean {
    return typeof getComputedStyle === 'function' && getComputedStyle(this).direction === 'rtl';
  }

  /**
   * Scroll slide `index` to the start, shadcn's `api.scrollTo(index)`. The
   * element IS the api, so this sits on Element.scrollTo: one number is a
   * slide index, and the native forms (`scrollTo(x, y)`, `scrollTo(options)`)
   * still scroll the element itself.
   */
  scrollTo(index?: number | ScrollToOptions, y?: number): void {
    if (typeof index !== 'number' || y !== undefined) {
      if (typeof index === 'number') super.scrollTo(index, y as number);
      else super.scrollTo(index);
      return;
    }
    const scroller = this._scroller();
    const items = this._items();
    const item = items[index];
    if (!scroller || !item) return;
    const s = scroller.getBoundingClientRect();
    const origin = this.orientation === 'vertical' ? s.top : (this._rtl() ? s.right : s.left);
    const delta = this._start(item) - origin;
    const smooth = !matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollBy(this.orientation === 'vertical'
      ? { top: delta, behavior: smooth ? 'smooth' : 'auto' }
      : { left: delta, behavior: smooth ? 'smooth' : 'auto' });
  }

  /** Step back one slide (to the last with `loop`). */
  scrollPrev(): void {
    const n = this._items().length;
    if (!n) return;
    if (this.selectedIndex > 0) this.scrollTo(this.selectedIndex - 1);
    else if (this.loop) this.scrollTo(n - 1);
  }

  /** Step on one slide (to the first with `loop`). */
  scrollNext(): void {
    const n = this._items().length;
    if (!n) return;
    if (this.selectedIndex < n - 1 && this.edges.next) this.scrollTo(this.selectedIndex + 1);
    else if (this.loop) this.scrollTo(0);
  }

  _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.scrollPrev(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.scrollNext(); }
  };

  // Scroll does not bubble, so the scroller's own listener calls this.
  _onScroll = (): void => {
    cancelAnimationFrame(this._frame);
    this._frame = requestAnimationFrame(this._measure);
  };

  // Which slide is selected, and whether the ends are reached.
  _measure = (): void => {
    const scroller = this._scroller();
    if (!scroller) return;
    const vertical = this.orientation === 'vertical';
    const pos = Math.abs(vertical ? scroller.scrollTop : scroller.scrollLeft);
    const max = vertical ? scroller.scrollHeight - scroller.clientHeight : scroller.scrollWidth - scroller.clientWidth;
    const s = scroller.getBoundingClientRect();
    const origin = vertical ? s.top : (this._rtl() ? s.right : s.left);
    const items = this._items();
    let best = 0;
    let bestD = Infinity;
    items.forEach((item, i) => {
      const d = Math.abs(this._start(item) - origin);
      if (d < bestD) { bestD = d; best = i; }
    });
    // At the far end, the last slide counts as selected even when it cannot
    // reach the start.
    if (max > 0 && pos >= max - 1) best = items.length - 1;
    const edges = { prev: pos > 1, next: pos < max - 1 };
    if (edges.prev !== this.edges.prev || edges.next !== this.edges.next) this.edges = edges;
    if (best !== this.selectedIndex) {
      this.selectedIndex = best;
      this.dispatchEvent(new CustomEvent('ui-slide-change', { bubbles: true, detail: { index: best } }));
    }
    for (const b of Array.from(this.querySelectorAll<UiCarouselButton>('ui-carousel-previous, ui-carousel-next'))) b.requestUpdate?.();
  };
}
UiCarousel.register('ui-carousel');

// --------------------------------------------------------------------------
// <ui-carousel-content>
// --------------------------------------------------------------------------

export class UiCarouselContent extends WebComponent {
  _resize: ResizeObserver | null = null;

  // The slides arrive and lay out after this connects, and can change size
  // at any time, so the ends are re-measured whenever the strip resizes.
  connectedCallback(): void {
    super.connectedCallback?.();
    if (typeof ResizeObserver === 'function') {
      this._resize = new ResizeObserver(() => rootOf(this)?._onScroll());
      queueMicrotask(() => {
        const scroller = this.querySelector('[data-slot="carousel-content"]');
        if (scroller) {
          this._resize?.observe(scroller);
          if (scroller.firstElementChild) this._resize?.observe(scroller.firstElementChild);
        }
      });
    }
  }

  disconnectedCallback(): void {
    this._resize?.disconnect();
    this._resize = null;
    super.disconnectedCallback?.();
  }

  render() {
    const o = orientationOf(this);
    return html`<div
      data-slot="carousel-content"
      class=${carouselContentClass(o)}
      @scroll=${() => rootOf(this)?._onScroll()}
    ><div class=${cn('flex', o === 'vertical' ? 'h-full -mt-4 flex-col' : '-ms-4')}><slot></slot></div></div>`;
  }
}
UiCarouselContent.register('ui-carousel-content');

// --------------------------------------------------------------------------
// <ui-carousel-item>
// --------------------------------------------------------------------------

export class UiCarouselItem extends WebComponent {
  _authored: string | null = null;

  _root: UiCarousel | null = null;

  // Adding or removing a slide changes how far the strip scrolls without
  // resizing it, so the carousel re-measures. A removed slide can no longer
  // find its carousel, so it remembers it.
  connectedCallback(): void {
    super.connectedCallback?.();
    this._root = rootOf(this);
    this._root?._onScroll();
  }

  disconnectedCallback(): void {
    this._root?._onScroll();
    this._root = null;
    super.disconnectedCallback?.();
  }

  // A slide is the flex child itself, so it carries its own classes, role and
  // slot name; the first render keeps whatever classes the author wrote.
  render() {
    this._authored = takeAuthoredClass(this);
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('class', cn(carouselItemClass(orientationOf(this)), this._authored));
      this.setAttribute('role', 'group');
      this.setAttribute('aria-roledescription', 'slide');
      this.setAttribute('data-slot', 'carousel-item');
    }
    // The snap point is the content's start, past the spacing padding: an
    // absolutely positioned marker with no insets sits at its static
    // position, which is exactly there, and adds no height. It is 1px, not
    // 0, because a zero-size snap area is ignored and mandatory snapping
    // then has nowhere to land.
    return html`<span data-carousel-snap aria-hidden="true" class="absolute size-px snap-start"></span><slot></slot>`;
  }
}
UiCarouselItem.register('ui-carousel-item');

// --------------------------------------------------------------------------
// <ui-carousel-previous> and <ui-carousel-next>
// --------------------------------------------------------------------------

export class UiCarouselButton extends WebComponent({
  variant: String,
  size: String,
}) {
  static part = '';
  static label = '';

  constructor() {
    super();
    this.variant = 'outline';
    this.size = 'icon-sm';
  }

  render() {
    const ctor = this.constructor as typeof UiCarouselButton;
    const root = rootOf(this);
    const prev = ctor.part === 'previous';
    const vertical = orientationOf(this) === 'vertical';
    const can = root ? (prev ? root.canScrollPrev : root.canScrollNext) : false;
    const place = prev
      ? (vertical ? '-top-12 left-1/2 -translate-x-1/2 rotate-90' : 'inset-y-0 -start-12 my-auto')
      : (vertical ? '-bottom-12 left-1/2 -translate-x-1/2 rotate-90' : 'inset-y-0 -end-12 my-auto');
    return html`<button
      type="button"
      data-slot=${`carousel-${ctor.part}`}
      ?disabled=${!can}
      class=${cn(buttonClass({ variant: this.variant as ButtonVariant, size: this.size as ButtonSize }), prev ? 'cn-carousel-previous absolute touch-manipulation' : 'cn-carousel-next absolute touch-manipulation', place)}
      @click=${() => (prev ? root?.scrollPrev() : root?.scrollNext())}
    ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="cn-rtl-flip"><path d=${prev ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}></path></svg><span class="sr-only">${ctor.label}</span></button>`;
  }
}

export class UiCarouselPrevious extends UiCarouselButton {
  static part = 'previous';
  static label = 'Previous slide';
}
UiCarouselPrevious.register('ui-carousel-previous');

export class UiCarouselNext extends UiCarouselButton {
  static part = 'next';
  static label = 'Next slide';
}
UiCarouselNext.register('ui-carousel-next');
