/**
 * ToggleGroup: group of toggles with single- or multiple-selection.
 * Tier-2; items coordinate active state across the group, so this is
 * a custom element (not a class helper). Items are styled via
 * `toggleClass()` from `./toggle.ts` so the visual matches a single
 * toggle exactly.
 *
 * shadcn parity:
 *   ToggleGroup (type: single | multiple)
 *               (variant: default | outline)
 *               (size:    default | sm | lg)
 *                                 → <ui-toggle-group type variant size value>
 *   ToggleGroupItem               → <ui-toggle-group-item value>
 *
 * Usage:
 *   <ui-toggle-group type="single" value="bold">
 *     <ui-toggle-group-item value="bold" aria-label="Bold"><b>B</b></ui-toggle-group-item>
 *     <ui-toggle-group-item value="italic" aria-label="Italic"><i>I</i></ui-toggle-group-item>
 *     <ui-toggle-group-item value="underline" aria-label="Underline"><u>U</u></ui-toggle-group-item>
 *   </ui-toggle-group>
 *
 *   <!-- Multiple selection (comma-separated value): -->
 *   <ui-toggle-group type="multiple" value="bold,italic">
 *     <ui-toggle-group-item value="bold">B</ui-toggle-group-item>
 *     <ui-toggle-group-item value="italic">I</ui-toggle-group-item>
 *   </ui-toggle-group>
 *
 * Attributes on <ui-toggle-group>:
 *   `type`:        "single" (default) | "multiple".
 *   `value`:       string. Selected value(s). Single: a single value;
 *                  multiple: comma-separated values.
 *   `variant`:     "default" (default) | "outline".
 *   `size`:        "default" (default) | "sm" | "lg".
 *   `spacing`:     "0" (default, joined corners) | "default" (gapped).
 *   `orientation`: "horizontal" (default) | "vertical".
 *
 * Attributes on <ui-toggle-group-item>:
 *   `value`:   string. Identifier this item contributes when selected.
 *   `pressed`: boolean (reflected). Mirrors the group's selection for this item.
 *
 * Events:
 *   `ui-value-change` on <ui-toggle-group>: `{ detail: { value } }` after selection changes.
 *
 * Keyboard: Arrow keys move focus between items (roving tabindex, so the
 * group is a single Tab stop), Home / End jump to the first / last item, and
 * Enter / Space toggles the focused item.
 *
 * Design tokens used: inherited from toggleClass (--muted, --accent, --ring,
 * --input, --destructive).
 */
import { WebComponent, html, prop } from '@webjsdev/core';
import { cn } from '../lib/utils.ts';
import { toggleClass, type ToggleVariant, type ToggleSize } from './toggle.ts';

const ROOT_BASE =
  'group/toggle-group flex w-fit items-center rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch';

const ITEM_EXTRA =
  'w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10 data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l';

// --------------------------------------------------------------------------
// <ui-toggle-group>
// Renders a wrapping <div role="group"> with the @ui-toggle-item-click
// listener bound declaratively. Children project through the slot. Item
// state (data-state, aria-pressed) is reflected from updated() so the
// effect runs after the host's commit. A queueMicrotask defer inside
// gives the descendant <ui-toggle-group-item> components time to commit
// their own renders before we read / write their state.
// --------------------------------------------------------------------------

export class UiToggleGroup extends WebComponent({
  value: prop(String, { reflect: true }),
  type: prop<'single' | 'multiple'>(String, { reflect: true }),
  variant: prop<ToggleVariant>(String, { reflect: true }),
  size: prop<ToggleSize>(String, { reflect: true }),
  spacing: prop(String, { reflect: true }),
  orientation: prop<'horizontal' | 'vertical'>(String, { reflect: true }),
}) {
  constructor() {
    super();
    this.value = '';
    this.type = 'single';
    this.variant = 'default';
    this.size = 'default';
    this.spacing = '0';
    this.orientation = 'horizontal';
  }

  get _values(): Set<string> {
    const raw = this.value ?? '';
    return new Set(raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []);
  }

  render() {
    const gap = this.spacing === '0' ? '' : 'gap-1';
    return html`<div
      data-slot="toggle-group"
      role="group"
      class=${cn(ROOT_BASE, gap)}
      data-variant=${this.variant}
      data-size=${this.size}
      data-spacing=${this.spacing}
      data-orientation=${this.orientation}
      @ui-toggle-item-click=${this._onItemClick}
    ><slot></slot></div>`;
  }

  updated(): void {
    // Reflect group state onto each <ui-toggle-group-item>. One microtask
    // gives the items time to commit their own renders first.
    queueMicrotask(() => this._reflectItems());
  }

  _items(): UiToggleGroupItem[] {
    return Array.from(this.querySelectorAll<UiToggleGroupItem>('ui-toggle-group-item'));
  }

  _reflectItems(): void {
    const values = this._values;
    const items = this._items();
    const current = items.find((el) => el.tabIndex === 0);
    items.forEach((item) => {
      const on = !!item.value && values.has(item.value);
      // Reflect both on the host (for CSS sibling selectors like
      // data-[spacing=0]:first:rounded-l-md that need to target the host
      // as a sibling of other items) and as a reactive prop so the
      // item's render() refreshes its inner styling.
      item.pressed = on;
    });
    this._roving(items, current);
  }

  // Roving tabindex (APG): exactly one item is in the tab order. Prefer the
  // currently-focused item, then whichever was tabbable, then the first
  // selected item, then the first item. Arrow keys move focus and shift the
  // single tabbable slot via `focusItem`.
  _roving(items: UiToggleGroupItem[], current?: UiToggleGroupItem): void {
    if (!items.length) return;
    const values = this._values;
    const active =
      typeof document !== 'undefined' ? (document.activeElement as Element | null) : null;
    const focused = active ? items.find((i) => i === active) : undefined;
    const selected = items.find((i) => !!i.value && values.has(i.value));
    const tabbable = focused ?? current ?? selected ?? items[0];
    items.forEach((item) => {
      item.tabIndex = item === tabbable ? 0 : -1;
    });
  }

  focusItem(item: UiToggleGroupItem): void {
    this._items().forEach((el) => {
      el.tabIndex = el === item ? 0 : -1;
    });
    item.focus();
  }

  _onItemClick = (e: Event): void => {
    const v = (e as CustomEvent).detail?.value as string | undefined;
    if (!v) return;
    const values = this._values;
    if (this.type === 'single') {
      values.clear();
      values.add(v);
    } else if (values.has(v)) {
      values.delete(v);
    } else {
      values.add(v);
    }
    const next = Array.from(values).join(',');
    this.value = this.type === 'single' ? (next.split(',')[0] ?? '') : next;
    this.dispatchEvent(
      new CustomEvent('ui-value-change', { detail: { value: this.value }, bubbles: true }),
    );
  };
}
UiToggleGroup.register('ui-toggle-group');

