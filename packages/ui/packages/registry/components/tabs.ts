/**
 * Tabs: sectioned content with keyboard navigation.
 *
 * APG pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 *
 * shadcn parity:
 *   <Tabs>         → <ui-tabs value="..." orientation="horizontal|vertical">
 *   <TabsList>     → <ui-tabs-list variant="default|underline">
 *   <TabsTrigger>  → <ui-tabs-trigger value="...">
 *   <TabsContent>  → <ui-tabs-content value="...">
 *
 * Usage:
 *   <ui-tabs value="account">
 *     <ui-tabs-list>
 *       <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
 *       <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
 *     </ui-tabs-list>
 *     <ui-tabs-content value="account">…</ui-tabs-content>
 *     <ui-tabs-content value="password">…</ui-tabs-content>
 *   </ui-tabs>
 *
 * Attributes on <ui-tabs>:
 *   `value`:      string. Currently-active tab value (reflected, controlled).
 *   `orientation`: "horizontal" (default) | "vertical".
 *
 * Events:
 *   `ui-value-change` on <ui-tabs>: `{ detail: { value } }` after a change.
 *
 * Keyboard (on focused trigger):
 *   ArrowRight/ArrowLeft  next/previous (horizontal)
 *   ArrowDown/ArrowUp     next/previous (vertical)
 *   Home/End              first/last
 *   Enter/Space           activate
 *
 * Design tokens used: --muted, --muted-foreground, --foreground, --background,
 * --input, --ring.
 */

import { WebComponent, html } from '@webjskit/core';
import { cn } from '../lib/utils.ts';

// --------------------------------------------------------------------------
// Class helpers
// --------------------------------------------------------------------------

const TABS_BASE = 'group/tabs flex gap-2 data-[orientation=horizontal]:flex-col';

const TABS_LIST_BASE =
  'group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=underline]:rounded-none';

const TABS_LIST_VARIANTS = {
  default: 'bg-muted',
  underline: 'gap-1 bg-transparent',
} as const;

export type TabsListVariant = keyof typeof TABS_LIST_VARIANTS;

/** Optional helper exposing the tabs-list class for advanced overrides. */
export function tabsListClass(opts: { variant?: TabsListVariant } = {}): string {
  const variant = opts.variant ?? 'default';
  return cn(TABS_LIST_BASE, TABS_LIST_VARIANTS[variant]);
}

const TABS_TRIGGER_CLASS = [
  // cursor-pointer + select-none are mandatory here because the trigger
  // is a custom element (<ui-tabs-trigger>), not a <button>: the host
  // is a generic block by default, so the browser would otherwise paint
  // the I-beam text cursor over the label and let users drag-select
  // tab text mid-click. shadcn's tabs use <button role="tab"> in React,
  // where pointer cursor + select-none come for free; our custom-element
  // wrapper has to ask for them explicitly.
  "relative inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer select-none items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=underline]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  // These two rows mirror shadcn's tabs.tsx EXACTLY (modulo our
  // `variant=line` → `variant=underline` rename). Critical: the
  // border-input rule on active is `dark:` only: light-mode active
  // tabs get bg-background + shadow-sm and NO border. Earlier we
  // tried adding the border in light mode for visibility but it made
  // the underline variant look like outline AND made the default
  // variant feel like two separate buttons. Shadcn's design intent:
  // shadow alone marks the active tab in light mode.
  'group-data-[variant=underline]/tabs-list:bg-transparent group-data-[variant=underline]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=underline]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=underline]/tabs-list:data-[state=active]:bg-transparent',
  'data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground',
  'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=underline]/tabs-list:data-[state=active]:after:opacity-100',
].join(' ');

const TABS_CONTENT_CLASS = 'flex-1 outline-none';

// --------------------------------------------------------------------------
// Visibility CSS: inactive content is hidden via data-state.
// --------------------------------------------------------------------------

const STYLES = `
ui-tabs-content[data-state="inactive"] { display: none !important; }
`;

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-tabs-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-tabs-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

// --------------------------------------------------------------------------
// <ui-tabs> owns active `value` and `orientation`, broadcasts to children.
// --------------------------------------------------------------------------

export class UiTabs extends WebComponent {
  static properties = {
    value: { type: String, reflect: true },
    orientation: { type: String, reflect: true },
  };
  declare value: string;
  declare orientation: 'horizontal' | 'vertical';

  _userClass: string = '';
  _lastValue: string = '';

  constructor() {
    super();
    this.value = '';
    this.orientation = 'horizontal';
  }

