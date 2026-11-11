/**
 * Sidebar: an application's side navigation, collapsible to icons or off
 * canvas, and a sheet on a phone. Tier 2 for the parts with state (the
 * provider, the sidebar, its trigger and rail, and the inset beside it) and
 * Tier 1 for everything inside, which is markup with classes, as in shadcn.
 *
 * shadcn parity:
 *   SidebarProvider (defaultOpen, open)
 *                            → <ui-sidebar-provider default-open="false" open>
 *   Sidebar (side, variant, collapsible)
 *                            → <ui-sidebar side="left" | "right" variant="sidebar" | "floating" | "inset"
 *                              collapsible="offcanvas" | "icon" | "none">
 *   SidebarTrigger / SidebarRail / SidebarInset
 *                            → <ui-sidebar-trigger> / <ui-sidebar-rail> / <ui-sidebar-inset>
 *   SidebarHeader / Footer / Content / Separator / Input
 *                            → <div data-slot="sidebar-header" data-sidebar="header" class=${sidebarHeaderClass()}>
 *                              and so on (sidebarInputClass() on an <input>)
 *   SidebarGroup / GroupLabel / GroupAction / GroupContent
 *                            → sidebarGroupClass() / sidebarGroupLabelClass() / sidebarGroupActionClass() /
 *                              sidebarGroupContentClass()
 *   SidebarMenu / MenuItem   → <ul class=${sidebarMenuClass()}> / <li class=${sidebarMenuItemClass()}>
 *   SidebarMenuButton (variant, size, isActive)
 *                            → <a data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size
 *                              data-active class=${sidebarMenuButtonClass({ variant, size })}>
 *                              (sidebarMenuButtonVariants is the same helper under shadcn's name)
 *   SidebarMenuAction showOnHover / MenuBadge / MenuSkeleton
 *                            → sidebarMenuActionClass({ showOnHover }) / sidebarMenuBadgeClass() /
 *                              sidebarMenuSkeleton({ showIcon })
 *   SidebarMenuSub / SubItem / SubButton (size, isActive)
 *                            → sidebarMenuSubClass() / sidebarMenuSubItemClass() /
 *                              sidebarMenuSubButtonClass({ size })
 *   useSidebar()             → the provider: open, state, isMobile, openMobile, toggle(), setOpen()
 *   onOpenChange             → `ui-open-change` ({ detail: { open } }) on the provider
 *
 * The open state is kept in the `sidebar_state` cookie, as in shadcn, so a
 * page can read it on the server and render `default-open` to match, with no
 * flash. Ctrl+B (Cmd+B on a Mac) toggles it. Below 768px the sidebar opens
 * as a sheet from its side instead, `--sidebar-width-mobile` wide (18rem
 * when no ancestor sets it, shadcn's SIDEBAR_WIDTH_MOBILE).
 *
 * For a collapsed icon sidebar, wrap a menu button in a `<ui-tooltip>` whose
 * content carries `hidden group-data-[collapsible=icon]:block`, so the label
 * shows only when the text does not.
 *
 * A11y (handled by the elements, plus your part): the trigger is named
 * "Toggle Sidebar", the inset is the page's `main` landmark, and on a phone
 * the sheet is a modal dialog named "Sidebar" with Escape and focus return.
 * Your part: put the menu in a `<nav aria-label>`, mark the current page's
 * button `data-active="true"` and `aria-current="page"`, and give a
 * collapsed icon button a name (its text stays in the markup, hidden by the
 * width, so a screen reader still reads it).
 *
 * @example
 * ```html
 * <ui-sidebar-provider>
 *   <ui-sidebar collapsible="icon">
 *     <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
 *       <nav aria-label="Main" data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
 *         <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
 *           <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
 *             <a href="/inbox" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-active="true"
 *               aria-current="page" class=${sidebarMenuButtonClass()}><span>Inbox</span></a>
 *           </li>
 *         </ul>
 *       </nav>
 *     </div>
 *     <ui-sidebar-rail></ui-sidebar-rail>
 *   </ui-sidebar>
 *   <ui-sidebar-inset>
 *     <header class="flex h-12 items-center px-4"><ui-sidebar-trigger></ui-sidebar-trigger></header>
 *   </ui-sidebar-inset>
 * </ui-sidebar-provider>
 * ```
 */
