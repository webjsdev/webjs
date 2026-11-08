/**
 * Navigation menu: a site's top navigation, where some entries are links and
 * some open a panel of links. Tier-2. It is a set of disclosures inside a
 * `<nav>`, as in Radix, NOT an ARIA menu: the panels hold ordinary links, Tab
 * walks into an open panel, and screen readers read it as navigation.
 *
 * shadcn parity:
 *   NavigationMenu           → <ui-navigation-menu viewport delay-duration skip-delay-duration>
 *   NavigationMenuList       → <ui-navigation-menu-list>
 *   NavigationMenuItem       → <ui-navigation-menu-item value>
 *   NavigationMenuTrigger    → <ui-navigation-menu-trigger>Getting started</ui-navigation-menu-trigger>
 *   NavigationMenuContent    → <ui-navigation-menu-content>
 *   NavigationMenuLink       → <ui-navigation-menu-link href active> (renders the <a>),
 *                              or navigationMenuLinkClass() on your own <a data-slot="navigation-menu-link">
 *   NavigationMenuIndicator  → <ui-navigation-menu-indicator>
 *   NavigationMenuViewport   → rendered by the root unless viewport="false"
 *   navigationMenuTriggerStyle → the same helper as navigationMenuTriggerClass, for a
 *                              link that sits in the bar beside the triggers
 *
 * The viewport: by default the open panel shows in one frame under the whole
 * list, which the root renders and sizes to the panel through the
 * `--radix-navigation-menu-viewport-width` / `-height` variables shadcn's
 * classes read. Radix moves the panel into that frame; this element keeps it
 * where it is and places it over the frame, so a slotted panel never changes
 * parents. The frame keeps its size between panels rather than animating it.
 * With `viewport="false"` each panel opens under its own trigger instead.
 *
 * Opening: pointing at a trigger opens its panel after `delay-duration`
 * (200ms), at once while another panel is open or within
 * `skip-delay-duration` (300ms) of one closing. Leaving the trigger and the
 * panel closes it after a short grace. A click toggles it. Escape, a click
 * outside, focus leaving the nav, and following a link in the panel close it.
 *
 * Keyboard: Tab walks the bar and into an open panel. ArrowLeft / ArrowRight
 * (and Home / End) move between the bar's triggers and links, ArrowDown on a
 * trigger opens its panel on the first link, ArrowDown / ArrowUp move within
 * a panel, and Escape returns to the trigger.
 *
 * A11y (handled by the element, plus your part): the root is a `<nav>` named
 * "Main" unless you name it (`aria-label` on `<ui-navigation-menu>`), the list
 * and items are a real `<ul>` / `<li>`, each trigger is a button with
 * `aria-expanded` and `aria-controls`, each panel is named by its trigger, and
 * `<ui-navigation-menu-link active>` marks the current page with
 * `aria-current="page"`. Your part: link text that reads well out of context,
 * and the `active` flag on the link for the page being shown.
 *
 * @example
 * ```html
 * <ui-navigation-menu>
 *   <ui-navigation-menu-list>
 *     <ui-navigation-menu-item>
 *       <ui-navigation-menu-trigger>Components</ui-navigation-menu-trigger>
 *       <ui-navigation-menu-content>
 *         <ul class="grid w-[400px] gap-2">
 *           <li><ui-navigation-menu-link href="/ui/dialog">Dialog</ui-navigation-menu-link></li>
 *           <li><ui-navigation-menu-link href="/ui/tabs">Tabs</ui-navigation-menu-link></li>
 *         </ul>
 *       </ui-navigation-menu-content>
 *     </ui-navigation-menu-item>
 *     <ui-navigation-menu-item>
 *       <ui-navigation-menu-link href="/docs" active>Docs</ui-navigation-menu-link>
 *     </ui-navigation-menu-item>
 *   </ui-navigation-menu-list>
 * </ui-navigation-menu>
 * ```
 */
import { WebComponent, html, prop, signal, nothing } from '@webjsdev/core';
import { ensureId } from '../lib/utils.ts';

/** The root's classes (the element applies them). */
export const navigationMenuClass = (): string =>
  'cn-navigation-menu group/navigation-menu relative flex max-w-max flex-1 items-center justify-center';
/** The list's classes (the element applies them). */
export const navigationMenuListClass = (): string =>
  'cn-navigation-menu-list group flex flex-1 list-none items-center justify-center';
