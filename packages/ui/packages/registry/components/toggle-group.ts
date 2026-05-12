/**
 * ToggleGroup — group of toggles with single or multiple selection. Stateful
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
 *   `type`     — "single" | "multiple"
 *   `value`    — current selected value(s). Single: string. Multiple: comma-separated.
 *   `variant`  — "default" | "outline"
 *   `size`     — "default" | "sm" | "lg"
 *   `spacing`  — 0 (joined) | number (gap multiplier)
 *
 * Events:
 *   `ui-value-change` — { detail: { value } } when selection changes.
 *
 * Design tokens used: inherited from toggleClass.
 */
import { cn, Base, defineElement } from '../lib/utils.ts';
import { toggleClass, type ToggleVariant, type ToggleSize } from './toggle.ts';

const ROOT_BASE =
  'group/toggle-group flex w-fit items-center rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs';

export class UiToggleGroup extends Base {
  static get observedAttributes(): string[] {
    return ['value', 'variant', 'size', 'spacing', 'type'];
  }

  connectedCallback(): void {
    this.setAttribute('data-slot', 'toggle-group');
    if (!this.hasAttribute('type')) this.setAttribute('type', 'single');
    if (!this.hasAttribute('variant')) this.setAttribute('variant', 'default');
    if (!this.hasAttribute('size')) this.setAttribute('size', 'default');
    if (!this.hasAttribute('spacing')) this.setAttribute('spacing', '0');
    this.setAttribute('role', 'group');
    this._applyClass();
    this._reflect();
    this.addEventListener('ui-toggle-item-click', this._onItemClick as EventListener);
  }
  disconnectedCallback(): void {
    this.removeEventListener('ui-toggle-item-click', this._onItemClick as EventListener);
  }

  attributeChangedCallback(): void {
    this._applyClass();
    this._reflect();
  }

  private get _type(): 'single' | 'multiple' {
    return (this.getAttribute('type') as 'single' | 'multiple') ?? 'single';
  }

  private get _values(): Set<string> {
    const raw = this.getAttribute('value') ?? '';
    return new Set(raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []);
  }

  private _setValues(values: Set<string>): void {
    const next = Array.from(values).join(',');
    if (this._type === 'single') {
      this.setAttribute('value', next.split(',')[0] ?? '');
    } else {
      this.setAttribute('value', next);
    }
  }

  private _applyClass(): void {
    const userClass = this.getAttribute('class') ?? '';
    const spacing = this.getAttribute('spacing') ?? '0';
    this.setAttribute('data-variant', this.getAttribute('variant') ?? 'default');
    this.setAttribute('data-size', this.getAttribute('size') ?? 'default');
    this.setAttribute('data-spacing', spacing);
    const gap = spacing === '0' ? '' : 'gap-1';
    this.className = cn(ROOT_BASE, gap, userClass);
  }

  private _reflect(): void {
    const values = this._values;
    const items = this.querySelectorAll<HTMLElement>('ui-toggle-group-item');
    items.forEach((item) => {
      const v = item.getAttribute('value');
      const on = !!v && values.has(v);
      item.setAttribute('data-state', on ? 'on' : 'off');
      item.setAttribute('aria-pressed', String(on));
    });
  }

  private _onItemClick = (e: CustomEvent): void => {
    const v = e.detail?.value as string | undefined;
    if (!v) return;
    const values = this._values;
    if (this._type === 'single') {
      values.clear();
      values.add(v);
    } else {
      if (values.has(v)) values.delete(v);
      else values.add(v);
    }
    this._setValues(values);
    this.dispatchEvent(
      new CustomEvent('ui-value-change', {
        detail: { value: this.getAttribute('value') ?? '' },
        bubbles: true,
      }),
    );
  };
}
defineElement('ui-toggle-group', UiToggleGroup);

const ITEM_EXTRA =
  'w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10 data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l';

export class UiToggleGroupItem extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'toggle-group-item');
    this.setAttribute('role', 'button');
    this.setAttribute('tabindex', '0');
    this._applyClass();
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeyDown);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeyDown);
  }
  private get _group(): UiToggleGroup | null {
    return this.closest('ui-toggle-group') as UiToggleGroup | null;
  }
  private _applyClass(): void {
    const userClass = this.getAttribute('class') ?? '';
    const group = this._group;
    const variant = (group?.getAttribute('variant') ?? 'default') as ToggleVariant;
    const size = (group?.getAttribute('size') ?? 'default') as ToggleSize;
    this.setAttribute('data-variant', variant);
    this.setAttribute('data-size', size);
    this.setAttribute('data-spacing', group?.getAttribute('spacing') ?? '0');
    this.className = cn(toggleClass({ variant, size }), ITEM_EXTRA, userClass);
  }
  private _onClick = (): void => {
    const v = this.getAttribute('value');
    if (!v) return;
    this.dispatchEvent(
      new CustomEvent('ui-toggle-item-click', { detail: { value: v }, bubbles: true }),
    );
  };
  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this._onClick();
    }
  };
}
defineElement('ui-toggle-group-item', UiToggleGroupItem);
