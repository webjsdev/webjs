import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Navigation menu primitives. Top-nav with dropdown panels.
 *
 *   <ui-navigation-menu>
 *     <ui-navigation-menu-list>
 *       <ui-navigation-menu-item>
 *         <ui-navigation-menu-trigger>Getting Started</ui-navigation-menu-trigger>
 *         <ui-navigation-menu-content>
 *           <ui-navigation-menu-link href="/docs">Docs</ui-navigation-menu-link>
 *         </ui-navigation-menu-content>
 *       </ui-navigation-menu-item>
 *       <ui-navigation-menu-item>
 *         <ui-navigation-menu-link href="/blog">Blog</ui-navigation-menu-link>
 *       </ui-navigation-menu-item>
 *     </ui-navigation-menu-list>
 *   </ui-navigation-menu>
 *
 * Only one item open at a time. Hovering another trigger switches to it.
 * Unlike menubar this renders inline (within layout, not portaled) — the
 * content panels slide in below the trigger row.
 */

const TRIGGER_STYLE = "group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-[color,box-shadow] outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-accent/50 data-[state=open]:text-accent-foreground data-[state=open]:hover:bg-accent data-[state=open]:focus:bg-accent";

export class UiNavigationMenu extends WebComponent {
  static properties = { viewport: { type: Boolean } };
  declare viewport: boolean;
  private _slot = '';
  private _openItem: HTMLElement | null = null;
  // Track the content node currently teleported into the viewport, so we can
  // move it back out before swapping in a new one.
  private _activeContent: HTMLElement | null = null;
  // Remember each content's original parent so it can be returned on close.
  private _contentHome = new WeakMap<HTMLElement, HTMLElement>();

  constructor() { super(); this.viewport = true; }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('ui-nav-menu-open', this._onOpen as EventListener);
    this.addEventListener('ui-nav-menu-close', this._onClose as EventListener);
    this.addEventListener('ui-nav-menu-hover', this._onHover as EventListener);
    document.addEventListener('pointerdown', this._onOutside);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this._onOutside);
  }

  _onOpen = (e: any) => this._setOpen(e.target as HTMLElement);
  _onClose = () => this._setOpen(null);
  _onHover = (e: any) => { if (this._openItem && this._openItem !== e.target) this._setOpen(e.target as HTMLElement); };

  _setOpen(target: HTMLElement | null) {
    if (this._openItem === target) return;
    if (this._openItem) (this._openItem as any).setItemOpen(false);
    this._openItem = target;
    if (target) (target as any).setItemOpen(true);
    this._syncViewport(target);
    this._syncIndicator(target);
  }

  // Teleport the newly-opened item's <ui-navigation-menu-content> into the
  // viewport. The previously-teleported content (if any) is returned to its
  // original parent so it can be reopened later in place.
  _syncViewport(target: HTMLElement | null) {
    if (!this.viewport) return;
    const viewportEl =
      (this.querySelector('[data-slot="navigation-menu-viewport"]') as HTMLElement | null) ??
      (this.querySelector('ui-navigation-menu-viewport') as HTMLElement | null);
    if (!viewportEl) return;
    // Move out the old one.
    if (this._activeContent) {
      const home = this._contentHome.get(this._activeContent);
      if (home) home.appendChild(this._activeContent);
      this._activeContent = null;
    }
    if (!target) return;
    const content = target.querySelector('ui-navigation-menu-content') as HTMLElement | null;
    if (!content) return;
    if (!this._contentHome.has(content) && content.parentElement) {
      this._contentHome.set(content, content.parentElement);
    }
    viewportEl.appendChild(content);
    this._activeContent = content;
  }

  // Slide the small triangle/arrow indicator under the active trigger's
  // horizontal centre. Hidden when nothing is open.
  _syncIndicator(target: HTMLElement | null) {
    const indicator = this.querySelector('ui-navigation-menu-indicator') as HTMLElement | null;
    if (!indicator) return;
    if (!target) {
      indicator.setAttribute('data-state', 'hidden');
      return;
    }
    const trigger = target.querySelector('ui-navigation-menu-trigger') as HTMLElement | null;
    if (!trigger) {
      indicator.setAttribute('data-state', 'hidden');
      return;
    }
    const triggerRect = trigger.getBoundingClientRect();
    const navRect = this.getBoundingClientRect();
    const indicatorWidth = indicator.offsetWidth || 10;
    const x = triggerRect.left - navRect.left + triggerRect.width / 2 - indicatorWidth / 2;
    indicator.style.position = 'absolute';
    indicator.style.left = '0';
    indicator.style.transform = `translateX(${x}px)`;
    indicator.style.transition = 'transform 250ms ease';
    indicator.setAttribute('data-state', 'visible');
  }

  render() {
    return html`<nav data-slot="navigation-menu" data-viewport=${String(this.viewport)} class=${cn('group/navigation-menu relative flex max-w-max flex-1 items-center justify-center')}>${unsafeHTML(this._slot)}${this.viewport ? html`<ui-navigation-menu-viewport></ui-navigation-menu-viewport>` : html``}</nav>`;
  }
}
UiNavigationMenu.register('ui-navigation-menu');

export class UiNavigationMenuList extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  render() { return html`<ul data-slot="navigation-menu-list" class=${cn('group flex flex-1 list-none items-center justify-center gap-1')}>${unsafeHTML(this._slot)}</ul>`; }
}
UiNavigationMenuList.register('ui-navigation-menu-list');