/** An item's classes (the element applies them). Positioned only without a viewport. */
export const navigationMenuItemClass = (): string =>
  'cn-navigation-menu-item group-data-[viewport=false]/navigation-menu:relative';
/** A trigger's classes. Also right for a link that sits in the bar beside the triggers. */
export const navigationMenuTriggerClass = (): string =>
  'cn-navigation-menu-trigger group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center outline-none disabled:pointer-events-none';
/** shadcn's name for {@link navigationMenuTriggerClass}. */
export function navigationMenuTriggerStyle(opts: { className?: string } = {}): string {
  return opts.className ? `${navigationMenuTriggerClass()} ${opts.className}` : navigationMenuTriggerClass();
}
/** The trigger's chevron. */
export const navigationMenuTriggerIconClass = (): string =>
  'cn-navigation-menu-trigger-icon';
/** A panel's classes (the element applies them). */
export const navigationMenuContentClass = (): string =>
  'cn-navigation-menu-content absolute top-full start-0 z-[51] mt-1.5 w-auto **:data-[slot=navigation-menu-link]:focus:ring-0 **:data-[slot=navigation-menu-link]:focus:outline-none group-data-[viewport=false]/navigation-menu:overflow-hidden';
/** The viewport frame's wrapper (the root renders it). */
export const navigationMenuViewportWrapperClass = (): string =>
  'cn-navigation-menu-viewport-wrapper absolute top-full start-0 isolate z-50 flex justify-center';
/** The viewport frame (the root renders it). */
export const navigationMenuViewportClass = (): string =>
  'cn-navigation-menu-viewport origin-top-center relative mt-1.5 h-(--radix-navigation-menu-viewport-height) w-full overflow-hidden md:w-(--radix-navigation-menu-viewport-width)';
/** A link's classes, for an `<a data-slot="navigation-menu-link">` of your own. */
export const navigationMenuLinkClass = (): string =>
  'cn-navigation-menu-link';
/** The indicator under the open trigger. */
export const navigationMenuIndicatorClass = (): string =>
  'cn-navigation-menu-indicator absolute top-full z-1 flex h-1.5 items-end justify-center overflow-hidden';
/** The indicator's arrow. */
export const navigationMenuIndicatorArrowClass = (): string =>
  'cn-navigation-menu-indicator-arrow relative top-[60%] h-2 w-2 rotate-45';

const ROOT = 'ui-navigation-menu';
const CLOSE_GRACE_MS = 150;

// A late part asks for the current state after its first render. Measure on
// the following microtask, once the newly opened panel has rendered too.
function announce(el: Element): void {
  queueMicrotask(() => {
    (el.closest(`${ROOT}-item`) as UiNavigationMenuItem | null)?._sync?.();
    queueMicrotask(() => (el.closest(ROOT) as UiNavigationMenu | null)?._layout?.());
  });
}

// --------------------------------------------------------------------------
// <ui-navigation-menu>
// --------------------------------------------------------------------------

