import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Sidebar primitives — a collapsible navigation shell.
 *
 *   <ui-sidebar-provider>
 *     <ui-sidebar side="left" variant="sidebar" collapsible="icon">
 *       <ui-sidebar-header>...</ui-sidebar-header>
 *       <ui-sidebar-content>
 *         <ui-sidebar-group>
 *           <ui-sidebar-group-label>Items</ui-sidebar-group-label>
 *           <ui-sidebar-group-content>
 *             <ui-sidebar-menu>
 *               <ui-sidebar-menu-item>
 *                 <ui-sidebar-menu-button>Home</ui-sidebar-menu-button>
 *               </ui-sidebar-menu-item>
 *             </ui-sidebar-menu>
 *           </ui-sidebar-group-content>
 *         </ui-sidebar-group>
 *       </ui-sidebar-content>
 *       <ui-sidebar-footer>...</ui-sidebar-footer>
 *       <ui-sidebar-rail></ui-sidebar-rail>
 *     </ui-sidebar>
 *     <ui-sidebar-inset>
 *       <ui-sidebar-trigger></ui-sidebar-trigger>
 *       <!-- page content -->
 *     </ui-sidebar-inset>
 *   </ui-sidebar-provider>
 *
 * Feature parity with shadcn React sidebar:
 *   - Open/close state with cookie persistence (`sidebar:state`, 7d).
 *   - Drag-to-resize via <ui-sidebar-rail>; width persisted in `sidebar:width`.
 *   - Keyboard shortcut Ctrl/Cmd+B toggles the sidebar globally.
 *   - Mobile breakpoint (≤768px): sidebar slides in over content as a sheet
 *     backed by a backdrop; clicking outside or pressing Esc closes it.
 */

const SIDEBAR_WIDTH_DEFAULT = '16rem';
const SIDEBAR_WIDTH_ICON = '3rem';
const SIDEBAR_WIDTH_MOBILE = '18rem';
const SIDEBAR_WIDTH_MIN_PX = 256;
const SIDEBAR_WIDTH_MAX_PX = 480;
const MOBILE_BREAKPOINT_PX = 768;

