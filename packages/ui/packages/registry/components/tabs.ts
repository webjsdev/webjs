import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Tabs. Composition:
 *
 *   <ui-tabs value="a">
 *     <ui-tabs-list>
 *       <ui-tabs-trigger value="a">A</ui-tabs-trigger>
 *       <ui-tabs-trigger value="b">B</ui-tabs-trigger>
 *     </ui-tabs-list>
 *     <ui-tabs-content value="a">Pane A</ui-tabs-content>
 *     <ui-tabs-content value="b">Pane B</ui-tabs-content>
 *   </ui-tabs>
 *
 * Root owns `value` (active tab). Trigger click + arrow keys update it.
 */
export class UiTabs extends WebComponent {
  static properties = {
    value: { type: String, reflect: true },
    orientation: { type: String, reflect: true },
  };
  declare value: string;
  declare orientation: 'horizontal' | 'vertical';

  private _slot = '';

  constructor() {
    super();
    this.value = '';
    this.orientation = 'horizontal';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('ui-tabs-select', this._onSelect as EventListener);
    queueMicrotask(() => this._syncChildren());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('ui-tabs-select', this._onSelect as EventListener);
  }

  _onSelect = (e: CustomEvent) => {
    const v = e.detail?.value as string | undefined;
    if (!v || v === this.value) return;
    this.value = v;
    this._syncChildren();
    this.dispatchEvent(new CustomEvent('change', { detail: { value: v }, bubbles: true, composed: true }));
  };

  _syncChildren() {
    this.querySelectorAll('ui-tabs-trigger, ui-tabs-content').forEach((el) => {
      (el as HTMLElement).setAttribute('data-group-value', this.value || '');
      (el as HTMLElement).setAttribute('data-orientation', this.orientation);
    });
  }

  static get observedAttributes() {
    return ['value', 'orientation'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    this._syncChildren();
  }

  render() {
    return html`<div
      data-slot="tabs"
      data-orientation=${this.orientation}
      class=${cn('group/tabs flex gap-2 data-[orientation=horizontal]:flex-col')}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiTabs.register('ui-tabs');

export class UiTabsList extends WebComponent {
  static properties = {
    variant: { type: String, reflect: true },
  };
  declare variant: 'default' | 'line';

  private _slot = '';

  constructor() {
    super();
    this.variant = 'default';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
    this.addEventListener('keydown', this._onKeyDown);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this._onKeyDown);
  }
  _onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    const triggers = Array.from(
      this.querySelectorAll<HTMLElement>('ui-tabs-trigger:not([disabled])'),
    );
    if (!triggers.length) return;
    const active = document.activeElement?.closest('ui-tabs-trigger') as HTMLElement | null;
    let idx = active ? triggers.indexOf(active) : -1;
    if (e.key === 'ArrowRight') idx = (idx + 1) % triggers.length;
    else if (e.key === 'ArrowLeft') idx = (idx - 1 + triggers.length) % triggers.length;
    else if (e.key === 'Home') idx = 0;
    else if (e.key === 'End') idx = triggers.length - 1;
    e.preventDefault();
    const next = triggers[idx];
    next.focus();
    const value = next.getAttribute('value') || '';
    next.dispatchEvent(new CustomEvent('ui-tabs-select', { detail: { value }, bubbles: true }));
  };

  render() {
    return html`<div
      role="tablist"
      data-slot="tabs-list"
      data-variant=${this.variant}
      class=${cn(
        'group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none',
        this.variant === 'default' ? 'bg-muted' : 'gap-1 bg-transparent',
      )}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiTabsList.register('ui-tabs-list');

export class UiTabsTrigger extends WebComponent {
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
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this._onClick);
  }

  static get observedAttributes() {
    return ['data-group-value', 'value', 'disabled', 'data-orientation'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    if (name.startsWith('data-')) this.requestUpdate();
  }

  private get _active(): boolean {
    return !!this.value && this.getAttribute('data-group-value') === this.value;
  }

  _onClick = () => {
    if (this.disabled) return;
    this.dispatchEvent(new CustomEvent('ui-tabs-select', { detail: { value: this.value }, bubbles: true }));
  };

  render() {
    const state = this._active ? 'active' : 'inactive';
    return html`<button
      type="button"
      role="tab"
      aria-selected=${this._active ? 'true' : 'false'}
      tabindex=${this._active ? '0' : '-1'}
      ?disabled=${this.disabled}
      data-slot="tabs-trigger"
      data-state=${state}
      class=${cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent',
        'data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground',
        'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100',
      )}
    >${unsafeHTML(this._slot)}</button>`;
  }
}
UiTabsTrigger.register('ui-tabs-trigger');

export class UiTabsContent extends WebComponent {
  static properties = {
    value: { type: String, reflect: true },
  };
  declare value: string;

  private _slot = '';

  constructor() {
    super();
    this.value = '';
  }

  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }

  static get observedAttributes() {
    return ['data-group-value', 'value'];
  }
  attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
    super.attributeChangedCallback?.(name, oldVal, newVal);
    if (name.startsWith('data-') || name === 'value') this.requestUpdate();
  }

  private get _active(): boolean {
    return !!this.value && this.getAttribute('data-group-value') === this.value;
  }

  render() {
    const state = this._active ? 'active' : 'inactive';
    return html`<div
      role="tabpanel"
      data-slot="tabs-content"
      data-state=${state}
      ?hidden=${!this._active}
      class=${cn('flex-1 outline-none')}
    >${unsafeHTML(this._slot)}</div>`;
  }
}
UiTabsContent.register('ui-tabs-content');
