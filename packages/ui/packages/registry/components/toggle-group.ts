/**
 * ToggleGroup: group of toggles with single or multiple selection. Stateful
 * because items coordinate active state across the group.
 *
 * shadcn parity:
 *   type:     single | multiple
 *   variant:  default | outline
 *   size:     default | sm | lg
 *   spacing:  0 (joined) | number (gapped)
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
 *   `spacing`: 0 (joined) | number (gap multiplier)
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

  _userClass: string = '';

  constructor() {
    super();
    this.value = '';
    this.type = 'single';
    this.variant = 'default';
    this.size = 'default';
    this.spacing = '0';
    this.orientation = 'horizontal';
  }

  connectedCallback(): void {
    this._userClass = this.getAttribute('class') ?? '';
    // Attach listeners every reconnect: light-DOM slot projection causes
    // a disconnect/reconnect on first mount and firstUpdated runs only
    // once, so listeners would be orphaned by the intermediate
    // disconnectedCallback removeEventListener call.
    this.addEventListener('ui-toggle-item-click', this._onItemClick as EventListener);
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'toggle-group');
    this.setAttribute('role', 'group');
  }

  disconnectedCallback(): void {
    this.removeEventListener('ui-toggle-item-click', this._onItemClick as EventListener);
    super.disconnectedCallback?.();
  }

  get _values(): Set<string> {
    const raw = this.value ?? '';
    return new Set(raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []);
  }

  _setValues(values: Set<string>): void {
    const next = Array.from(values).join(',');
    if (this.type === 'single') {
      this.value = next.split(',')[0] ?? '';
    } else {
      this.value = next;
    }
  }

  render() {
    this.setAttribute('data-variant', this.variant);
    this.setAttribute('data-size', this.size);
    this.setAttribute('data-spacing', this.spacing);
    this.setAttribute('data-orientation', this.orientation);
    const gap = this.spacing === '0' ? '' : 'gap-1';
    this.className = cn(ROOT_BASE, gap, this._userClass);
    // Items live in the DOM via the slot. Run after a frame so the
    // descendant slot projections (each <ui-toggle-group-item> also runs
    // its own first render with captureAuthoredChildren + slot) have
    // settled before we walk them.
    requestAnimationFrame(() => this._updateItems());
    return html`<slot></slot>`;
  }

  _updateItems(): void {
    const values = this._values;
    const items = this.querySelectorAll<HTMLElement>('ui-toggle-group-item');
    items.forEach((item) => {
      const v = item.getAttribute('value');
      const on = !!v && values.has(v);
      item.setAttribute('data-state', on ? 'on' : 'off');
      item.setAttribute('aria-pressed', String(on));
    });
  }

  _onItemClick = (e: CustomEvent): void => {
    const v = e.detail?.value as string | undefined;
    if (!v) return;
    const values = this._values;
    if (this.type === 'single') {
      values.clear();
      values.add(v);
    } else {
      if (values.has(v)) values.delete(v);
      else values.add(v);
    }
    this._setValues(values);
    this.dispatchEvent(
      new CustomEvent('ui-value-change', {
        detail: { value: this.value },
        bubbles: true,
      }),
    );
  };
}
UiToggleGroup.register('ui-toggle-group');

const ITEM_EXTRA =
  'w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10 data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l';

export class UiToggleGroupItem extends WebComponent {
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
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeyDown);
    super.connectedCallback?.();
  }

  firstUpdated(): void {
    this.setAttribute('data-slot', 'toggle-group-item');
    this.setAttribute('role', 'button');
    this.setAttribute('tabindex', '0');
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeyDown);
    super.disconnectedCallback?.();
  }

  get _group(): UiToggleGroup | null {
    return this.closest('ui-toggle-group') as UiToggleGroup | null;
  }

  render() {
    const group = this._group;
    const variant = (group?.getAttribute('variant') ?? 'default') as ToggleVariant;
    const size = (group?.getAttribute('size') ?? 'default') as ToggleSize;
    const spacing = group?.getAttribute('spacing') ?? '0';
    this.setAttribute('data-variant', variant);
    this.setAttribute('data-size', size);
    this.setAttribute('data-spacing', spacing);
    this.className = cn(toggleClass({ variant, size }), ITEM_EXTRA, this._userClass);
    return html`<slot></slot>`;
  }

  _onClick = (): void => {
    const v = this.value;
    if (!v) return;
    this.dispatchEvent(
      new CustomEvent('ui-toggle-item-click', { detail: { value: v }, bubbles: true }),
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