const COOKIE_STATE = 'sidebar:state';
const COOKIE_WIDTH = 'sidebar:width';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}
function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export class UiSidebarProvider extends WebComponent {
  static properties = {
    defaultOpen: { type: Boolean, attribute: 'default-open' },
    open: { type: Boolean, reflect: true },
    mobile: { type: Boolean, state: true, reflect: true },
    openMobile: { type: Boolean, state: true },
  };
  declare defaultOpen: boolean;
  declare open: boolean;
  declare mobile: boolean;
  declare openMobile: boolean;

  private _slot = '';
  private _mql: MediaQueryList | null = null;
  private _width: string | null = null;

  constructor() {
    super();
    this.defaultOpen = true;
    this.open = true;
    this.mobile = false;
    this.openMobile = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();

    // Restore open state from cookie (overrides default-open if present).
    const cookieState = readCookie(COOKIE_STATE);
    if (cookieState === 'true') this.open = true;
    else if (cookieState === 'false') this.open = false;
    else if (this.hasAttribute('default-open')) this.open = this.defaultOpen;

    // Restore custom width from cookie.
    const cookieWidth = readCookie(COOKIE_WIDTH);
    if (cookieWidth && /^\d+(\.\d+)?(px|rem|em)$/.test(cookieWidth)) {
      this._width = cookieWidth;
    }

    // Mobile detection via matchMedia.
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this._mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
      this.mobile = this._mql.matches;
      this._mql.addEventListener('change', this._onMqlChange);
    }

    super.connectedCallback();
    this.addEventListener('ui-sidebar-toggle', this._onToggle as EventListener);
    this.addEventListener('ui-sidebar-resize', this._onResize as EventListener);
    this.addEventListener('ui-sidebar-resize-end', this._onResizeEnd as EventListener);
    this.addEventListener('ui-sidebar-mobile-dismiss', this._onMobileDismiss as EventListener);
    document.addEventListener('keydown', this._onKey);
    queueMicrotask(() => this._sync());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-sidebar-toggle', this._onToggle as EventListener);
    this.removeEventListener('ui-sidebar-resize', this._onResize as EventListener);
    this.removeEventListener('ui-sidebar-resize-end', this._onResizeEnd as EventListener);
    this.removeEventListener('ui-sidebar-mobile-dismiss', this._onMobileDismiss as EventListener);
    document.removeEventListener('keydown', this._onKey);
    if (this._mql) {
      this._mql.removeEventListener('change', this._onMqlChange);
      this._mql = null;
    }
  }

  _onMqlChange = (e: MediaQueryListEvent) => {
    this.mobile = e.matches;
    if (!e.matches) this.openMobile = false;
    this._sync();
  };

  _onToggle = () => { this.toggle(); };

  _onResize = (e: Event) => {
    const ce = e as CustomEvent<{ width: number }>;
    const w = Math.max(SIDEBAR_WIDTH_MIN_PX, Math.min(SIDEBAR_WIDTH_MAX_PX, ce.detail?.width ?? 0));
    if (w > 0) {
      this._width = w + 'px';
      this._applyWidth();
    }
  };

  _onResizeEnd = () => {
    if (this._width) writeCookie(COOKIE_WIDTH, this._width);
  };

  _onMobileDismiss = () => {
    if (this.mobile) {
      this.openMobile = false;
      this._sync();
    }
  };

  _onKey = (e: KeyboardEvent) => {
    if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      this.toggle();
      return;
    }
    if (e.key === 'Escape' && this.mobile && this.openMobile) {
      this.openMobile = false;
      this._sync();
    }
  };

  toggle() {
    if (this.mobile) {
      this.openMobile = !this.openMobile;
    } else {
      this.open = !this.open;
      writeCookie(COOKIE_STATE, this.open ? 'true' : 'false');
    }
    this._sync();
    this.dispatchEvent(new CustomEvent('open-change', {
      detail: { open: this.mobile ? this.openMobile : this.open, mobile: this.mobile },
      bubbles: true,
      composed: true,
    }));
  }

  _applyWidth() {
    const wrapper = this.querySelector('[data-slot="sidebar-wrapper"]') as HTMLElement | null;
    if (wrapper && this._width) {
      wrapper.style.setProperty('--sidebar-width', this._width);
    }
  }

  _sync() {
    const visualOpen = this.mobile ? this.openMobile : this.open;
    const state = visualOpen ? 'expanded' : 'collapsed';
    this.setAttribute('data-state', state);
    this.setAttribute('data-mobile', this.mobile ? 'true' : 'false');
    if (this.mobile) {
      this.setAttribute('data-mobile-open', this.openMobile ? 'true' : 'false');
    } else {
      this.removeAttribute('data-mobile-open');
    }
    this.querySelectorAll(
      'ui-sidebar, ui-sidebar-inset, ui-sidebar-trigger, ui-sidebar-rail, ui-sidebar-backdrop',
    ).forEach((el) => {
      (el as HTMLElement).setAttribute('data-state', state);
      (el as HTMLElement).setAttribute('data-mobile', this.mobile ? 'true' : 'false');
    });
    this._applyWidth();
  }

  render() {
    const visualOpen = this.mobile ? this.openMobile : this.open;
    const style = `--sidebar-width:${this._width ?? SIDEBAR_WIDTH_DEFAULT};` +
                  `--sidebar-width-icon:${SIDEBAR_WIDTH_ICON};` +
                  `--sidebar-width-mobile:${SIDEBAR_WIDTH_MOBILE};`;
    return html`
      <div
        data-slot="sidebar-wrapper"
        data-state=${visualOpen ? 'expanded' : 'collapsed'}
        data-mobile=${this.mobile ? 'true' : 'false'}
        style=${style}
        class=${cn('group/sidebar-wrapper flex min-h-svh w-full')}
      >${unsafeHTML(this._slot)}${this.mobile && this.openMobile
        ? html`<ui-sidebar-backdrop></ui-sidebar-backdrop>`
        : ''}</div>
    `;
  }

  static get observedAttributes() { return ['open']; }
  attributeChangedCallback(name: string, oldV: string | null, newV: string | null) {
    if (oldV !== newV) this._sync();
  }
}
UiSidebarProvider.register('ui-sidebar-provider');

export class UiSidebar extends WebComponent {
  static properties = {
    side: { type: String, reflect: true },
    variant: { type: String, reflect: true },
    collapsible: { type: String, reflect: true },
  };
  declare side: 'left' | 'right';
  declare variant: 'sidebar' | 'floating' | 'inset';
  declare collapsible: 'offcanvas' | 'icon' | 'none';