// --------------------------------------------------------------------------
// <ui-toggle-group-item>
// Renders a native <button> styled via toggleClass; emits a bubbling
// `ui-toggle-item-click` event with detail.value so the group can
// coordinate selection. Variant / size / spacing read from the group
// at render time (data-* attributes on the host carry them for
// Tailwind variant selectors on the joined-spacing rounded corners).
// --------------------------------------------------------------------------

export class UiToggleGroupItem extends WebComponent({
  value: prop(String, { reflect: true }),
  pressed: prop(Boolean, { reflect: true }),
}) {
  constructor() {
    super();
    this.value = '';
    this.pressed = false;
  }

  // render() runs server-side too. webjs resolves closest() at SSR against
  // the enclosing-element ancestor chain, so the pressed item is marked in
  // the first paint (no hydration flash). The typeof guard stays defensive.
  get _group(): UiToggleGroup | null {
    if (typeof this.closest !== 'function') return null;
    return this.closest('ui-toggle-group') as UiToggleGroup | null;
  }

  // Compound-component caveat: the host element carries the visual
  // class + data-* attributes (not an inner <button>) so CSS sibling
  // selectors like `data-[spacing=0]:first:rounded-l-md` match it as
  // a sibling of other items in the group. Light DOM has no :host CSS
  // and no way to bind host attributes from a render() template, so
  // ARIA + static markup attributes go in connectedCallback (set once)
  // and the parent-derived data-* + class string get refreshed in
  // render(). Click + keyboard listeners live on the host because the
  // click target IS the host (the styled element under the cursor).
  connectedCallback(): void {
    this.dataset.slot = 'toggle-group-item';
    this.role = 'button';
    // Roving tabindex: start outside the tab order. The group promotes
    // exactly one item to tabindex 0 in _reflectItems (runs after first
    // render); Arrow keys move focus and the tabbable slot from there.
    this.tabIndex = -1;
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeyDown);
    super.connectedCallback?.();
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeyDown);
    super.disconnectedCallback?.();
  }

  render() {
    const group = this._group;
    const variant = (group?.variant ?? 'default') as ToggleVariant;
    const size = (group?.size ?? 'default') as ToggleSize;
    const spacing = group?.spacing ?? '0';
    this.dataset.variant = variant;
    this.dataset.size = size;
    this.dataset.spacing = spacing;
    this.dataset.state = this.pressed ? 'on' : 'off';
    this.ariaPressed = String(this.pressed);
    this.className = cn(toggleClass({ variant, size }), ITEM_EXTRA);
    return html`<slot></slot>`;
  }

  _onClick = (): void => {
    if (!this.value) return;
    this.dispatchEvent(
      new CustomEvent('ui-toggle-item-click', { detail: { value: this.value }, bubbles: true }),
    );
  };

  _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this._onClick();
      return;
    }
    const group = this._group;
    if (!group) return;
    const horizontal = group.orientation !== 'vertical';
    const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
    const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const items = group._items();
    const idx = items.indexOf(this);
    if (idx === -1) return;
    let target: UiToggleGroupItem | null = null;
    if (e.key === nextKey) target = items[(idx + 1) % items.length] ?? null;
    else if (e.key === prevKey) target = items[(idx - 1 + items.length) % items.length] ?? null;
    else if (e.key === 'Home') target = items[0] ?? null;
    else if (e.key === 'End') target = items[items.length - 1] ?? null;
    if (target) {
      e.preventDefault();
      group.focusItem(target);
    }
  };
}
UiToggleGroupItem.register('ui-toggle-group-item');