export class UiNavigationMenu extends WebComponent({
  // The open item's value, '' when none is open.
  value: prop(String, { reflect: true }),
  // "false" opens each panel under its own trigger instead of in the frame.
  viewport: String,
  delayDuration: prop(Number, { attribute: 'delay-duration' }),
  skipDelayDuration: prop(Number, { attribute: 'skip-delay-duration' }),
}) {
  _openTimer = 0;
  _closeTimer = 0;
  _skipDelayUntil = 0;
  // The order of the last two open items, for the panel's slide direction.
  _previous = '';

  constructor() {
    super();
    this.value = '';
    this.viewport = 'true';
    this.delayDuration = 200;
    this.skipDelayDuration = 300;
  }

  get _hasViewport(): boolean {
    return this.viewport !== 'false';
  }

  render() {
    const open = !!this.value;
    return html`<nav
      data-slot="navigation-menu"
      data-viewport=${this._hasViewport ? 'true' : 'false'}
      data-orientation="horizontal"
      aria-label=${this.getAttribute?.('aria-label') || 'Main'}
      class=${navigationMenuClass()}
      @keydown=${this._onKeyDown}
      @focusout=${this._onFocusOut}
    ><slot></slot>${this._hasViewport
      ? html`<div class=${navigationMenuViewportWrapperClass()}><div
          data-slot="navigation-menu-viewport"
          data-state=${open ? 'open' : 'closed'}
          ?hidden=${!open}
          class=${navigationMenuViewportClass()}
        ></div></div>`
      : ''}</nav>`;
  }

  /** The items in this menu, in order. */
  items(): UiNavigationMenuItem[] {
    return Array.from(this.querySelectorAll<UiNavigationMenuItem>(`${ROOT}-item`)).filter(
      (i) => i.closest(ROOT) === this,
    );
  }

  /** Open the item whose value is `value`, or close every panel with ''. */
  setValue(value: string): void {
    clearTimeout(this._openTimer);
    clearTimeout(this._closeTimer);
    if (value === this.value) return;
    if (!value && this.value) this._skipDelayUntil = Date.now() + this.skipDelayDuration;
    this._previous = this.value;
    this.value = value;
  }

  // Pointer intent. A touch "hover" is a tap, which the click handles.
  _pointerOpen(item: UiNavigationMenuItem): void {
    clearTimeout(this._closeTimer);
    clearTimeout(this._openTimer);
    if (this.value === item.itemValue) return;
    const now = !!this.value || Date.now() < this._skipDelayUntil;
    if (now) this.setValue(item.itemValue);
    else this._openTimer = window.setTimeout(() => this.setValue(item.itemValue), this.delayDuration);
  }

  _pointerLeave(): void {
    clearTimeout(this._openTimer);
    clearTimeout(this._closeTimer);
    if (!this.value) return;
    this._closeTimer = window.setTimeout(() => this.setValue(''), CLOSE_GRACE_MS);
  }

  _cancelClose(): void {
    clearTimeout(this._closeTimer);
  }

  updated(changedProperties: Map<string, unknown>): void {
    super.updated?.(changedProperties);
    if (!changedProperties.has('value')) return;
    this.items().forEach((item) => item._sync());
    queueMicrotask(() => this._layout());
    if (this.value) document.addEventListener('pointerdown', this._onDocPointerDown, true);
    else document.removeEventListener('pointerdown', this._onDocPointerDown, true);
  }

  disconnectedCallback(): void {
    clearTimeout(this._openTimer);
    clearTimeout(this._closeTimer);
    document.removeEventListener('pointerdown', this._onDocPointerDown, true);
    window.removeEventListener('resize', this._onResize);
    super.disconnectedCallback?.();
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    window.addEventListener('resize', this._onResize);
    // Items are slotted after the first render, so their ARIA is wired once
    // they are in place.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.items().forEach((item) => item._sync()));
    }
  }

  _onResize = (): void => this._layout();

  // Size the frame to the open panel and put the indicator under its trigger.
  _layout(): void {
    const item = this.items().find((i) => i.itemValue === this.value) ?? null;
    const panel = item?._panel() ?? null;
    const frame = this.querySelector<HTMLElement>('[data-slot="navigation-menu-viewport"]');
    if (frame && panel) {
      frame.style.setProperty('--radix-navigation-menu-viewport-width', `${panel.offsetWidth}px`);
      frame.style.setProperty('--radix-navigation-menu-viewport-height', `${panel.offsetHeight}px`);
    }
    this.querySelectorAll<UiNavigationMenuIndicator>(`${ROOT}-indicator`).forEach((ind) =>
      ind._place(item?._button() ?? null),
    );
  }

  _onDocPointerDown = (e: Event): void => {
    if (e.composedPath().includes(this)) return;
    this.setValue('');
  };

  _onFocusOut = (e: FocusEvent): void => {
    const next = e.relatedTarget as Node | null;
    if (next && this.contains(next)) return;
    // Focus left the nav (or went nowhere a click put it); a pointer close is
    // handled by the pointerdown listener, so only a keyboard exit closes here.
    if (next) this.setValue('');
  };

  // The bar's own focusables, in order: triggers and the links that sit in
  // the list, never the links inside a panel.
  _barFocusables(): HTMLElement[] {
    return Array.from(
      this.querySelectorAll<HTMLElement>(
        '[data-slot="navigation-menu-trigger"], a[data-slot="navigation-menu-link"]',
      ),
    ).filter((el) => el.closest(ROOT) === this && !el.closest('[data-slot="navigation-menu-content"]'));
  }

  _onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    const panel = target.closest<HTMLElement>('[data-slot="navigation-menu-content"]');
    if (e.key === 'Escape' && this.value) {
      e.preventDefault();
      const item = this.items().find((i) => i.itemValue === this.value);
      item?._button()?.focus();
      this.setValue('');
      return;
    }
    if (panel) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const links = Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      const i = links.indexOf(target.closest('a[href], button') as HTMLElement);
      if (i < 0 || !links.length) return;
      e.preventDefault();
      links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length].focus();
      return;
    }
    const bar = this._barFocusables();
    const i = bar.indexOf(target);
    if (i < 0) return;
    const go = (j: number) => {
      e.preventDefault();
      bar[(j + bar.length) % bar.length].focus();
    };
    if (e.key === 'ArrowRight') go(i + 1);
    else if (e.key === 'ArrowLeft') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(bar.length - 1);
    else if (e.key === 'ArrowDown' && target.matches('[data-slot="navigation-menu-trigger"]')) {
      const item = target.closest(`${ROOT}-item`) as UiNavigationMenuItem | null;
      if (!item) return;
      e.preventDefault();
      this.setValue(item.itemValue);
      // The panel is shown on the next render.
      requestAnimationFrame(() => item._panel()?.querySelector<HTMLElement>('a[href], button')?.focus());
    }
  };
}
UiNavigationMenu.register('ui-navigation-menu');