  connectedCallback(): void {
    installStyles();
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'tabs');
  }

  render() {
    this.setAttribute('data-orientation', this.orientation);
    this.className = cn(TABS_BASE, this._userClass);
    queueMicrotask(() => this._syncChildren());
    // Fire value-change event when value mutates after first render.
    if (this._lastValue !== this.value) {
      const prev = this._lastValue;
      this._lastValue = this.value;
      if (prev !== '' || this.value !== '') {
        queueMicrotask(() => {
          this.dispatchEvent(
            new CustomEvent('ui-value-change', { detail: { value: this.value }, bubbles: true }),
          );
        });
      }
    }
    return html`<slot></slot>`;
  }

  _syncChildren(): void {
    const value = this.value;
    const triggers = this.querySelectorAll<HTMLElement>('ui-tabs-trigger');
    triggers.forEach((t) => {
      const active = t.getAttribute('value') === value;
      t.setAttribute('data-state', active ? 'active' : 'inactive');
      t.setAttribute('aria-selected', String(active));
      t.setAttribute('tabindex', active ? '0' : '-1');
    });
    const contents = this.querySelectorAll<HTMLElement>('ui-tabs-content');
    contents.forEach((c) => {
      const active = c.getAttribute('value') === value;
      c.setAttribute('data-state', active ? 'active' : 'inactive');
      c.toggleAttribute('hidden', !active);
    });
  }
}
UiTabs.register('ui-tabs');

// --------------------------------------------------------------------------
// <ui-tabs-list> is the container for triggers. Applies role="tablist".
// --------------------------------------------------------------------------

export class UiTabsList extends WebComponent {
  static properties = {
    variant: { type: String, reflect: true },
  };
  declare variant: TabsListVariant;

  _userClass: string = '';

  constructor() {
    super();
    this.variant = 'default';
  }

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'tabs-list');
    this.setAttribute('role', 'tablist');
  }

  render() {
    this.setAttribute('data-variant', this.variant);
    this.className = cn(tabsListClass({ variant: this.variant }), this._userClass);
    return html`<slot></slot>`;
  }
}
UiTabsList.register('ui-tabs-list');

// --------------------------------------------------------------------------
// <ui-tabs-trigger value="..."> is the tab button. Click + keyboard nav.
// --------------------------------------------------------------------------

export class UiTabsTrigger extends WebComponent {
  static properties = {
    value: { type: String, reflect: true },
  };
  declare value: string;

  _userClass: string = '';

  constructor() {
    super();
    this.value = '';
  }

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'tabs-trigger');
    this.setAttribute('role', 'tab');
    this.setAttribute('tabindex', '-1');
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeyDown);
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeyDown);
    super.disconnectedCallback?.();
  }

  render() {
    this.className = cn(TABS_TRIGGER_CLASS, this._userClass);
    return html`<slot></slot>`;
  }

  get _tabs(): UiTabs | null {
    return this.closest('ui-tabs') as UiTabs | null;
  }

  _onClick = (): void => {
    if (this.value) this._tabs?.setAttribute('value', this.value);
  };

  _onKeyDown = (e: KeyboardEvent): void => {
    const tabs = this._tabs;
    if (!tabs) return;
    const orientation = tabs.getAttribute('orientation') ?? 'horizontal';
    const triggers = Array.from(tabs.querySelectorAll<UiTabsTrigger>('ui-tabs-trigger'));
    const idx = triggers.indexOf(this);
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

    let target: UiTabsTrigger | null = null;
    if (e.key === nextKey) target = triggers[(idx + 1) % triggers.length];
    else if (e.key === prevKey) target = triggers[(idx - 1 + triggers.length) % triggers.length];
    else if (e.key === 'Home') target = triggers[0];
    else if (e.key === 'End') target = triggers[triggers.length - 1];
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._onClick();
      return;
    }

    if (target) {
      e.preventDefault();
      const v = target.getAttribute('value');
      if (v != null) tabs.setAttribute('value', v);
      target.focus();
    }
  };
}
UiTabsTrigger.register('ui-tabs-trigger');

// --------------------------------------------------------------------------
// <ui-tabs-content value="..."> is the panel content. Shown when value matches.
// --------------------------------------------------------------------------

export class UiTabsContent extends WebComponent {
  static properties = {
    value: { type: String, reflect: true },
  };
  declare value: string;

  _userClass: string = '';

  constructor() {
    super();
    this.value = '';
  }

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'tabs-content');
    this.setAttribute('role', 'tabpanel');
    this.setAttribute('tabindex', '0');
  }

  render() {
    this.className = cn(TABS_CONTENT_CLASS, this._userClass);
    return html`<slot></slot>`;
  }
}
UiTabsContent.register('ui-tabs-content');
