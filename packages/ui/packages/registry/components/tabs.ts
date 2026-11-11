/**
 * Tabs: sectioned content with keyboard navigation. Tier-2. The parent
 * <ui-tabs> owns `value` + `orientation`; triggers and panels read from
 * it via `closest('ui-tabs')` and re-render when value changes.
 *
 * APG pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
 *
 * shadcn parity:
 *   Tabs           → <ui-tabs value orientation>
 *   TabsList       → <ui-tabs-list variant>
 *   TabsTrigger    → <ui-tabs-trigger value disabled>
 *   TabsContent    → <ui-tabs-content value>
 *
 * Attributes on <ui-tabs>:
 *   `value`:       string (reflected, controlled). Active tab value.
 *   `orientation`: "horizontal" (default) | "vertical".
 *
 * Attributes on <ui-tabs-list>:
 *   `variant`: "default" (default, pill-on-muted) | "line" (shadcn's name;
 *   "underline", the kit's earlier name, is an alias). The list is served
 *   `data-variant="line"` for either, which is what every style keys on.
 *
 * Attributes on <ui-tabs-trigger> / <ui-tabs-content>:
 *   `value`: string. Identifier this trigger / panel pair shares.
 *
 * Attributes on <ui-tabs-trigger>:
 *   `disabled`: boolean (reflected). The rendered `<button>` is disabled, so it
 *   takes the `disabled:` styles and `data-disabled`, a click never selects its
 *   tab, and Arrow / Home / End skip it.
 *
 * Events:
 *   `ui-value-change` on <ui-tabs>: `{ detail: { value } }` after a change.
 *
 * Keyboard (on focused trigger):
 *   ArrowRight / ArrowLeft   next / previous (horizontal)
 *   ArrowDown / ArrowUp      next / previous (vertical)
 *   Home / End               first / last
 *   (a `disabled` trigger is skipped by all four)
 *   Enter / Space            activate (native button activation)
 *
 * A11y (owned by the element, nothing to supply beyond trigger names):
 *   The element wires the whole APG Tabs pattern: the list is a
 *   `role="tablist"` reporting `aria-orientation`, each trigger is a
 *   `role="tab"` cross-linked to its panel with `aria-controls` while the panel
 *   points back with `aria-labelledby`, ids stay unique across groups on one
 *   page, and an inactive panel is both `hidden` and `inert`. Arrow / Home / End
 *   move focus AND selection (APG automatic activation) via a roving tabindex,
 *   so the tablist is a single Tab stop and nav stays inside its own group when
 *   tabs are nested. Do not hand-add any of these; the element already has.
 *   What you DO supply: a name for each trigger. A trigger's name comes from its
 *   own content, so an icon-only tab needs an `aria-label` on the
 *   `<ui-tabs-trigger>` and an `aria-hidden="true"` icon inside it.
 *   Keep the panel's content after the tablist in the DOM, which the example
 *   shape already does, so reading order follows the tab that was activated.
 *
 * Design tokens used: --muted, --muted-foreground, --foreground, --background,
 * --input, --ring.
 *
 * @example
 * ```html
 * <ui-tabs value="account">
 *   <ui-tabs-list>
 *     <ui-tabs-trigger value="account">Account</ui-tabs-trigger>
 *     <ui-tabs-trigger value="password">Password</ui-tabs-trigger>
 *   </ui-tabs-list>
 *   <ui-tabs-content value="account">
 *     <p class="text-sm">Update your name and email here.</p>
 *   </ui-tabs-content>
 *   <ui-tabs-content value="password">
 *     <p class="text-sm">Change your password here.</p>
 *   </ui-tabs-content>
 * </ui-tabs>
 * ```
 */
import { WebComponent, html, prop } from '@webjsdev/core';
import { cn, ensureId, takeAuthoredClass } from '../lib/utils.ts';

// A tab `value` becomes part of an id, so reduce it to id-safe characters.
const idSafe = (s: string): string => s.replace(/[^A-Za-z0-9_-]/g, '-');

