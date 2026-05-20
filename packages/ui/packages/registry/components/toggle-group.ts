/**
 * ToggleGroup: group of toggles with single or multiple selection. Stateful
 * because items coordinate active state across the group.
 *
 * shadcn parity:
 *   type:     single | multiple
 *   variant:  default | outline
 *   size:     default | sm | lg
 *   spacing:  0 (joined) | default (gapped)
 *
 * Usage:
 *   <ui-toggle-group type="single" value="bold">
 *     <ui-toggle-group-item value="bold" aria-label="Bold"><b>B</b></ui-toggle-group-item>
 *     <ui-toggle-group-item value="italic" aria-label="Italic"><i>I</i></ui-toggle-group-item>
 *     <ui-toggle-group-item value="underline" aria-label="Underline"><u>U</u></ui-toggle-group-item>
 *   </ui-toggle-group>
 *
 *   <!-- Multiple selection: -->
 *   <ui-toggle-group type="multiple" value="bold,italic">
 *     <ui-toggle-group-item value="bold">B</ui-toggle-group-item>
 *     <ui-toggle-group-item value="italic">I</ui-toggle-group-item>
 *   </ui-toggle-group>
 *
 * Attributes on `<ui-toggle-group>`:
 *   `type`:    "single" | "multiple"
 *   `value`:   current selected value(s). Single: string. Multiple: comma-separated.
 *   `variant`: "default" | "outline"
 *   `size`:    "default" | "sm" | "lg"
 *   `spacing`: 0 (joined) | "default" (gapped)
 *
 * Events:
 *   `ui-value-change`: { detail: { value } } when selection changes.
 *
 * Design tokens used: inherited from toggleClass.
 */
import { WebComponent, html } from '@webjskit/core';
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
// state (data-state, aria-pressed) is reflected after each render via
// a single requestAnimationFrame deferral to give the descendant
// <ui-toggle-group-item> components time to settle their own renders.
// --------------------------------------------------------------------------

export class UiToggleGroup extends WebComponent {
  static properties = {
    value: { type: String, reflect: true },
    type: { type: String, reflect: true },
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
    spacing: { type: String, reflect: true },
    orientation: { type: String, reflect: true },
  };
  declare value: string;
  declare type: 'single' | 'multiple';
  declare variant: ToggleVariant;
  declare size: ToggleSize;
  declare spacing: string;
  declare orientation: 'horizontal' | 'vertical';

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
    // Items live under <slot>, but their state needs to be reflected
    // after they have finished their own first render. One frame is
    // enough; this is the same RAF-defer pattern used by tabs.
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => this._reflectItems());
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

  _reflectItems(): void {
    const values = this._values;
    this.querySelectorAll<UiToggleGroupItem>('ui-toggle-group-item').forEach((item) => {
      const on = !!item.value && values.has(item.value);
      // Reflect both on the host (for CSS sibling selectors like
      // data-[spacing=0]:first:rounded-l-md that need to target the host
      // as a sibling of other items) and as a reactive prop so the
      // item's render() refreshes its inner styling.
      item.pressed = on;
    });
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

export class UiToggleGroupItem extends WebComponent {
  static properties = {
    value: { type: String, reflect: true },
    pressed: { type: Boolean, reflect: true },
  };
  declare value: string;
  declare pressed: boolean;

  constructor() {
    super();
    this.value = '';
    this.pressed = false;
  }

  // render() runs server-side too. linkedom doesn't implement closest()
  // on custom elements, so guard it; the client re-renders with the
  // real parent reference after hydration.
  get _group(): UiToggleGroup | null {
    if (typeof this.closest !== 'function') return null;
    return this.closest('ui-toggle-group') as UiToggleGroup | null;
  }

  // Compound-component caveat: the host element carries the visual
  // class + data-* attributes (not an inner <button>) so CSS sibling
  // selectors like `data-[spacing=0]:first:rounded-l-md` match it as
  // a sibling of other items in the group. Click + keyboard listeners
  // also live on the host (not on an inner element) because the
  // click target IS the host: the styled element under the cursor.
  connectedCallback(): void {
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
    this.setAttribute('data-slot', 'toggle-group-item');
    this.setAttribute('role', 'button');
    this.setAttribute('tabindex', '0');
    this.setAttribute('data-variant', variant);
    this.setAttribute('data-size', size);
    this.setAttribute('data-spacing', spacing);
    this.setAttribute('data-state', this.pressed ? 'on' : 'off');
    this.setAttribute('aria-pressed', String(this.pressed));
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
    }
  };
}
UiToggleGroupItem.register('ui-toggle-group-item');
