import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core';
import { cn } from '../../lib/utils.ts';

/**
 * Card subcomponents. Each is a thin styled wrapper that captures host
 * innerHTML and re-emits it inside a styled div.
 *
 * Compose via DOM nesting:
 *
 *   <ui-card>
 *     <ui-card-header>
 *       <ui-card-title>Title</ui-card-title>
 *       <ui-card-description>Description</ui-card-description>
 *     </ui-card-header>
 *     <ui-card-content>...</ui-card-content>
 *     <ui-card-footer>...</ui-card-footer>
 *   </ui-card>
 */

function makeWrapper(tag: string, slot: string, classes: string) {
  class Wrap extends WebComponent {
    private _slot = '';
    connectedCallback() { if (!this._slot) this._slot = this.innerHTML; super.connectedCallback(); }
    render() { return html`<div data-slot=${slot} class=${cn(classes)}>${unsafeHTML(this._slot)}</div>`; }
  }
  Wrap.register(tag);
  return Wrap;
}

export const UiCard = makeWrapper('ui-card', 'card', 'flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm');
export const UiCardHeader = makeWrapper('ui-card-header', 'card-header', '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6');
export const UiCardTitle = makeWrapper('ui-card-title', 'card-title', 'leading-none font-semibold');
export const UiCardDescription = makeWrapper('ui-card-description', 'card-description', 'text-sm text-muted-foreground');
export const UiCardAction = makeWrapper('ui-card-action', 'card-action', 'col-start-2 row-span-2 row-start-1 self-start justify-self-end');
export const UiCardContent = makeWrapper('ui-card-content', 'card-content', 'px-6');
export const UiCardFooter = makeWrapper('ui-card-footer', 'card-footer', 'flex items-center px-6 [.border-t]:pt-6');