// --------------------------------------------------------------------------
// <ui-navigation-menu-list>
// --------------------------------------------------------------------------

export class UiNavigationMenuList extends WebComponent {
  render() {
    return html`<ul
      data-slot="navigation-menu-list"
      data-orientation="horizontal"
      class=${navigationMenuListClass()}
    ><slot></slot></ul>`;
  }
}
UiNavigationMenuList.register('ui-navigation-menu-list');

// --------------------------------------------------------------------------
// <ui-navigation-menu-item>
// --------------------------------------------------------------------------

export class UiNavigationMenuItem extends WebComponent({
  value: String,
}) {
  constructor() {
    super();
    this.value = '';
  }

  render() {
    return html`<li data-slot="navigation-menu-item" class=${navigationMenuItemClass()}><slot></slot></li>`;
  }

  _root(): UiNavigationMenu | null {
    return this.closest(ROOT) as UiNavigationMenu | null;
  }

  /** The value that opens this item: its `value`, else its position. */
  get itemValue(): string {
    if (this.value) return this.value;
    const i = this._root()?.items().indexOf(this) ?? -1;
    return `item-${i + 1}`;
  }

  get isOpen(): boolean {
    return !!this._root()?.value && this._root()?.value === this.itemValue;
  }

  _button(): HTMLElement | null {
    return this.querySelector<HTMLElement>('[data-slot="navigation-menu-trigger"]');
  }

  _panel(): HTMLElement | null {
    return this.querySelector<HTMLElement>('[data-slot="navigation-menu-content"]');
  }

  // Push open state into the trigger and panel, and link them both ways.
  _sync(): void {
    const root = this._root();
    this.querySelectorAll<UiNavigationMenuTrigger | UiNavigationMenuContent>(
      `${ROOT}-trigger, ${ROOT}-content`,
    ).forEach((part) => { part.open?.set(this.isOpen); });
    const button = this._button();
    const panel = this._panel();
    if (button && panel) {
      button.setAttribute('aria-controls', ensureId(panel, 'ui-navigation-menu-content'));
      panel.setAttribute('aria-labelledby', ensureId(button, 'ui-navigation-menu-trigger'));
    }
    if (panel && root && this.isOpen) {
      const order = root.items().map((i) => i.itemValue);
      const from = order.indexOf(root._previous);
      const to = order.indexOf(this.itemValue);
      if (from < 0) panel.removeAttribute('data-motion');
      else panel.setAttribute('data-motion', to > from ? 'from-end' : 'from-start');
    }
  }
}
UiNavigationMenuItem.register('ui-navigation-menu-item');

// --------------------------------------------------------------------------
// <ui-navigation-menu-trigger>
// --------------------------------------------------------------------------

export class UiNavigationMenuTrigger extends WebComponent {
  readonly open = signal(false);
  // After a click closes the panel, the pointer still on the trigger must not
  // reopen it until it leaves.
  _clickClosed = false;