export class UiNavigationMenuItem extends WebComponent {
  static properties = { open: { type: Boolean, reflect: true } };
  declare open: boolean;
  private _slot = '';
  constructor() { super(); this.open = false; }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('ui-nav-menu-trigger-click', () => {
      if (this.open) this.dispatchEvent(new CustomEvent('ui-nav-menu-close', { bubbles: true }));
      else this.dispatchEvent(new CustomEvent('ui-nav-menu-open', { bubbles: true }));
    });
    this.addEventListener('ui-nav-menu-trigger-hover', () => this.dispatchEvent(new CustomEvent('ui-nav-menu-hover', { bubbles: true })));
  }

  setItemOpen(open: boolean) {
    if (open === this.open) return;
    this.open = open;
    const state = open ? 'open' : 'closed';
    this.querySelectorAll('ui-navigation-menu-trigger, ui-navigation-menu-content').forEach((el) => (el as HTMLElement).setAttribute('data-state', state));
  }

  render() { return html`<li data-slot="navigation-menu-item" class=${cn('relative')}>${unsafeHTML(this._slot)}</li>`; }
}
UiNavigationMenuItem.register('ui-navigation-menu-item');

export class UiNavigationMenuTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', () => this.dispatchEvent(new CustomEvent('ui-nav-menu-trigger-click', { bubbles: true })));
    this.addEventListener('pointerenter', () => this.dispatchEvent(new CustomEvent('ui-nav-menu-trigger-hover', { bubbles: true })));
  }
  render() {
    return html`
      <button data-slot="navigation-menu-trigger" data-state=${this.getAttribute('data-state') || 'closed'} class=${cn(TRIGGER_STYLE, 'group')}>
        ${unsafeHTML(this._slot)}
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="relative top-[1px] ml-1 size-3 transition duration-300 group-data-[state=open]:rotate-180" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
    `;
  }
  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() { this.requestUpdate(); }
}
UiNavigationMenuTrigger.register('ui-navigation-menu-trigger');

export class UiNavigationMenuContent extends WebComponent {
  private _slot = '';
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  render() {
    const state = this.getAttribute('data-state') || 'closed';
    return html`
      <div data-slot="navigation-menu-content" data-state=${state} class=${cn('top-0 left-0 w-full p-2 pr-2.5 md:absolute md:w-auto', 'group-data-[viewport=false]/navigation-menu:top-full group-data-[viewport=false]/navigation-menu:mt-1.5 group-data-[viewport=false]/navigation-menu:overflow-hidden group-data-[viewport=false]/navigation-menu:rounded-md group-data-[viewport=false]/navigation-menu:border group-data-[viewport=false]/navigation-menu:bg-popover group-data-[viewport=false]/navigation-menu:text-popover-foreground group-data-[viewport=false]/navigation-menu:shadow group-data-[viewport=false]/navigation-menu:duration-200 group-data-[viewport=false]/navigation-menu:data-[state=closed]:animate-out group-data-[viewport=false]/navigation-menu:data-[state=closed]:fade-out-0 group-data-[viewport=false]/navigation-menu:data-[state=closed]:zoom-out-95 group-data-[viewport=false]/navigation-menu:data-[state=open]:animate-in group-data-[viewport=false]/navigation-menu:data-[state=open]:fade-in-0 group-data-[viewport=false]/navigation-menu:data-[state=open]:zoom-in-95', state === 'closed' ? 'hidden' : '')}>
        ${unsafeHTML(this._slot)}
      </div>
    `;
  }
  static get observedAttributes() { return ['data-state']; }
  attributeChangedCallback() { this.requestUpdate(); }
}
UiNavigationMenuContent.register('ui-navigation-menu-content');

export class UiNavigationMenuLink extends WebComponent {
  static properties = { href: { type: String }, active: { type: Boolean } };
  declare href: string; declare active: boolean;
  private _slot = '';
  constructor() { super(); this.href = '#'; this.active = false; }
  connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
  render() {
    const cls = "flex flex-col gap-1 rounded-sm p-2 text-sm transition-all outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 data-[active=true]:bg-accent/50 data-[active=true]:text-accent-foreground data-[active=true]:hover:bg-accent data-[active=true]:focus:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground";
    return html`<a data-slot="navigation-menu-link" data-active=${String(this.active)} href=${this.href} class=${cn(cls)}>${unsafeHTML(this._slot)}</a>`;
  }
}
UiNavigationMenuLink.register('ui-navigation-menu-link');

export class UiNavigationMenuViewport extends WebComponent {
  render() {
    return html`
      <div class=${cn('absolute top-full left-0 isolate z-50 flex justify-center')}>
        <div data-slot="navigation-menu-viewport" class=${cn('origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:zoom-in-90')}></div>
      </div>
    `;
  }
}
UiNavigationMenuViewport.register('ui-navigation-menu-viewport');

export class UiNavigationMenuIndicator extends WebComponent {
  render() {
    return html`
      <div data-slot="navigation-menu-indicator" class=${cn('top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:animate-in data-[state=visible]:fade-in')}>
        <div class="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md"></div>
      </div>
    `;
  }
}
UiNavigationMenuIndicator.register('ui-navigation-menu-indicator');