// --------------------------------------------------------------------------
// Class helpers
// --------------------------------------------------------------------------

const TABS_BASE = 'cn-tabs group/tabs flex';

const TABS_LIST_BASE =
  'cn-tabs-list group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground';

const TABS_LIST_VARIANTS = {
  default: 'cn-tabs-list-variant-default bg-muted',
  line: 'cn-tabs-list-variant-line gap-1 bg-transparent',
} as const;

/** The list's look: `line` is shadcn's name, and `underline` an alias for it. */
export type TabsListVariant = keyof typeof TABS_LIST_VARIANTS | 'underline';

/** The variant every style keys on, with `underline` read as `line`. */
export function tabsListVariant(variant: TabsListVariant | string | null | undefined): keyof typeof TABS_LIST_VARIANTS {
  return variant === 'line' || variant === 'underline' ? 'line' : 'default';
}

/** Optional helper exposing the tabs-list class for advanced overrides. */
export function tabsListClass(opts: { variant?: TabsListVariant } & { className?: string } = {}): string {
  if (opts.className) return cn(tabsListClass({ ...opts, className: undefined }), opts.className);
  return cn(TABS_LIST_BASE, TABS_LIST_VARIANTS[tabsListVariant(opts.variant)]);
}

/**
 * shadcn's name for {@link tabsListClass}, so shadcn code ports verbatim
 * (`tabsListVariants({ ... })` is shadcn's `cva` export for `TabsList`). Like cva, it
 * merges a `className` into the result.
 */
export function tabsListVariants(opts: { variant?: TabsListVariant } & { className?: string } = {}): string {
  return tabsListClass(opts);
}

// The trigger is rendered as a native <button role="tab">, which gives
// us cursor-pointer + Enter/Space activation + focus for free. The class
// here is essentially shadcn's tabs.tsx trigger output.
const TABS_TRIGGER_CLASS = [
  'cn-tabs-trigger relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
  // These mirror shadcn's tabs.tsx.
  // Light-mode active state uses bg-background + shadow only; dark mode
  // additionally borders. Adding light-mode border made the underline
  // variant look like outline and made default look like two buttons.
  // shadcn keeps all three inline in every style; the part names carry the
  // new-york spelling of the same rules.
  'cn-tabs-trigger-part-2 group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent',
  'cn-tabs-trigger-part-3 data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground',
  'cn-tabs-trigger-part-4 after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-end-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100',
].join(' ');

const TABS_CONTENT_CLASS = 'cn-tabs-content flex-1 outline-none';

/**
 * The class an author wrote on a tabs part, as shadcn's `className`: it
 * belongs on the element the part RENDERS (the tablist, the tab button, the
 * panel), which is what shadcn's styles and an author's utilities target. It
 * is read once from the host, before the part re-renders, and the host then
 * carries `hostClass` instead (or nothing).
 */
function takeAuthored(part: HTMLElement, hostClass: string | null): string | null {
  return takeAuthoredClass(part, hostClass);
}

// --------------------------------------------------------------------------
// <ui-tabs> owns active `value` + `orientation`. Children read its state
// via closest('ui-tabs'); when value changes, the parent fires a
// `tabs-value-change-internal` event that descendants listen for via
// the bubbling event on their own host. Each descendant then calls
// requestUpdate() to re-render against the new parent value.
// --------------------------------------------------------------------------