  constructor() {
    super();
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  render() {
    return html`<button
      type="button"
      data-slot="navigation-menu-trigger"
      data-state=${this.open.get() ? 'open' : 'closed'}
      aria-expanded=${this.open.get() ? 'true' : 'false'}
      class=${navigationMenuTriggerClass()}
      @click=${this._onClick}
      @pointerenter=${this._onPointerEnter}
      @pointerleave=${this._onPointerLeave}
    ><slot></slot> <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class=${navigationMenuTriggerIconClass()}
    ><path d="m6 9 6 6 6-6"></path></svg></button>`;
  }

  _item(): UiNavigationMenuItem | null {
    return this.closest(`${ROOT}-item`) as UiNavigationMenuItem | null;
  }

  _onClick = (): void => {
    const item = this._item();
    const root = item?._root();
    if (!item || !root) return;
    if (item.isOpen) {
      this._clickClosed = true;
      root.setValue('');
    } else {
      root.setValue(item.itemValue);
    }
  };

  _onPointerEnter = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' || this._clickClosed) return;
    const item = this._item();
    if (item) item._root()?._pointerOpen(item);
  };

  _onPointerLeave = (e: PointerEvent): void => {
    this._clickClosed = false;
    if (e.pointerType === 'touch') return;
    this._item()?._root()?._pointerLeave();
  };
}
UiNavigationMenuTrigger.register('ui-navigation-menu-trigger');

// --------------------------------------------------------------------------
// <ui-navigation-menu-content>
// --------------------------------------------------------------------------

export class UiNavigationMenuContent extends WebComponent {
  readonly open = signal(false);
  constructor() {
    super();
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    announce(this);
  }

  render() {
    return html`<div
      data-slot="navigation-menu-content"
      data-state=${this.open.get() ? 'open' : 'closed'}
      ?hidden=${!this.open.get()}
      class=${navigationMenuContentClass()}
      @pointerenter=${this._onPointerEnter}
      @pointerleave=${this._onPointerLeave}
      @click=${this._onClick}
    ><slot></slot></div>`;
  }

  _root(): UiNavigationMenu | null {
    return this.closest(ROOT) as UiNavigationMenu | null;
  }

  _onPointerEnter = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') this._root()?._cancelClose();
  };

  _onPointerLeave = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') this._root()?._pointerLeave();
  };

  // Following a link in the panel closes it, as Radix does on select.
  _onClick = (e: Event): void => {
    if ((e.target as Element).closest('a[href]')) this._root()?.setValue('');
  };
}
UiNavigationMenuContent.register('ui-navigation-menu-content');

// --------------------------------------------------------------------------
// <ui-navigation-menu-link>
// --------------------------------------------------------------------------

export class UiNavigationMenuLink extends WebComponent({
  href: String,
  active: Boolean,
}) {
  constructor() {
    super();
    this.href = '';
    this.active = false;
  }

  render() {
    return html`<a
      data-slot="navigation-menu-link"
      href=${this.href || nothing}
      data-active=${this.active ? 'true' : nothing}
      aria-current=${this.active ? 'page' : nothing}
      class=${navigationMenuLinkClass()}
    ><slot></slot></a>`;
  }
}
UiNavigationMenuLink.register('ui-navigation-menu-link');

// --------------------------------------------------------------------------
// <ui-navigation-menu-indicator>
// --------------------------------------------------------------------------

export class UiNavigationMenuIndicator extends WebComponent {
  render() {
    return html`<div
      data-slot="navigation-menu-indicator"
      data-state="hidden"
      aria-hidden="true"
      class=${navigationMenuIndicatorClass()}
    ><div class=${navigationMenuIndicatorArrowClass()}></div></div>`;
  }

  // Sit under the open trigger, or hide.
  _place(button: HTMLElement | null): void {
    const el = this.querySelector<HTMLElement>('[data-slot="navigation-menu-indicator"]');
    const nav = this.closest(ROOT)?.querySelector<HTMLElement>('[data-slot="navigation-menu"]');
    if (!el) return;
    el.setAttribute('data-state', button ? 'visible' : 'hidden');
    if (!button || !nav) return;
    const b = button.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    el.style.left = `${b.left - n.left}px`;
    el.style.width = `${b.width}px`;
  }
}
UiNavigationMenuIndicator.register('ui-navigation-menu-indicator');
