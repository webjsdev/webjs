/**
 * Message scroller: the scroll container for a chat transcript. Tier-2. A
 * port of shadcn's MessageScroller (the headless primitive in
 * `@shadcn/react`, styled): it opens at the newest message, follows new ones
 * while the reader is at the end, leaves them where they are once they have
 * scrolled up, and offers a button back to the end.
 *
 * shadcn parity:
 *   MessageScroller.Provider + MessageScroller
 *                            → <ui-message-scroller auto-scroll default-scroll-position>
 *   MessageScrollerViewport  → <ui-message-scroller-viewport>
 *   MessageScrollerContent   → <ui-message-scroller-content> (a role="log")
 *   MessageScrollerItem (messageId, scrollAnchor)
 *                            → <ui-message-scroller-item message-id scroll-anchor>
 *   MessageScrollerButton direction
 *                            → <ui-message-scroller-button direction="end" | "start">
 *   useMessageScroller()     → the element: scrollToEnd(), scrollToStart(), scrollToMessage(id)
 *   useMessageScrollerScrollable()
 *                            → `scrollable` ({ start, end }) and `ui-scrollable-change`
 *   useMessageScrollerVisibility()
 *                            → `visibleMessageIds` and `ui-visibility-change`
 *
 * `default-scroll-position` is where it opens: "end" (the default), "start",
 * or "last-anchor", the last item marked `scroll-anchor` at the top (a new
 * question with the answer streaming in under it). The viewport stays
 * invisible until that position applies, so the reader never sees a jump.
 * Messages added at the top keep the reader's place through the browser's
 * own scroll anchoring.
 *
 * A11y (handled by the element, plus your part): the content is a
 * `role="log"` that announces additions, and the button is named "Scroll to
 * end" / "Scroll to start" and is inert while there is nowhere to go. Your
 * part: label the transcript (`aria-label` on `<ui-message-scroller-content>`).
 *
 * @example
 * ```html
 * <ui-message-scroller auto-scroll class="h-96">
 *   <ui-message-scroller-viewport>
 *     <ui-message-scroller-content aria-label="Conversation">
 *       <ui-message-scroller-item message-id="m1">Hello</ui-message-scroller-item>
 *       <ui-message-scroller-item message-id="m2" scroll-anchor>What is WebJs?</ui-message-scroller-item>
 *     </ui-message-scroller-content>
 *   </ui-message-scroller-viewport>
 *   <ui-message-scroller-button></ui-message-scroller-button>
 * </ui-message-scroller>
 * ```
 */
import { WebComponent, html, prop } from '@webjsdev/core';
import { cn } from '../lib/utils.ts';
import { buttonClass, type ButtonVariant, type ButtonSize } from './button.ts';

/** The frame's classes (the element applies them). */
export const messageScrollerClass = (): string =>
  'cn-message-scroller group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden';
/** The scrolling viewport (the element applies them). */
export const messageScrollerViewportClass = (): string =>
  'cn-message-scroller-viewport size-full min-h-0 min-w-0 scroll-fade-b scrollbar-thin scrollbar-gutter-stable overflow-y-auto overscroll-contain contain-content data-autoscrolling:scrollbar-thumb-transparent data-autoscrolling:scrollbar-track-transparent data-[pending-scroll]:invisible';
/** The message list (the element applies them). */
export const messageScrollerContentClass = (): string =>
  'cn-message-scroller-content flex h-max min-h-full flex-col';
/** One message (the element puts them on the item itself). */
export const messageScrollerItemClass = (): string =>
  'cn-message-scroller-item min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]';
/** The scroll button (the element applies them). */
export const messageScrollerButtonClass = (): string =>
  'cn-message-scroller-button absolute inset-s-1/2 -translate-x-1/2 border-border bg-background text-foreground transition-[translate,scale,opacity] duration-200 hover:bg-muted hover:text-foreground data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=false]:duration-400 data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full rtl:translate-x-1/2 data-[direction=start]:[&_svg]:rotate-180';

const ROOT = 'ui-message-scroller';
// How near an edge counts as being at it, in pixels.
const EDGE = 24;

function rootOf(el: Element): UiMessageScroller | null {
  return (typeof el.closest === 'function' ? el.closest(ROOT) : null) as UiMessageScroller | null;
}

// --------------------------------------------------------------------------
// <ui-message-scroller>
// --------------------------------------------------------------------------