  private _slot = '';

  constructor() {
    super();
    this.side = 'left';
    this.variant = 'sidebar';
    this.collapsible = 'offcanvas';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }

  render() {
    const state = this.getAttribute('data-state') || 'expanded';
    const isMobile = this.getAttribute('data-mobile') === 'true';
    const collapsed = state === 'collapsed';

    if (this.collapsible === 'none') {
      return html`
        <div
          data-slot="sidebar"
          data-variant=${this.variant}
          data-side=${this.side}
          data-collapsible="none"
          class=${cn('flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground')}
        >${unsafeHTML(this._slot)}</div>
      `;
    }

    // Mobile sheet variant — slide in from the configured side as an overlay.
    if (isMobile) {
      const open = state === 'expanded';
      return html`
        <div
          data-slot="sidebar"
          data-variant=${this.variant}
          data-side=${this.side}
          data-mobile="true"
          data-state=${state}
          class=${cn(
            'fixed inset-y-0 z-50 flex h-svh w-(--sidebar-width-mobile) flex-col bg-sidebar text-sidebar-foreground shadow-lg',
            'transition-transform duration-200 ease-linear',
            this.side === 'left' ? 'left-0' : 'right-0',
            open
              ? 'translate-x-0'
              : this.side === 'left' ? '-translate-x-full' : 'translate-x-full',
          )}
          style="--sidebar-width:var(--sidebar-width-mobile);"
        >${unsafeHTML(this._slot)}</div>
      `;
    }

    const collapseMode = collapsed ? this.collapsible : '';
    const widthClass = (() => {
      if (!collapsed) return 'w-(--sidebar-width)';
      if (this.collapsible === 'offcanvas') return 'w-0';
      if (this.collapsible === 'icon') return 'w-(--sidebar-width-icon)';
      return 'w-(--sidebar-width)';
    })();

    return html`
      <div
        class="group peer text-sidebar-foreground"
        data-state=${state}
        data-collapsible=${collapseMode}
        data-variant=${this.variant}
        data-side=${this.side}
        data-slot="sidebar"
      >
        <div
          data-slot="sidebar-gap"
          class=${cn(
            'relative bg-transparent transition-[width] duration-200 ease-linear',
            widthClass,
          )}
        ></div>
        <div
          data-slot="sidebar-container"
          class=${cn(
            'fixed inset-y-0 z-10 h-svh transition-[left,right,width] duration-200 ease-linear flex',
            widthClass,
            this.side === 'left' ? 'left-0' : 'right-0',
            collapsed && this.collapsible === 'offcanvas' && (this.side === 'left' ? 'left-[calc(var(--sidebar-width)*-1)]' : 'right-[calc(var(--sidebar-width)*-1)]'),
            this.variant === 'floating' || this.variant === 'inset'
              ? 'p-2'
              : this.side === 'left' ? 'border-r' : 'border-l',
          )}
        >
          <div
            data-sidebar="sidebar"
            data-slot="sidebar-inner"
            class=${cn(
              'flex h-full w-full flex-col bg-sidebar',
              this.variant === 'floating' && 'rounded-lg border border-sidebar-border shadow-sm',
            )}
          >${unsafeHTML(this._slot)}</div>
        </div>
      </div>
    `;
  }

  static get observedAttributes() { return ['data-state', 'data-mobile']; }
  attributeChangedCallback(name: string, oldV: string | null, newV: string | null) {
    if (oldV !== newV) this.requestUpdate();
  }
}
UiSidebar.register('ui-sidebar');

export class UiSidebarTrigger extends WebComponent {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this._onClick);
  }
  _onClick = () => {
    this.dispatchEvent(new CustomEvent('ui-sidebar-toggle', { bubbles: true, composed: true }));
  };
  render() {
    return html`
      <button
        type="button"
        data-sidebar="trigger"
        data-slot="sidebar-trigger"
        aria-label="Toggle Sidebar"
        class=${cn(
          'inline-flex size-7 items-center justify-center rounded-md',
          'hover:bg-accent hover:text-accent-foreground transition-colors',
        )}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
        <span class="sr-only">Toggle Sidebar</span>
      </button>
    `;
  }
}
UiSidebarTrigger.register('ui-sidebar-trigger');

