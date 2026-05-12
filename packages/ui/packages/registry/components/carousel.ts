import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import EmblaCarousel from 'embla-carousel';
import type { EmblaCarouselType, EmblaOptionsType, EmblaPluginType } from 'embla-carousel';
import { cn } from '../lib/utils.ts';

/**
 * Carousel built on embla-carousel (the framework-agnostic core that
 * powers shadcn's React carousel). Supports horizontal / vertical, swipe
 * gestures, momentum, snap, loop, multi-slide views, and plugins (autoplay
 * is one `npm install embla-carousel-autoplay` away).
 *
 *   <ui-carousel orientation="horizontal" loop align="start" slides-to-scroll="1">
 *     <ui-carousel-content>
 *       <ui-carousel-item>...</ui-carousel-item>
 *       <ui-carousel-item>...</ui-carousel-item>
 *     </ui-carousel-content>
 *     <ui-carousel-previous></ui-carousel-previous>
 *     <ui-carousel-next></ui-carousel-next>
 *   </ui-carousel>
 *
 * Options on `<ui-carousel>`:
 *  - `orientation="horizontal|vertical"` (default horizontal)
 *  - `loop`                              (boolean attr)
 *  - `align="start|center|end"`          (default start)
 *  - `slides-to-scroll="N"`              (default 1)
 *  - `start-index="N"`                   (initial slide)
 *  - `drag-free`                         (boolean — free-scrolling, no snap)
 *  - `container-scroll`                  (boolean — uses container scroll behaviour)
 *
 * Programmatic API on the host:
 *  - `host.scrollPrev()` / `host.scrollNext()` / `host.scrollTo(i)`
 *  - `host.embla` — direct embla instance for power users
 *
 * Events on the host:
 *  - `select`  → `{ detail: { index } }` whenever the visible slide changes
 *  - `change`  → alias of `select` (legacy)
 *  - `init`    → `{ detail: { embla } }` once after embla initializes
 */

export class UiCarousel extends WebComponent {
  static properties = {
    orientation: { type: String, reflect: true },
    loop: { type: Boolean, reflect: true },
    align: { type: String, reflect: true },
    'slides-to-scroll': { type: Number, attribute: 'slides-to-scroll' },
    'start-index': { type: Number, attribute: 'start-index' },
    'drag-free': { type: Boolean, attribute: 'drag-free' },
  };
  declare orientation: 'horizontal' | 'vertical';
  declare loop: boolean;
  declare align: 'start' | 'center' | 'end';
  declare ['slides-to-scroll']: number;
  declare ['start-index']: number;
  declare ['drag-free']: boolean;

  /** Public embla instance — read-only, available after firstUpdated. */
  embla: EmblaCarouselType | null = null;

  private _slot = '';
  private _index = 0;
  private _onSelect = () => {
    if (!this.embla) return;
    this._index = this.embla.selectedScrollSnap();
    this._refreshButtons();
    this.dispatchEvent(new CustomEvent('select', { detail: { index: this._index }, bubbles: true, composed: true }));
    this.dispatchEvent(new CustomEvent('change', { detail: { index: this._index }, bubbles: true, composed: true }));
  };

  constructor() {
    super();
    this.orientation = 'horizontal';
    this.loop = false;
    this.align = 'start';
    this['slides-to-scroll'] = 1;
    this['start-index'] = 0;
    this['drag-free'] = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
    this.addEventListener('keydown', this._onKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this._onKey);
    this.embla?.destroy();
    this.embla = null;
  }

  firstUpdated() {
    const viewport = this.querySelector('ui-carousel-content [data-slot=carousel-viewport]') as HTMLElement | null;
    if (!viewport) return;
    const opts: EmblaOptionsType = {
      axis: this.orientation === 'vertical' ? 'y' : 'x',
      loop: !!this.loop,
      align: this.align,
      slidesToScroll: this['slides-to-scroll'] || 1,
      startIndex: this['start-index'] || 0,
      dragFree: !!this['drag-free'],
    };
    const plugins: EmblaPluginType[] = [];
    this.embla = EmblaCarousel(viewport, opts, plugins);
    this.embla.on('select', this._onSelect);
    this.embla.on('reInit', this._onSelect);
    this.dispatchEvent(new CustomEvent('init', { detail: { embla: this.embla }, bubbles: true, composed: true }));
    this._onSelect();
  }

