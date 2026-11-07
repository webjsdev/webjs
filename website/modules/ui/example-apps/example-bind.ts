import { WebComponent, html } from '@webjsdev/core';
import { toast } from '#modules/ui/components/sonner.ts';

/**
 * `<example-bind>` carries the small bits of state the /ui example apps keep
 * in React (#1666). Everything it touches is server markup that already reads
 * right with JavaScript off; the kit elements inside it do the real work (the
 * slider, the command list, the menus, the dialogs). This element only mirrors
 * their events into the text around them, the way shadcn's examples hold a
 * `useState` beside each control.
 *
 * It reads data attributes, so an example opts into a behaviour where it
 * writes the attribute:
 *
 * - `[data-bind-group]` scopes the rest. Inside it, a slider's
 *   `ui-value-change` writes each value into `[data-bind-value="<index>"]`,
 *   formatted with the group's `data-locale` when it has one.
 * - A command item's `ui-select`, or a menu item's `ui-item-select`, inside a
 *   group writes the item's `data-label` (else its text) into
 *   `[data-bind-label]`, marks the chosen item `data-chosen`, and closes the
 *   popover holding it.
 * - A command's `ui-value-change` (the highlight moving) shows the
 *   `[data-peek="<value>"]` panel of its group and hides the others.
 * - `[data-mention]` groups turn a picked command item into its chip
 *   (`[data-chip="<value>"]`) and disable the item; a chip's click undoes it.
 * - A `[data-toggle]` button flips its `aria-pressed` and `data-active`.
 * - A `[data-step]` button adds its step to the `[data-step-input]` of its
 *   group, inside the input's min and max.
 * - A menu item marked `data-keep-open` leaves its menu open when chosen.
 * - A menu item with `data-open="<id>"` opens the dialog with that id, and a
 *   button with `data-toast="<message>"` raises a success toast.
 * - A `<select data-autosubmit>` submits its form on change (its noscript
 *   button does it with JavaScript off).
 */