export class UiMessageScroller extends WebComponent({
  autoScroll: prop(Boolean, { attribute: 'auto-scroll' }),
  defaultScrollPosition: prop<'end' | 'start' | 'last-anchor'>(String, { attribute: 'default-scroll-position' }),
  pending: prop({ state: true }),
}) {
  /** The edges the viewport can still scroll toward. */
  scrollable = { start: false, end: false };
  /** The messages on screen, by `message-id`. */
  visibleMessageIds: string[] = [];
  _following = true;
  _opened = false;
  _resize: ResizeObserver | null = null;
  _visible: IntersectionObserver | null = null;
  _shown = new Set<string>();

  constructor() {
    super();
    this.autoScroll = false;
    this.defaultScrollPosition = 'end';
    this.pending = true;
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    queueMicrotask(() => this._setup());
  }

  disconnectedCallback(): void {
    this._resize?.disconnect();
    this._visible?.disconnect();
    this._resize = null;
    this._visible = null;
    super.disconnectedCallback?.();
  }

  render() {
    return html`<div data-slot="message-scroller" ?data-pending-scroll=${!!this.pending} class=${messageScrollerClass()}><slot></slot></div>`;
  }

  viewport(): HTMLElement | null {
    return this.querySelector<HTMLElement>('[data-slot="message-scroller-viewport"]');
  }

  _content(): HTMLElement | null {
    return this.querySelector<HTMLElement>('[data-slot="message-scroller-content"]');
  }

  _items(): UiMessageScrollerItem[] {
    if (typeof this.querySelectorAll !== 'function') return [];
    return Array.from(this.querySelectorAll<UiMessageScrollerItem>('ui-message-scroller-item')).filter((i) => rootOf(i) === this);
  }

  _setup(): void {
    const viewport = this.viewport();
    const content = this._content();
    if (!viewport || !content) {
      requestAnimationFrame(() => this._setup());
      return;
    }
    viewport.addEventListener('scroll', this._onScroll, { passive: true });
    // New or growing messages: follow them if the reader is at the end.
    if (typeof ResizeObserver === 'function') {
      this._resize = new ResizeObserver(() => this._onGrow());
      this._resize.observe(content);
    }
    if (typeof IntersectionObserver === 'function') {
      this._visible = new IntersectionObserver(this._onIntersect, { root: viewport });
      for (const item of this._items()) this._visible.observe(item);
    }
    requestAnimationFrame(() => this._open());
  }

  // The opening position, applied once the messages have laid out.
  _open(): void {
    const viewport = this.viewport();
    if (!viewport) return;
    const pos = this.defaultScrollPosition;
    if (pos === 'start') viewport.scrollTop = 0;
    else if (pos === 'last-anchor') {
      const anchors = this._items().filter((i) => i.hasAttribute('scroll-anchor'));
      const last = anchors[anchors.length - 1];
      if (last) this._scrollToItem(last, 'start', 'auto');
      else viewport.scrollTop = viewport.scrollHeight;
    } else viewport.scrollTop = viewport.scrollHeight;
    this._opened = true;
    this._following = this._atEnd();
    this.pending = false;
    // The viewport draws its own pending flag, so it redraws with it.
    this.querySelector<UiMessageScrollerViewport>('ui-message-scroller-viewport')?.requestUpdate?.();
    this._measure();
  }

  _atEnd(): boolean {
    const v = this.viewport();
    return !!v && v.scrollHeight - v.scrollTop - v.clientHeight <= EDGE;
  }

  _onScroll = (): void => {
    // A scroll the reader makes away from the end stops the following; one
    // back to the end resumes it.
    if (this._opened) this._following = this._atEnd();
    this._measure();
  };

  _onGrow = (): void => {
    if (!this._opened) return;
    if (this.autoScroll && this._following) {
      const v = this.viewport();
      if (v) {
        v.setAttribute('data-autoscrolling', '');
        v.scrollTop = v.scrollHeight;
        requestAnimationFrame(() => v.removeAttribute('data-autoscrolling'));
      }
    }
    this._measure();
  };

  _measure(): void {
    const v = this.viewport();
    if (!v) return;
    const next = { start: v.scrollTop > EDGE, end: v.scrollHeight - v.scrollTop - v.clientHeight > EDGE };
    if (next.start !== this.scrollable.start || next.end !== this.scrollable.end) {
      this.scrollable = next;
      this.dispatchEvent(new CustomEvent('ui-scrollable-change', { bubbles: true, detail: { ...next } }));
    }
    for (const b of Array.from(this.querySelectorAll<UiMessageScrollerButton>('ui-message-scroller-button'))) b.requestUpdate?.();
  }

  _onIntersect = (entries: IntersectionObserverEntry[]): void => {
    for (const e of entries) {
      const id = (e.target as Element).getAttribute('message-id');
      if (!id) continue;
      if (e.isIntersecting) this._shown.add(id);
      else this._shown.delete(id);
    }
    const ids = this._items().map((i) => i.getAttribute('message-id')).filter((id): id is string => !!id && this._shown.has(id));
    this.visibleMessageIds = ids;
    this.dispatchEvent(new CustomEvent('ui-visibility-change', { bubbles: true, detail: { visibleMessageIds: ids } }));
  };

  // An item that arrives after setup is tracked too.
  _itemConnected(item: UiMessageScrollerItem): void {
    this._visible?.observe(item);
  }

  _scrollToItem(item: Element, align: 'start' | 'center' | 'end' | 'nearest', behavior: ScrollBehavior): void {
    const v = this.viewport();
    if (!v) return;
    const vr = v.getBoundingClientRect();
    const ir = item.getBoundingClientRect();
    let top = v.scrollTop + (ir.top - vr.top);
    if (align === 'end') top -= vr.height - ir.height;
    else if (align === 'center') top -= (vr.height - ir.height) / 2;
    else if (align === 'nearest') {
      if (ir.top >= vr.top && ir.bottom <= vr.bottom) return;
      if (ir.bottom > vr.bottom) top -= vr.height - ir.height;
    }
    v.scrollTo({ top, behavior });
  }

  _behavior(): ScrollBehavior {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  /** Scroll to the newest message, and follow new ones again. */
  scrollToEnd(): void {
    const v = this.viewport();
    if (!v) return;
    this._following = true;
    v.scrollTo({ top: v.scrollHeight, behavior: this._behavior() });
  }

  /** Scroll to the oldest message. */
  scrollToStart(): void {
    this.viewport()?.scrollTo({ top: 0, behavior: this._behavior() });
  }

  /** Scroll the message with `id` into view. */
  scrollToMessage(id: string, opts: { align?: 'start' | 'center' | 'end' | 'nearest'; behavior?: ScrollBehavior } = {}): void {
    const item = this._items().find((i) => i.getAttribute('message-id') === id);
    if (item) this._scrollToItem(item, opts.align ?? 'start', opts.behavior ?? this._behavior());
  }
}
UiMessageScroller.register('ui-message-scroller');

// --------------------------------------------------------------------------
// <ui-message-scroller-viewport> and <ui-message-scroller-content>
// --------------------------------------------------------------------------

export class UiMessageScrollerViewport extends WebComponent {
  render() {
    const pending = rootOf(this)?.pending ?? true;
    return html`<div data-slot="message-scroller-viewport" ?data-pending-scroll=${!!pending} class=${messageScrollerViewportClass()}><slot></slot></div>`;
  }
}
UiMessageScrollerViewport.register('ui-message-scroller-viewport');

export class UiMessageScrollerContent extends WebComponent {
  render() {
    return html`<div
      data-slot="message-scroller-content"
      role="log"
      aria-relevant="additions"
      aria-label=${this.getAttribute?.('aria-label') || null}
      class=${messageScrollerContentClass()}
    ><slot></slot></div>`;
  }
}
UiMessageScrollerContent.register('ui-message-scroller-content');

// --------------------------------------------------------------------------
// <ui-message-scroller-item>
// --------------------------------------------------------------------------

export class UiMessageScrollerItem extends WebComponent {
  _authored: string | null = null;
  _captured = false;

  connectedCallback(): void {
    super.connectedCallback?.();
    rootOf(this)?._itemConnected(this);
  }

  // An item is a flex child of the column, so it carries its own classes.
  render() {
    if (!this._captured) {
      this._authored = this.getAttribute?.('class') ?? null;
      this._captured = true;
    }
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('class', cn(messageScrollerItemClass(), this._authored));
      this.setAttribute('data-slot', 'message-scroller-item');
    }
    return html`<slot></slot>`;
  }
}
UiMessageScrollerItem.register('ui-message-scroller-item');