  get count(): number { return this.embla?.scrollSnapList().length ?? this._slides().length; }
  get index(): number { return this._index; }
  get canScrollPrev(): boolean { return this.embla?.canScrollPrev() ?? false; }
  get canScrollNext(): boolean { return this.embla?.canScrollNext() ?? false; }

  scrollPrev() { this.embla?.scrollPrev(); }
  scrollNext() { this.embla?.scrollNext(); }
  scrollTo(i: number) { this.embla?.scrollTo(i); }
  reInit() { this.embla?.reInit(); }

  private _slides(): HTMLElement[] {
    return Array.from(this.querySelectorAll('ui-carousel-item'));
  }

  private _refreshButtons() {
    this.querySelectorAll('ui-carousel-previous, ui-carousel-next').forEach((el) => {
      (el as any).requestUpdate?.();
    });
  }

  private _onKey = (e: KeyboardEvent) => {
    if (this.orientation === 'horizontal') {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); this.scrollPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.scrollNext(); }
    } else {
      if (e.key === 'ArrowUp')    { e.preventDefault(); this.scrollPrev(); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); this.scrollNext(); }
    }
  };

  render() {
    return html`
      <div
        role="region"
        aria-roledescription="carousel"
        tabindex="0"
        data-slot="carousel"
        data-orientation=${this.orientation}
        class=${cn('relative outline-none')}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiCarousel.register('ui-carousel');

export class UiCarouselContent extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }
  render() {
    const car = this.closest('ui-carousel') as UiCarousel | null;
    const vertical = car?.orientation === 'vertical';
    // embla expects:
    //   .viewport  → overflow:hidden container
    //   .container → flex row/col holding slides
    return html`
      <div data-slot="carousel-content" class="overflow-hidden">
        <div
          data-slot="carousel-viewport"
          class=${cn('overflow-hidden')}
        >
          <div
            data-slot="carousel-track"
            class=${cn('flex', vertical ? 'flex-col' : 'flex-row', '-ml-4', vertical ? '-mt-4' : '')}
          >${unsafeHTML(this._slot)}</div>
        </div>
      </div>
    `;
  }
}
UiCarouselContent.register('ui-carousel-content');

export class UiCarouselItem extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }
  render() {
    const car = this.closest('ui-carousel') as UiCarousel | null;
    const vertical = car?.orientation === 'vertical';
    return html`
      <div
        role="group"
        aria-roledescription="slide"
        data-slot="carousel-item"
        class=${cn('min-w-0 shrink-0 grow-0 basis-full', vertical ? 'pt-4' : 'pl-4')}
      >${unsafeHTML(this._slot)}</div>
    `;
  }
}
UiCarouselItem.register('ui-carousel-item');

export class UiCarouselPrevious extends WebComponent {
  private _onClick = () => {
    const car = this.closest('ui-carousel') as UiCarousel | null;
    car?.scrollPrev();
  };

  render() {
    const car = this.closest('ui-carousel') as UiCarousel | null;
    const vertical = car?.orientation === 'vertical';
    const disabled = car ? !car.canScrollPrev : true;
    return html`
      <button
        type="button"
        data-slot="carousel-previous"
        aria-label="Previous slide"
        ?disabled=${disabled}
        @click=${this._onClick}
        class=${cn(
          'absolute size-8 rounded-full inline-flex items-center justify-center border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none',
          vertical
            ? '-top-12 left-1/2 -translate-x-1/2 rotate-90'
            : 'top-1/2 -left-12 -translate-y-1/2',
        )}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
      </button>
    `;
  }
}
UiCarouselPrevious.register('ui-carousel-previous');

export class UiCarouselNext extends WebComponent {
  private _onClick = () => {
    const car = this.closest('ui-carousel') as UiCarousel | null;
    car?.scrollNext();
  };

  render() {
    const car = this.closest('ui-carousel') as UiCarousel | null;
    const vertical = car?.orientation === 'vertical';
    const disabled = car ? !car.canScrollNext : true;
    return html`
      <button
        type="button"
        data-slot="carousel-next"
        aria-label="Next slide"
        ?disabled=${disabled}
        @click=${this._onClick}
        class=${cn(
          'absolute size-8 rounded-full inline-flex items-center justify-center border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none',
          vertical
            ? '-bottom-12 left-1/2 -translate-x-1/2 rotate-90'
            : 'top-1/2 -right-12 -translate-y-1/2',
        )}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </button>
    `;
  }
}
UiCarouselNext.register('ui-carousel-next');