import { WebComponent, html, prop, signal } from '@webjsdev/core';
import { cn, takeAuthoredClass } from '../lib/utils.ts';
import { buttonClass } from './button.ts';
import { inputClass } from './input.ts';
import { separatorClass } from './separator.ts';
import { skeletonClass } from './skeleton.ts';
import './sheet.ts';

const COOKIE = 'sidebar_state';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const MOBILE_QUERY = '(max-width: 767px)';
const PROVIDER = 'ui-sidebar-provider';

// --------------------------------------------------------------------------
// Class helpers (Tier 1)
// --------------------------------------------------------------------------

/** The provider's wrapper (the element applies them). */
export function sidebarWrapperClass(): string {
  return 'group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-sidebar';
}

/** The header. */
export function sidebarHeaderClass(): string {
  return 'cn-sidebar-header flex flex-col';
}

/** The footer. */
export function sidebarFooterClass(): string {
  return 'cn-sidebar-footer flex flex-col';
}

/** A separator in the sidebar, on a separator element. */
export function sidebarSeparatorClass(): string {
  return cn(separatorClass(), 'cn-sidebar-separator w-auto');
}

/** The search field in the sidebar, on an <input>. */
export function sidebarInputClass(): string {
  return cn(inputClass(), 'cn-sidebar-input');
}

/** The scrolling content. */
export function sidebarContentClass(): string {
  return 'cn-sidebar-content flex min-h-0 flex-1 flex-col overflow-auto group-data-[collapsible=icon]:overflow-hidden';
}

/** A group. */
export function sidebarGroupClass(): string {
  return 'cn-sidebar-group relative flex w-full min-w-0 flex-col';
}

/** A group's label. */
export function sidebarGroupLabelClass(): string {
  return 'cn-sidebar-group-label flex shrink-0 items-center outline-hidden [&>svg]:shrink-0';
}

/** A group's action button. */
export function sidebarGroupActionClass(): string {
  return 'cn-sidebar-group-action flex aspect-square items-center justify-center outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 md:after:hidden [&>svg]:shrink-0';
}

/** A group's content. */
export function sidebarGroupContentClass(): string {
  return 'cn-sidebar-group-content w-full';
}

/** A menu (<ul>). */
export function sidebarMenuClass(): string {
  return 'cn-sidebar-menu flex w-full min-w-0 flex-col';
}

/** A menu item (<li>). */
export function sidebarMenuItemClass(): string {
  return 'group/menu-item relative';
}

const MENU_BUTTON_VARIANTS = {
  default: 'cn-sidebar-menu-button-variant-default',
  outline: 'cn-sidebar-menu-button-variant-outline',
} as const;

const MENU_BUTTON_SIZES = {
  default: 'cn-sidebar-menu-button-size-default',
  sm: 'cn-sidebar-menu-button-size-sm',
  lg: 'cn-sidebar-menu-button-size-lg',
} as const;

export type SidebarMenuButtonVariant = keyof typeof MENU_BUTTON_VARIANTS;
export type SidebarMenuButtonSize = keyof typeof MENU_BUTTON_SIZES;

/** A menu button (an <a> or a <button>); mark the current one `data-active="true"`. */
export function sidebarMenuButtonClass(opts: { variant?: SidebarMenuButtonVariant; size?: SidebarMenuButtonSize } & { className?: string } = {}): string {
  if (opts.className) return cn(sidebarMenuButtonClass({ ...opts, className: undefined }), opts.className);
  return cn(
    'cn-sidebar-menu-button peer/menu-button group/menu-button flex w-full items-center overflow-hidden outline-hidden disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate',
    MENU_BUTTON_VARIANTS[opts.variant ?? 'default'],
    MENU_BUTTON_SIZES[opts.size ?? 'default'],
  );
}