// --------------------------------------------------------------------------
// <ui-message-scroller-button>
// --------------------------------------------------------------------------

export class UiMessageScrollerButton extends WebComponent({
  direction: prop<'end' | 'start'>(String),
  variant: String,
  size: String,
}) {
  constructor() {
    super();
    this.direction = 'end';
    this.variant = 'secondary';
    this.size = 'icon-sm';
  }

  render() {
    const root = rootOf(this);
    const toStart = this.direction === 'start';
    const active = !!root && (toStart ? root.scrollable.start : root.scrollable.end);
    return html`<button
      type="button"
      data-slot="message-scroller-button"
      data-direction=${toStart ? 'start' : 'end'}
      data-variant=${this.variant}
      data-size=${this.size}
      data-active=${active ? 'true' : 'false'}
      tabindex=${active ? null : '-1'}
      aria-hidden=${active ? null : 'true'}
      class=${cn(buttonClass({ variant: this.variant as ButtonVariant, size: this.size as ButtonSize }), messageScrollerButtonClass())}
      @click=${() => (toStart ? root?.scrollToStart() : root?.scrollToEnd())}
    ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path></svg><span class="sr-only">${toStart ? 'Scroll to start' : 'Scroll to end'}</span></button>`;
  }
}
UiMessageScrollerButton.register('ui-message-scroller-button');