export class ExampleBind extends WebComponent {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('ui-value-change', this._onValue);
    this.addEventListener('ui-select', this._onSelect);
    this.addEventListener('ui-item-select', this._onItemSelect);
    this.addEventListener('click', this._onClick);
    this.addEventListener('change', this._onChange);
    this.addEventListener('input', this._onInput);
  }

  disconnectedCallback() {
    this.removeEventListener('ui-value-change', this._onValue);
    this.removeEventListener('ui-select', this._onSelect);
    this.removeEventListener('ui-item-select', this._onItemSelect);
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('change', this._onChange);
    this.removeEventListener('input', this._onInput);
    super.disconnectedCallback();
  }

  // The markup is the server's; the element only listens, so it renders its
  // authored children through a slot.
  render() {
    return html`<slot></slot>`;
  }

  _group(el: Element): HTMLElement | null {
    return el.closest<HTMLElement>('[data-bind-group]');
  }

  _onValue = (e: Event): void => {
    const value = (e as CustomEvent<{ value: unknown }>).detail?.value;
    const group = this._group(e.target as Element);
    if (!group) return;
    if (Array.isArray(value)) {
      const locale = group.dataset.locale;
      const format = (n: number) => (locale ? new Intl.NumberFormat(locale).format(n) : String(n));
      value.forEach((n, i) => {
        for (const out of Array.from(group.querySelectorAll<HTMLElement>(`[data-bind-value="${i}"]`))) out.textContent = format(Number(n));
      });
    } else if (typeof value === 'string') {
      const peeks = Array.from(group.querySelectorAll<HTMLElement>('[data-peek]'));
      if (!peeks.some((p) => p.dataset.peek === value)) return;
      for (const p of peeks) p.hidden = p.dataset.peek !== value;
    }
  };

  _choose(item: HTMLElement): void {
    const group = this._group(item);
    if (!group) return;
    if (group.hasAttribute('data-mention')) {
      this._mention(group, item, true);
    } else {
      const label = item.dataset.label ?? item.textContent?.trim() ?? '';
      for (const out of Array.from(group.querySelectorAll<HTMLElement>('[data-bind-label]'))) out.textContent = label;
      for (const other of Array.from(group.querySelectorAll<HTMLElement>('[data-chosen]'))) other.removeAttribute('data-chosen');
      item.setAttribute('data-chosen', '');
    }
    const pop = item.closest<HTMLElement>('[popover]');
    if (pop?.matches(':popover-open')) pop.hidePopover();
  }

  _mention(group: HTMLElement, item: HTMLElement, on: boolean): void {
    const value = item.getAttribute('value') ?? '';
    const chip = group.querySelector<HTMLElement>(`[data-chip="${CSS.escape(value)}"]`);
    if (chip) chip.hidden = !on;
    item.toggleAttribute('disabled', on);
    const any = Array.from(group.querySelectorAll<HTMLElement>('[data-chip]')).some((c) => !c.hidden);
    group.toggleAttribute('data-has-mentions', any);
  }

  _onSelect = (e: Event): void => {
    const item = (e.target as Element).closest<HTMLElement>('ui-command-item');
    if (item && this._group(item)) this._choose(item);
  };

  _onItemSelect = (e: Event): void => {
    // An item holding its own control (a switch) keeps the menu open, as
    // shadcn's onSelect={(e) => e.preventDefault()} does.
    if ((e.target as Element).closest('[data-keep-open]')) {
      e.preventDefault();
      return;
    }
    const item = (e.target as Element).closest<HTMLElement>('[data-open], [data-label]');
    if (!item) return;
    const open = item.dataset.open;
    if (open) {
      const dialog = document.getElementById(open) as (HTMLElement & { show?: () => void }) | null;
      // Wait for the menu to finish closing, so the dialog takes focus last.
      setTimeout(() => dialog?.show?.(), 0);
    } else if (this._group(item)) {
      this._choose(item);
    }
  };

  _onClick = (e: Event): void => {
    const target = e.target as Element;
    const chip = target.closest<HTMLElement>('[data-chip]');
    if (chip && this.contains(chip)) {
      const group = this._group(chip);
      const item = group?.querySelector<HTMLElement>(`ui-command-item[value="${CSS.escape(chip.dataset.chip ?? '')}"]`);
      if (group && item) this._mention(group, item, false);
      return;
    }
    const toaster = target.closest<HTMLElement>('[data-toast]');
    if (toaster && this.contains(toaster)) {
      toast.success(toaster.dataset.toast ?? '');
      return;
    }
    const button = target.closest<HTMLElement>('button');
    if (!button || !this.contains(button)) return;
    if (button.hasAttribute('data-toggle')) {
      const on = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(on));
      button.dataset.active = String(on);
    } else if (button.dataset.step) {
      const group = this._group(button);
      const input = group?.querySelector<HTMLInputElement>('[data-step-input]');
      if (!group || !input) return;
      this._setStep(group, input, Number(input.value) + Number(button.dataset.step));
    }
  };

  _setStep(group: HTMLElement, input: HTMLInputElement, n: number): void {
    const min = Number(input.dataset.min ?? 1);
    const max = Number(input.dataset.max ?? 99);
    const value = Math.max(min, Math.min(max, n));
    input.value = String(value);
    for (const b of Array.from(group.querySelectorAll<HTMLButtonElement>('button[data-step]'))) {
      b.disabled = Number(b.dataset.step) < 0 ? value <= min : value >= max;
    }
  }

  _onInput = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    if (!input.hasAttribute?.('data-step-input')) return;
    const n = parseInt(input.value, 10);
    const group = this._group(input);
    if (group && !Number.isNaN(n)) this._setStep(group, input, n);
  };

  _onChange = (e: Event): void => {
    const select = e.target as HTMLSelectElement;
    if (select.tagName === 'SELECT' && select.hasAttribute('data-autosubmit')) select.form?.requestSubmit();
  };
}

ExampleBind.register('example-bind');