export class UiTabs extends WebComponent({
  value: prop(String, { reflect: true }),
  orientation: prop<'horizontal' | 'vertical'>(String, { reflect: true }),
}) {
  constructor() {
    super();
    this.value = '';
    this.orientation = 'horizontal';
  }

  // Assign the scope id BEFORE render so it is serialized onto this host's
  // opening tag at SSR (willUpdate now runs server-side). Without this, the id
  // was minted lazily during a CHILD trigger's render, AFTER this host's tag
  // was already serialized without an id, so the host shipped no id; on
  // hydration the client re-minted a DIFFERENT counter id and the trigger /
  // panel ids mismatched SSR vs client, breaking hydration (#730).
  willUpdate(): void {
    ensureId(this, 'ui-tabs');
  }

  // Stable per-instance scope so a trigger and its panel agree on the
  // shared id stem (`<scope>-trigger-<value>` / `<scope>-panel-<value>`)
  // even when several tab sets reuse the same `value` names on one page.
  get scopeId(): string {
    return ensureId(this, 'ui-tabs');
  }

  // Builds the trigger / panel id pair a child derives from its `value`.
  idsFor(value: string): { trigger: string; panel: string } {
    const v = idSafe(value);
    return { trigger: `${this.scopeId}-trigger-${v}`, panel: `${this.scopeId}-panel-${v}` };
  }


  render() {
    const authored = takeAuthored(this, null);
    return html`<div
      data-slot="tabs"
      data-orientation=${this.orientation}
      class=${cn(TABS_BASE, authored)}
    ><slot></slot></div>`;
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (!changedProperties.has('value')) return;
    const prev = (changedProperties.get('value') ?? '') as string;
    // Skip the initial undefined -> '' (or '' -> '') no-op set; only
    // dispatch + broadcast on real value transitions.
    if (prev === '' && this.value === '') return;
    queueMicrotask(() => {
      this.dispatchEvent(
        new CustomEvent('ui-value-change', { detail: { value: this.value }, bubbles: true }),
      );
      this._broadcast();
    });
  }

  _broadcast(): void {
    this.querySelectorAll<WebComponent>(
      'ui-tabs-list, ui-tabs-trigger, ui-tabs-content',
    ).forEach((el) => el.requestUpdate?.());
  }
}
UiTabs.register('ui-tabs');

// --------------------------------------------------------------------------
// <ui-tabs-list>
// --------------------------------------------------------------------------

export class UiTabsList extends WebComponent({
  variant: prop<TabsListVariant>(String, { reflect: true }),
}) {
  constructor() {
    super();
    this.variant = 'default';
  }

  get _tabs(): UiTabs | null {
    if (typeof this.closest !== 'function') return null;
    return this.closest('ui-tabs') as UiTabs | null;
  }


  render() {
    const authored = takeAuthored(this, 'contents');
    const orientation = this._tabs?.orientation ?? 'horizontal';
    return html`<div
      data-slot="tabs-list"
      role="tablist"
      aria-orientation=${orientation}
      data-variant=${tabsListVariant(this.variant)}
      class=${cn(tabsListClass({ variant: this.variant }), authored)}
    ><slot></slot></div>`;
  }
}
UiTabsList.register('ui-tabs-list');

// --------------------------------------------------------------------------
// <ui-tabs-trigger value="...">
// --------------------------------------------------------------------------