/** shadcn's name for {@link sidebarMenuButtonClass}. Like cva, it merges a `className`. */
export function sidebarMenuButtonVariants(opts: { variant?: SidebarMenuButtonVariant; size?: SidebarMenuButtonSize; className?: string } = {}): string {
  return sidebarMenuButtonClass(opts);
}

/** A menu item's action button; `showOnHover` hides it until the item is hovered or focused. */
export function sidebarMenuActionClass(opts: { showOnHover?: boolean } = {}): string {
  return cn(
    'cn-sidebar-menu-action flex items-center justify-center outline-hidden transition-transform group-data-[collapsible=icon]:hidden after:absolute after:-inset-2 md:after:hidden [&>svg]:shrink-0',
    opts.showOnHover ? 'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground aria-expanded:opacity-100 md:opacity-0' : '',
  );
}

/** A menu item's badge. */
export function sidebarMenuBadgeClass(): string {
  return 'cn-sidebar-menu-badge flex items-center justify-center tabular-nums select-none group-data-[collapsible=icon]:hidden';
}

/**
 * A loading placeholder for a menu item. `width` is the text bar's width
 * (shadcn picks a random one, which would differ between server and client).
 */
export function sidebarMenuSkeleton(opts: { showIcon?: boolean; width?: string } = {}) {
  return html`<div data-slot="sidebar-menu-skeleton" data-sidebar="menu-skeleton" class="cn-sidebar-menu-skeleton flex items-center">${opts.showIcon
    ? html`<div data-sidebar="menu-skeleton-icon" class=${cn(skeletonClass(), 'cn-sidebar-menu-skeleton-icon')}></div>`
    : ''}<div data-sidebar="menu-skeleton-text" style=${`--skeleton-width: ${opts.width ?? '70%'}`} class=${cn(skeletonClass(), 'cn-sidebar-menu-skeleton-text max-w-(--skeleton-width) flex-1')}></div></div>`;
}

/** A submenu (<ul>). */
export function sidebarMenuSubClass(): string {
  return 'cn-sidebar-menu-sub flex min-w-0 flex-col';
}

/** A submenu item (<li>). */
export function sidebarMenuSubItemClass(): string {
  return 'group/menu-sub-item relative';
}

/** A submenu button (an <a>); `size` is "sm" or "md", set as `data-size`. */
export function sidebarMenuSubButtonClass(): string {
  return 'cn-sidebar-menu-sub-button flex min-w-0 -translate-x-px items-center overflow-hidden outline-hidden group-data-[collapsible=icon]:hidden disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:shrink-0';
}

// --------------------------------------------------------------------------
// <ui-sidebar-provider>
// --------------------------------------------------------------------------

function providerOf(el: Element): UiSidebarProvider | null {
  return (typeof el.closest === 'function' ? el.closest(PROVIDER) : null) as UiSidebarProvider | null;
}

