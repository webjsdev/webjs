import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Accordion. Composition:
 *
 *   <ui-accordion type="single" value="item-1">
 *     <ui-accordion-item value="item-1">
 *       <ui-accordion-trigger>Section 1</ui-accordion-trigger>
 *       <ui-accordion-content>Body</ui-accordion-content>
 *     </ui-accordion-item>
 *   </ui-accordion>
 *
 * In `multiple` mode `value` is a comma-separated list.
 */
export class UiAccordion extends WebComponent {
  static properties = {
    type: { type: String, reflect: true },
    value: { type: String, reflect: true },
    collapsible: { type: Boolean, reflect: true },
  };
  declare type: 'single' | 'multiple';
  declare value: string;
  declare collapsible: boolean;

  private _slot = '';

  constructor() {
    super();
    this.type = 'single';
    this.value = '';
    this.collapsible = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('ui-accordion-toggle', this._onToggle as EventListener);
    queueMicrotask(() => this._syncChildren());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-accordion-toggle', this._onToggle as EventListener);
  }

  _onToggle = (e: CustomEvent) => {
    const v = e.detail?.value as string | undefined;
    if (!v) return;
    if (this.type === 'multiple') {
      const set = new Set((this.value || '').split(',').filter(Boolean));
      if (set.has(v)) set.delete(v);
      else set.add(v);
      this.value = Array.from(set).join(',');
    } else {
      if (this.value === v) {
        if (this.collapsible) this.value = '';
      } else {
        this.value = v;
      }
    }
    this._syncChildren();
    this.dispatchEvent(new CustomEvent('change', { detail: { value: this.value }, bubbles: true, composed: true }));
  };

  _syncChildren() {
    this.querySelectorAll('ui-accordion-item').forEach((el) => {
      (el as HTMLElement).setAttribute('data-group-value', this.value || '');
      (el as HTMLElement).setAttribute('data-group-type', this.type);
    });
  }

  static get observedAttributes() {
    return ['value', 'type'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    this._syncChildren();
  }

  render() {
    return html`<div data-slot="accordion">${unsafeHTML(this._slot)}</div>`;
  }
}
UiAccordion.register('ui-accordion');

export class UiAccordionItem extends WebComponent {
  static properties = {
    value: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
  };
  declare value: string;
  declare disabled: boolean;

  private _slot = '';

  constructor() {
    super();
    this.value = '';
    this.disabled = false;
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    queueMicrotask(() => this._syncChildren());
  }

  static get observedAttributes() {
    return ['data-group-value', 'data-group-type', 'value', 'disabled'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    if (name.startsWith('data-group-')) {
      this._syncChildren();
      this.requestUpdate();
    }
  }

  private get _open(): boolean {
    if (!this.value) return false;
    const gv = this.getAttribute('data-group-value') || '';
    const type = this.getAttribute('data-group-type') || 'single';
    if (type === 'multiple') return gv.split(',').includes(this.value);
    return gv === this.value;
  }

  _syncChildren() {
    const state = this._open ? 'open' : 'closed';
    this.querySelectorAll(':scope > ui-accordion-trigger, :scope > ui-accordion-content').forEach((el) => {
      (el as HTMLElement).setAttribute('data-state', state);
      (el as HTMLElement).setAttribute('data-item-value', this.value);
    });
  }

  render() {
    const state = this._open ? 'open' : 'closed';
    return html`<div
      data-slot="accordion-item"
      data-state=${state}
      class=${cn('border-b last:border-b-0')}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiAccordionItem.register('ui-accordion-item');

export class UiAccordionTrigger extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this._onClick);
  }
  _onClick = () => {
    const value = this.getAttribute('data-item-value') || this.closest('ui-accordion-item')?.getAttribute('value') || '';
    if (!value) return;
    this.dispatchEvent(new CustomEvent('ui-accordion-toggle', { detail: { value }, bubbles: true }));
  };
  static get observedAttributes() {
    return ['data-state'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    if (name === 'data-state') this.requestUpdate();
  }
  render() {
    const state = this.getAttribute('data-state') || 'closed';
    return html`<h3 class="flex">
      <button
        type="button"
        data-slot="accordion-trigger"
        data-state=${state}
        aria-expanded=${state === 'open' ? 'true' : 'false'}
        class=${cn(
          'flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180',
        )}
      >
        <span class="flex-1">${unsafeHTML(this._slot)}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200"
        ><path d="m6 9 6 6 6-6"/></svg>
      </button>
    </h3>`;
  }
}
UiAccordionTrigger.register('ui-accordion-trigger');

export class UiAccordionContent extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  static get observedAttributes() {
    return ['data-state'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    if (name === 'data-state') this.requestUpdate();
  }
  render() {
    const state = this.getAttribute('data-state') || 'closed';
    return html`<div
      data-slot="accordion-content"
      data-state=${state}
      ?hidden=${state !== 'open'}
      class="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    >
      <div class=${cn('pt-0 pb-4')}>${unsafeHTML(this._slot)}</div>
    </div>`;
  }
}
UiAccordionContent.register('ui-accordion-content');