export class UiTabsTrigger extends WebComponent({
  value: prop(String, { reflect: true }),
  disabled: prop(Boolean, { reflect: true }),
}) {
  constructor() {
    super();
    this.value = '';
    this.disabled = false;
  }

  // render() runs server-side too. webjs resolves closest() at SSR against
  // the enclosing-element ancestor chain, so the active tab is marked in the
  // first paint (no hydration flash). The typeof guard stays defensive.
  get _tabs(): UiTabs | null {
    if (typeof this.closest !== 'function') return null;
    return this.closest('ui-tabs') as UiTabs | null;
  }


  render() {
    const authored = takeAuthored(this, 'contents');
    const tabs = this._tabs;
    const active = !!tabs && tabs.value === this.value && this.value !== '';
    const ids = tabs && this.value ? tabs.idsFor(this.value) : null;
    return html`<button
      type="button"
      role="tab"
      data-slot="tabs-trigger"
      id=${ids ? ids.trigger : ''}
      aria-controls=${ids ? ids.panel : ''}
      data-state=${active ? 'active' : 'inactive'}
      aria-selected=${String(active)}
      tabindex=${active ? '0' : '-1'}
      ?disabled=${this.disabled}
      ?data-disabled=${this.disabled}
      class=${cn(TABS_TRIGGER_CLASS, authored)}
      @click=${this._onClick}
      @keydown=${this._onKeyDown}
    ><slot></slot></button>`;
  }

  _onClick = (): void => {
    if (this.value && !this.disabled) this._tabs?.setAttribute('value', this.value);
  };

  _onKeyDown = (e: KeyboardEvent): void => {
    const tabs = this._tabs;
    if (!tabs) return;
    const orientation = tabs.orientation;
    // Scope to triggers belonging to THIS group: querySelectorAll crosses into
    // a nested <ui-tabs> inside a panel, and arrow nav at the boundary would
    // jump into the inner group and set this group's value to an inner-only
    // value (hiding every panel). Same scoping dropdown-menu applies to items.
    // A disabled trigger is skipped by every key, as Radix's roving focus
    // skips an item that is not focusable.
    const triggers = Array.from(tabs.querySelectorAll<UiTabsTrigger>('ui-tabs-trigger')).filter(
      (t) => t._tabs === tabs && (!t.disabled || t === this),
    );
    const idx = triggers.indexOf(this);
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

    let target: UiTabsTrigger | null = null;
    if (e.key === nextKey) target = triggers[(idx + 1) % triggers.length] ?? null;
    else if (e.key === prevKey) target = triggers[(idx - 1 + triggers.length) % triggers.length] ?? null;
    else if (e.key === 'Home') target = triggers.find((t) => !t.disabled) ?? null;
    else if (e.key === 'End') target = [...triggers].reverse().find((t) => !t.disabled) ?? null;
    // Enter/Space already handled natively by <button>; no preventDefault needed.

    if (target) {
      e.preventDefault();
      const v = target.value;
      if (v) tabs.setAttribute('value', v);
      // Focus the inner <button role="tab">, NOT the <ui-tabs-trigger> host.
      // The host carries no tabindex so it is not focusable; calling focus()
      // on it is a no-op that leaves the focus ring stranded on the previous
      // trigger while a different panel shows. The roving tabindex lives on
      // the inner button, so that is what APG focus-follows-selection targets.
      const btn = target.querySelector<HTMLButtonElement>('[role="tab"]');
      (btn ?? target).focus();
    }
  };
}
UiTabsTrigger.register('ui-tabs-trigger');

// --------------------------------------------------------------------------
// <ui-tabs-content value="...">
// --------------------------------------------------------------------------

export class UiTabsContent extends WebComponent({
  value: prop(String, { reflect: true }),
}) {
  constructor() {
    super();
    this.value = '';
  }

  get _tabs(): UiTabs | null {
    if (typeof this.closest !== 'function') return null;
    return this.closest('ui-tabs') as UiTabs | null;
  }


  render() {
    // The panel's host keeps no class of its own (it toggles `hidden`, which a
    // `display` utility would override), so the authored class moves whole.
    const authored = takeAuthored(this, null);
    const tabs = this._tabs;
    const active = !!tabs && tabs.value === this.value && this.value !== '';
    const ids = tabs && this.value ? tabs.idsFor(this.value) : null;
    // The host needs to be hidden when inactive so its rendered <section>
    // is removed from layout (light DOM has no :host CSS to scope this).
    // Use the native `hidden` IDL property rather than imperative
    // setAttribute, so it reads as a property assignment. `inert` on the
    // host additionally pulls an inactive panel (and anything focusable
    // inside it) out of the tab order and the accessibility tree.
    this.hidden = !active;
    this.inert = !active;
    return html`<section
      data-slot="tabs-content"
      role="tabpanel"
      id=${ids ? ids.panel : ''}
      aria-labelledby=${ids ? ids.trigger : ''}
      tabindex="0"
      data-state=${active ? 'active' : 'inactive'}
      class=${cn(TABS_CONTENT_CLASS, authored)}
    ><slot></slot></section>`;
  }
}
UiTabsContent.register('ui-tabs-content');