export class UiSidebarProvider extends WebComponent({
  defaultOpen: prop(String, { attribute: 'default-open' }),
  open: prop(Boolean, { reflect: true }),
}) {
  readonly #openMobile = signal(false);
  get openMobile() { return this.#openMobile.get(); }
  set openMobile(v) { this.#openMobile.set(v); }
  readonly #isMobile = signal(false);
  get isMobile() { return this.#isMobile.get(); }
  set isMobile(v) { this.#isMobile.set(v); }
  _query: MediaQueryList | null = null;
  _parsed = false;

  constructor() {
    super();
    this.defaultOpen = 'true';
    this.open = false;
  }

  /** "expanded" or "collapsed", as shadcn's `state`. */
  get state(): 'expanded' | 'collapsed' {
    return this.open ? 'expanded' : 'collapsed';
  }

  willUpdate(changedProperties: Map<string, unknown>): void {
    super.willUpdate?.(changedProperties);
    if (this._parsed) return;
    this._parsed = true;
    // An `open` attribute wins; otherwise default-open decides.
    if (!this.hasAttribute?.('open')) this.open = this.defaultOpen !== 'false';
  }

  connectedCallback(): void {
    super.connectedCallback?.();
    window.addEventListener('keydown', this._onKeyDown);
    if (typeof matchMedia === 'function') {
      this._query = matchMedia(MOBILE_QUERY);
      this.isMobile = this._query.matches;
      this._query.addEventListener('change', this._onQuery);
    }
  }

  disconnectedCallback(): void {
    window.removeEventListener('keydown', this._onKeyDown);
    this._query?.removeEventListener('change', this._onQuery);
    super.disconnectedCallback?.();
  }

  render() {
    return html`<div
      data-slot="sidebar-wrapper"
      style="--sidebar-width: 16rem; --sidebar-width-icon: 3rem"
      class=${sidebarWrapperClass()}
    ><slot></slot></div>`;
  }

  updated(changedProperties: Map<string, unknown>): void {
    super.updated?.(changedProperties);
    // `isMobile` and `openMobile` are signals, so a part that reads them
    // re-renders on its own; only the `open` property needs the nudge.
    if (changedProperties.has('open')) {
      for (const part of Array.from(this.querySelectorAll<WebComponent>('ui-sidebar, ui-sidebar-trigger, ui-sidebar-rail'))) {
        if (providerOf(part) === this) part.requestUpdate?.();
      }
    }
  }

  /** Open or close the desktop sidebar, keeping the choice in the cookie. */
  setOpen(open: boolean): void {
    if (open === this.open) return;
    this.open = open;
    if (typeof document !== 'undefined') document.cookie = `${COOKIE}=${open}; path=/; max-age=${COOKIE_MAX_AGE}`;
    this.dispatchEvent(new CustomEvent('ui-open-change', { bubbles: true, detail: { open } }));
  }

  /** Open or close the phone sheet. */
  setOpenMobile(open: boolean): void {
    this.openMobile = open;
  }

  /** Toggle the sheet on a phone, the sidebar otherwise. */
  toggle(): void {
    if (this.isMobile) this.setOpenMobile(!this.openMobile);
    else this.setOpen(!this.open);
  }

  _onQuery = (e: MediaQueryListEvent): void => {
    this.isMobile = e.matches;
  };

  _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.toggle();
    }
  };
}
UiSidebarProvider.register('ui-sidebar-provider');

// --------------------------------------------------------------------------
// <ui-sidebar>
// --------------------------------------------------------------------------

export class UiSidebar extends WebComponent({
  side: prop<'left' | 'right'>(String),
  variant: prop<'sidebar' | 'floating' | 'inset'>(String),
  collapsible: prop<'offcanvas' | 'icon' | 'none'>(String),
}) {
  _authored: string | null = null;

  constructor() {
    super();
    this.side = 'left';
    this.variant = 'sidebar';
    this.collapsible = 'offcanvas';
  }

  _host(attrs: Record<string, string | null>, cls: string): void {
    if (typeof this.setAttribute !== 'function') return;
    this.setAttribute('class', cn(cls, this._authored));
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null) this.removeAttribute(k);
      else this.setAttribute(k, v);
    }
  }

  // The sidebar's state and its group / peer markers sit on its own host:
  // the inset beside it styles itself with peer-data-*, which needs a real
  // sibling, and everything inside reads group-data-*.
  render() {
    this._authored = takeAuthoredClass(this);
    const provider = providerOf(this);
    const side = this.side === 'right' ? 'right' : 'left';
    const floating = this.variant === 'floating' || this.variant === 'inset';
    if (this.collapsible === 'none') {
      this._host({ 'data-slot': 'sidebar', 'data-state': null, 'data-collapsible': null, 'data-variant': null, 'data-side': null },
        'flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground');
      return html`<slot></slot>`;
    }
    if (provider?.isMobile) {
      this._host({ 'data-slot': null, 'data-state': null, 'data-collapsible': null, 'data-variant': null, 'data-side': null }, 'contents');
      return html`<ui-sheet ?open=${!!provider.openMobile} @ui-open-change=${(e: CustomEvent) => {
        if (e.target === e.currentTarget) provider.setOpenMobile(!!e.detail?.open);
      }}><ui-sheet-content
        side=${side}
        show-close-button="false"
        data-sidebar="sidebar"
        data-slot="sidebar"
        data-mobile="true"
        style="--sidebar-width: var(--sidebar-width-mobile, 18rem)"
        class="w-(--sidebar-width) bg-sidebar p-0 text-sidebar-foreground"
      ><h2 data-slot="sheet-title" class="sr-only">Sidebar</h2><p data-slot="sheet-description" class="sr-only">Displays the mobile sidebar.</p><div class="flex h-full w-full flex-col"><slot></slot></div></ui-sheet-content></ui-sheet>`;
    }
    const state = provider?.state ?? 'expanded';
    this._host({
      'data-slot': 'sidebar',
      'data-state': state,
      'data-collapsible': state === 'collapsed' ? this.collapsible : '',
      'data-variant': this.variant,
      'data-side': side,
    }, 'group peer hidden text-sidebar-foreground md:block');
    return html`<div
      data-slot="sidebar-gap"
      class=${cn(
        'cn-sidebar-gap relative w-(--sidebar-width) bg-transparent group-data-[collapsible=offcanvas]:w-0 group-data-[side=right]:rotate-180',
        floating ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]' : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
      )}
    ></div><div
      data-slot="sidebar-container"
      data-side=${side}
      class=${cn(
        'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear data-[side=left]:left-0 data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:right-0 data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)] md:flex',
        floating ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]' : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
      )}
    ><div data-sidebar="sidebar" data-slot="sidebar-inner" class="cn-sidebar-inner flex size-full flex-col"><slot></slot></div></div>`;
  }
}
UiSidebar.register('ui-sidebar');

