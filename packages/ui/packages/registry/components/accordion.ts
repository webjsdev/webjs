/**
 * Accordion — vertical collapsible item list. Single or multiple open at a time.
 *
 * APG pattern: https://www.w3.org/WAI/ARIA/apg/patterns/accordion/
 *
 * shadcn parity:
 *   Accordion (type: single | multiple, collapsible: boolean, value: string|string[])
 *   AccordionItem (value), AccordionTrigger, AccordionContent.
 *
 * Usage:
 *   <ui-accordion type="single" collapsible>
 *     <ui-accordion-item value="item-1">
 *       <ui-accordion-trigger>Is it accessible?</ui-accordion-trigger>
 *       <ui-accordion-content>Yes — uses APG accordion pattern.</ui-accordion-content>
 *     </ui-accordion-item>
 *     <ui-accordion-item value="item-2">
 *       <ui-accordion-trigger>Is it animated?</ui-accordion-trigger>
 *       <ui-accordion-content>Yes (height transition).</ui-accordion-content>
 *     </ui-accordion-item>
 *   </ui-accordion>
 *
 * Design tokens used: --muted-foreground, --border, --ring.
 */
import { cn, Base, defineElement } from '../lib/utils.ts';

export const accordionItemClass = (): string => 'border-b last:border-b-0';

export const accordionTriggerClass = (): string =>
  'flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180';

export const accordionContentClass = (): string => 'overflow-hidden text-sm';

const STYLES = `
ui-accordion-item[data-state="closed"] > ui-accordion-content { display: none !important; }
ui-accordion-content > * { padding-top: 0; padding-bottom: 1rem; }
`;

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-accordion-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-accordion-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export class UiAccordion extends Base {
  static get observedAttributes(): string[] {
    return ['value', 'type', 'collapsible'];
  }
  connectedCallback(): void {
    installStyles();
    this.setAttribute('data-slot', 'accordion');
    if (!this.hasAttribute('type')) this.setAttribute('type', 'single');
    this.addEventListener('ui-accordion-trigger-click', this._onTriggerClick as EventListener);
    queueMicrotask(() => this._sync());
  }
  disconnectedCallback(): void {
    this.removeEventListener('ui-accordion-trigger-click', this._onTriggerClick as EventListener);
  }
  attributeChangedCallback(): void {
    this._sync();
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
    this.setAttribute('value', next);
  }
  private _sync(): void {
    const values = this._values;
    const items = this.querySelectorAll<HTMLElement>('ui-accordion-item');
    items.forEach((item) => {
      const v = item.getAttribute('value');
      const open = !!v && values.has(v);
      item.setAttribute('data-state', open ? 'open' : 'closed');
      const trigger = item.querySelector<HTMLElement>('ui-accordion-trigger');
      trigger?.setAttribute('data-state', open ? 'open' : 'closed');
      trigger?.setAttribute('aria-expanded', String(open));
      const content = item.querySelector<HTMLElement>('ui-accordion-content');
      content?.setAttribute('data-state', open ? 'open' : 'closed');
    });
  }
  private _onTriggerClick = (e: CustomEvent): void => {
    const v = e.detail?.value as string | undefined;
    if (!v) return;
    const values = this._values;
    const collapsible = this.hasAttribute('collapsible');
    if (this._type === 'single') {
      if (values.has(v)) {
        if (collapsible) values.clear();
        else return;
      } else {
        values.clear();
        values.add(v);
      }
    } else {
      if (values.has(v)) values.delete(v);
      else values.add(v);
    }
    this._setValues(values);
  };
}
defineElement('ui-accordion', UiAccordion);

export class UiAccordionItem extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'accordion-item');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(accordionItemClass(), userClass);
  }
}
defineElement('ui-accordion-item', UiAccordionItem);

export class UiAccordionTrigger extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'accordion-trigger');
    this.setAttribute('role', 'button');
    this.setAttribute('tabindex', '0');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(accordionTriggerClass(), userClass);
    // Default chevron icon if no SVG child is provided
    if (!this.querySelector('svg')) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute(
        'class',
        'pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200',
      );
      svg.innerHTML = '<path d="m6 9 6 6 6-6"/>';
      this.appendChild(svg);
    }
    this.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeyDown);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeyDown);
  }
  private _onClick = (): void => {
    const item = this.closest('ui-accordion-item');
    const value = item?.getAttribute('value');
    if (!value) return;
    this.dispatchEvent(
      new CustomEvent('ui-accordion-trigger-click', { detail: { value }, bubbles: true }),
    );
  };
  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this._onClick();
    }
  };
}
defineElement('ui-accordion-trigger', UiAccordionTrigger);

export class UiAccordionContent extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'accordion-content');
    this.setAttribute('role', 'region');
    const userClass = this.getAttribute('class') ?? '';
    this.className = cn(accordionContentClass(), userClass);
  }
}
defineElement('ui-accordion-content', UiAccordionContent);
