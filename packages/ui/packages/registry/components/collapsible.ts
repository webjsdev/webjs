/**
 * Collapsible — togglable content panel.
 *
 * shadcn parity: Collapsible, CollapsibleTrigger, CollapsibleContent.
 *
 * Usage:
 *   <ui-collapsible>
 *     <ui-collapsible-trigger>
 *       <button class=${buttonClass({ variant: 'ghost' })}>Show details</button>
 *     </ui-collapsible-trigger>
 *     <ui-collapsible-content>
 *       <p>Hidden by default. Revealed on trigger click.</p>
 *     </ui-collapsible-content>
 *   </ui-collapsible>
 *
 * Attributes: `open` (boolean reflected).
 * Events: `ui-open-change`.
 */
import { Base, defineElement } from '../lib/utils.ts';

const STYLES = `
ui-collapsible:not([open]) ui-collapsible-content { display: none !important; }
ui-collapsible-content { display: block; }
`;

function installStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ui-collapsible-styles')) return;
  const style = document.createElement('style');
  style.id = 'ui-collapsible-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}

export class UiCollapsible extends Base {
  static get observedAttributes(): string[] {
    return ['open'];
  }
  connectedCallback(): void {
    installStyles();
    this.setAttribute('data-slot', 'collapsible');
    this._reflect();
  }
  attributeChangedCallback(): void {
    this._reflect();
    this.dispatchEvent(
      new CustomEvent('ui-open-change', { detail: { open: this.hasAttribute('open') }, bubbles: true }),
    );
  }
  show(): void {
    this.setAttribute('open', '');
  }
  hide(): void {
    this.removeAttribute('open');
  }
  toggle(): void {
    if (this.hasAttribute('open')) this.hide();
    else this.show();
  }
  private _reflect(): void {
    const open = this.hasAttribute('open');
    this.setAttribute('data-state', open ? 'open' : 'closed');
    const trigger = this.querySelector<HTMLElement>(':scope > ui-collapsible-trigger');
    trigger?.setAttribute('aria-expanded', String(open));
    const content = this.querySelector<HTMLElement>(':scope > ui-collapsible-content');
    content?.setAttribute('data-state', open ? 'open' : 'closed');
  }
}
defineElement('ui-collapsible', UiCollapsible);

export class UiCollapsibleTrigger extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'collapsible-trigger');
    this.addEventListener('click', this._onClick);
  }
  disconnectedCallback(): void {
    this.removeEventListener('click', this._onClick);
  }
  private _onClick = (): void => (this.closest('ui-collapsible') as UiCollapsible | null)?.toggle();
}
defineElement('ui-collapsible-trigger', UiCollapsibleTrigger);

export class UiCollapsibleContent extends Base {
  connectedCallback(): void {
    this.setAttribute('data-slot', 'collapsible-content');
  }
}
defineElement('ui-collapsible-content', UiCollapsibleContent);