// --------------------------------------------------------------------------
// <ui-sidebar-trigger> and <ui-sidebar-rail>
// --------------------------------------------------------------------------

export class UiSidebarTrigger extends WebComponent {
  render() {
    return html`<button
      type="button"
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      class=${cn(buttonClass({ variant: 'ghost', size: 'icon-sm' }), 'cn-sidebar-trigger')}
      @click=${() => providerOf(this)?.toggle()}
    ><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="cn-rtl-flip rtl:rotate-180"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path></svg><span class="sr-only">Toggle Sidebar</span></button>`;
  }
}
UiSidebarTrigger.register('ui-sidebar-trigger');

export class UiSidebarRail extends WebComponent {
  render() {
    return html`<button
      type="button"
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabindex="-1"
      title="Toggle Sidebar"
      class="cn-sidebar-rail absolute inset-y-0 z-20 hidden w-4 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] sm:flex ltr:-translate-x-1/2 rtl:-translate-x-1/2 in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize [[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar [[data-side=left][data-collapsible=offcanvas]_&]:-right-2 [[data-side=right][data-collapsible=offcanvas]_&]:-left-2"
      @click=${() => providerOf(this)?.toggle()}
    ></button>`;
  }
}
UiSidebarRail.register('ui-sidebar-rail');

// --------------------------------------------------------------------------
// <ui-sidebar-inset>
// --------------------------------------------------------------------------

export class UiSidebarInset extends WebComponent {
  _authored: string | null = null;

  // The inset is the sidebar's following sibling, so peer-data-* reaches it
  // only on its own host, which is also the page's main landmark.
  render() {
    this._authored = takeAuthoredClass(this);
    if (typeof this.setAttribute === 'function') {
      this.setAttribute('class', cn('cn-sidebar-inset relative flex w-full flex-1 flex-col', this._authored));
      this.setAttribute('data-slot', 'sidebar-inset');
      this.setAttribute('role', 'main');
    }
    return html`<slot></slot>`;
  }
}
UiSidebarInset.register('ui-sidebar-inset');