/**
 * Rail — narrow strip alongside the sidebar. Click toggles open/close,
 * pointer-down + drag adjusts the width (clamped to [256, 480] px) and
 * persists it to a cookie. On mobile the rail collapses to a tap-to-close
 * affordance.
 */
export class UiSidebarRail extends WebComponent {
  private _dragging = false;
  private _startX = 0;
  private _startWidth = 0;
  private _moved = false;
  private _side: 'left' | 'right' = 'left';

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
    this.addEventListener('pointerdown', this._onPointerDown);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('pointerdown', this._onPointerDown);
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
  }

  _onClick = (e: Event) => {
    if (this._moved) {
      // Swallow the click that follows a drag.
      e.stopPropagation();
      e.preventDefault();
      this._moved = false;
      return;
    }
    this.dispatchEvent(new CustomEvent('ui-sidebar-toggle', { bubbles: true, composed: true }));
  };

  _onPointerDown = (e: PointerEvent) => {
    // Only main button.
    if (e.button !== 0) return;
    const provider = this.closest('ui-sidebar-provider') as HTMLElement | null;
    const wrapper = provider?.querySelector('[data-slot="sidebar-wrapper"]') as HTMLElement | null;
    if (!provider || !wrapper) return;
    // Don't drag on mobile.
    if (provider.getAttribute('data-mobile') === 'true') return;

    const sidebar = this.closest('ui-sidebar') as HTMLElement | null;
    this._side = (sidebar?.getAttribute('side') as 'left' | 'right') ?? 'left';

    const styles = getComputedStyle(wrapper);
    const cssWidth = styles.getPropertyValue('--sidebar-width').trim() || SIDEBAR_WIDTH_DEFAULT;
    this._startWidth = this._cssLengthToPx(cssWidth, wrapper);
    this._startX = e.clientX;
    this._dragging = true;
    this._moved = false;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', this._onPointerMove);
    document.addEventListener('pointerup', this._onPointerUp);
    try { this.setPointerCapture(e.pointerId); } catch { /* not all envs */ }
    e.preventDefault();
  };

  _onPointerMove = (e: PointerEvent) => {
    if (!this._dragging) return;
    const dx = e.clientX - this._startX;
    const delta = this._side === 'left' ? dx : -dx;
    if (Math.abs(delta) > 2) this._moved = true;
    const w = this._startWidth + delta;
    this.dispatchEvent(new CustomEvent('ui-sidebar-resize', {
      detail: { width: w }, bubbles: true, composed: true,
    }));
  };

  _onPointerUp = () => {
    if (!this._dragging) return;
    this._dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
    if (this._moved) {
      this.dispatchEvent(new CustomEvent('ui-sidebar-resize-end', {
        bubbles: true, composed: true,
      }));
    }
  };

  _cssLengthToPx(value: string, ref: HTMLElement): number {
    if (value.endsWith('px')) return parseFloat(value);
    if (value.endsWith('rem') || value.endsWith('em')) {
      const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      return parseFloat(value) * root;
    }
    // Fallback: try probing.
    const probe = document.createElement('div');
    probe.style.width = value;
    probe.style.visibility = 'hidden';
    probe.style.position = 'absolute';
    ref.appendChild(probe);
    const px = probe.getBoundingClientRect().width;
    probe.remove();
    return px || 256;
  }

  render() {
    return html`
      <button
        type="button"
        data-sidebar="rail"
        data-slot="sidebar-rail"
        aria-label="Toggle Sidebar"
        tabindex="-1"
        title="Toggle Sidebar"
        class=${cn(
          'absolute inset-y-0 z-20 w-4 -translate-x-1/2 cursor-col-resize transition-all ease-linear',
          'after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border',
          'group-data-[side=left]:-right-4 group-data-[side=right]:left-0',
        )}
      ></button>
    `;
  }
}
UiSidebarRail.register('ui-sidebar-rail');

/**
 * Backdrop — only rendered on mobile when the sidebar sheet is open.
 * Click anywhere to dismiss; the provider listens for the
 * `ui-sidebar-mobile-dismiss` event.
 */
export class UiSidebarBackdrop extends WebComponent {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this._onClick);
  }
  _onClick = () => {
    this.dispatchEvent(new CustomEvent('ui-sidebar-mobile-dismiss', { bubbles: true, composed: true }));
  };
  render() {
    return html`
      <div
        data-slot="sidebar-backdrop"
        aria-hidden="true"
        class=${cn(
          'fixed inset-0 z-40 bg-black/50',
          'transition-opacity duration-200 ease-linear',
        )}
      ></div>
    `;
  }
}
UiSidebarBackdrop.register('ui-sidebar-backdrop');

export class UiSidebarInset extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }
  render() {
    return html`
      <main
        data-slot="sidebar-inset"
        class=${cn('relative flex w-full flex-1 flex-col bg-background')}
      >${unsafeHTML(this._slot)}</main>
    `;
  }
}
UiSidebarInset.register('ui-sidebar-inset');

export class UiSidebarInput extends WebComponent {
  static properties = {
    value: { type: String },
    placeholder: { type: String },
    type: { type: String },
  };
  declare value: string;
  declare placeholder: string;
  declare type: string;

  constructor() {
    super();
    this.value = '';
    this.placeholder = '';
    this.type = 'text';
  }

  _onInput = (e: Event) => {
    this.value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value }, bubbles: true }));
  };

  render() {
    return html`
      <input
        data-slot="sidebar-input"
        data-sidebar="input"
        type=${this.type}
        .value=${this.value}
        placeholder=${this.placeholder}
        @input=${this._onInput}
        class=${cn(
          'h-8 w-full rounded-md border border-input bg-background px-3 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring outline-none',
        )}
      />
    `;
  }
}
UiSidebarInput.register('ui-sidebar-input');

export class UiSidebarHeader extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() {
    return html`<div data-slot="sidebar-header" data-sidebar="header" class=${cn('flex flex-col gap-2 p-2')}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiSidebarHeader.register('ui-sidebar-header');

export class UiSidebarFooter extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() {
    return html`<div data-slot="sidebar-footer" data-sidebar="footer" class=${cn('flex flex-col gap-2 p-2')}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiSidebarFooter.register('ui-sidebar-footer');

export class UiSidebarSeparator extends WebComponent {
  render() {
    return html`<div data-slot="sidebar-separator" data-sidebar="separator" class=${cn('mx-2 h-px w-auto bg-sidebar-border')}></div>`;
  }
}
UiSidebarSeparator.register('ui-sidebar-separator');

export class UiSidebarContent extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() {
    return html`<div data-slot="sidebar-content" data-sidebar="content" class=${cn('flex min-h-0 flex-1 flex-col gap-2 overflow-auto')}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiSidebarContent.register('ui-sidebar-content');

export class UiSidebarGroup extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() {
    return html`<div data-slot="sidebar-group" data-sidebar="group" class=${cn('relative flex w-full min-w-0 flex-col p-2')}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiSidebarGroup.register('ui-sidebar-group');

export class UiSidebarGroupLabel extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() {
    return html`<div data-slot="sidebar-group-label" data-sidebar="group-label" class=${cn('flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 transition-[margin,opacity] duration-200 ease-linear [&>svg]:size-4 [&>svg]:shrink-0')}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiSidebarGroupLabel.register('ui-sidebar-group-label');

export class UiSidebarGroupAction extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() {
    return html`<button type="button" data-slot="sidebar-group-action" data-sidebar="group-action" class=${cn('absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0')}>${unsafeHTML(this._slot)}</button>`;
  }
}
UiSidebarGroupAction.register('ui-sidebar-group-action');

export class UiSidebarGroupContent extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() {
    return html`<div data-slot="sidebar-group-content" data-sidebar="group-content" class=${cn('w-full text-sm')}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiSidebarGroupContent.register('ui-sidebar-group-content');

export class UiSidebarMenu extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() {
    return html`<ul data-slot="sidebar-menu" data-sidebar="menu" class=${cn('flex w-full min-w-0 flex-col gap-1')}>${unsafeHTML(this._slot)}</ul>`;
  }
}
UiSidebarMenu.register('ui-sidebar-menu');

export class UiSidebarMenuItem extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() {
    return html`<li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${cn('group/menu-item relative')}>${unsafeHTML(this._slot)}</li>`;
  }
}
UiSidebarMenuItem.register('ui-sidebar-menu-item');

const menuButtonSizes = {
  default: 'h-8 text-sm',
  sm: 'h-7 text-xs',
  lg: 'h-12 text-sm group-data-[collapsible=icon]:p-0!',
} as const;

const menuButtonVariants = {
  default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  outline:
    'bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
} as const;

export class UiSidebarMenuButton extends WebComponent {
  static properties = {
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
    isActive: { type: Boolean, attribute: 'is-active', reflect: true },
    tooltip: { type: String },
  };
  declare variant: keyof typeof menuButtonVariants;
  declare size: keyof typeof menuButtonSizes;
  declare isActive: boolean;
  declare tooltip: string;

  private _slot = '';

  constructor() {
    super();
    this.variant = 'default';
    this.size = 'default';
    this.isActive = false;
    this.tooltip = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }

  render() {
    return html`
      <button
        type="button"
        data-slot="sidebar-menu-button"
        data-sidebar="menu-button"
        data-size=${this.size}
        data-active=${this.isActive ? 'true' : 'false'}
        title=${this.tooltip || null}
        class=${cn(
          'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm transition-[width,height,padding]',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          'active:bg-sidebar-accent active:text-sidebar-accent-foreground',
          'disabled:pointer-events-none disabled:opacity-50',
          'data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground',
          '[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
          menuButtonVariants[this.variant] || menuButtonVariants.default,
          menuButtonSizes[this.size] || menuButtonSizes.default,
        )}
      >${unsafeHTML(this._slot)}</button>
    `;
  }
}
UiSidebarMenuButton.register('ui-sidebar-menu-button');

export class UiSidebarMenuAction extends WebComponent {
  static properties = { showOnHover: { type: Boolean, attribute: 'show-on-hover' } };
  declare showOnHover: boolean;

  private _slot = '';

  constructor() {
    super();
    this.showOnHover = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }

  render() {
    return html`
      <button
        type="button"
        data-slot="sidebar-menu-action"
        data-sidebar="menu-action"
        class=${cn(
          'absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground transition-transform',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          '[&>svg]:size-4 [&>svg]:shrink-0',
          this.showOnHover && 'opacity-0 group-hover/menu-item:opacity-100 group-focus-within/menu-item:opacity-100',
        )}
      >${unsafeHTML(this._slot)}</button>
    `;
  }
}
UiSidebarMenuAction.register('ui-sidebar-menu-action');

export class UiSidebarMenuBadge extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() {
    return html`<div data-slot="sidebar-menu-badge" data-sidebar="menu-badge" class=${cn('pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none')}>${unsafeHTML(this._slot)}</div>`;
  }
}
UiSidebarMenuBadge.register('ui-sidebar-menu-badge');

export class UiSidebarMenuSub extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() {
    return html`<ul data-slot="sidebar-menu-sub" data-sidebar="menu-sub" class=${cn('mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5')}>${unsafeHTML(this._slot)}</ul>`;
  }
}
UiSidebarMenuSub.register('ui-sidebar-menu-sub');

export class UiSidebarMenuSubItem extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.getSourceChildren(); super.connectedCallback(); }
  render() {
    return html`<li data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" class=${cn('group/menu-sub-item relative')}>${unsafeHTML(this._slot)}</li>`;
  }
}
UiSidebarMenuSubItem.register('ui-sidebar-menu-sub-item');

export class UiSidebarMenuSubButton extends WebComponent {
  static properties = {
    href: { type: String },
    size: { type: String, reflect: true },
    isActive: { type: Boolean, attribute: 'is-active', reflect: true },
  };
  declare href: string;
  declare size: 'sm' | 'md';
  declare isActive: boolean;

  private _slot = '';

  constructor() {
    super();
    this.href = '';
    this.size = 'md';
    this.isActive = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.getSourceChildren();
    super.connectedCallback();
  }

  render() {
    const cls = cn(
      'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none',
      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
      this.size === 'sm' ? 'text-xs' : 'text-sm',
      '[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
    );
    if (this.href) {
      return html`
        <a
          href=${this.href}
          data-slot="sidebar-menu-sub-button"
          data-sidebar="menu-sub-button"
          data-size=${this.size}
          data-active=${this.isActive ? 'true' : 'false'}
          class=${cls}
        >${unsafeHTML(this._slot)}</a>
      `;
    }
    return html`
      <button
        type="button"
        data-slot="sidebar-menu-sub-button"
        data-sidebar="menu-sub-button"
        data-size=${this.size}
        data-active=${this.isActive ? 'true' : 'false'}
        class=${cls}
      >${unsafeHTML(this._slot)}</button>
    `;
  }
}
UiSidebarMenuSubButton.register('ui-sidebar-menu-sub-button');
