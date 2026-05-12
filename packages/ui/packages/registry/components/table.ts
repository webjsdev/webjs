import { WebComponent, html } from '@webjskit/core';
import { unsafeHTML } from '@webjskit/core/directives';
import { cn } from '../lib/utils.ts';

/**
 * Table family. Each component wraps the corresponding native table element
 * and captures host innerHTML so authors can compose with normal child elements:
 *
 *   <ui-table>
 *     <ui-table-header>
 *       <ui-table-row>
 *         <ui-table-head>Name</ui-table-head>
 *         <ui-table-head>Email</ui-table-head>
 *       </ui-table-row>
 *     </ui-table-header>
 *     <ui-table-body>
 *       <ui-table-row>
 *         <ui-table-cell>Alice</ui-table-cell>
 *         <ui-table-cell>alice@example.com</ui-table-cell>
 *       </ui-table-row>
 *     </ui-table-body>
 *   </ui-table>
 */

function makeWrapper(tag: string, slot: string, element: string, classes: string) {
  class Wrap extends WebComponent {
    private _slot = '';
    connectedCallback() {
      if (!this._slot) this._slot = this.innerHTML;
      super.connectedCallback();
    }
    render() {
      // Render the corresponding native element by tag name.
      const open = `<${element} data-slot="${slot}" class="${cn(classes)}">`;
      const close = `</${element}>`;
      return html`${unsafeHTML(open + this._slot + close)}`;
    }
  }
  Wrap.register(tag);
  return Wrap;
}

/**
 * Root table wraps a <table> in a scrolling container <div>.
 */
export class UiTable extends WebComponent {
  private _slot = '';
  connectedCallback() {
    if (!this._slot) this._slot = this.innerHTML;
    super.connectedCallback();
  }
  render() {
    const open = `<table data-slot="table" class="${cn('w-full caption-bottom text-sm')}">`;
    const close = `</table>`;
    return html`<div
      data-slot="table-container"
      class=${cn('relative w-full overflow-x-auto')}
    >${unsafeHTML(open + this._slot + close)}</div>`;
  }
}
UiTable.register('ui-table');

export const UiTableHeader = makeWrapper('ui-table-header', 'table-header', 'thead', '[&_tr]:border-b');
export const UiTableBody = makeWrapper('ui-table-body', 'table-body', 'tbody', '[&_tr:last-child]:border-0');
export const UiTableFooter = makeWrapper(
  'ui-table-footer',
  'table-footer',
  'tfoot',
  'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
);
export const UiTableRow = makeWrapper(
  'ui-table-row',
  'table-row',
  'tr',
  'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
);
export const UiTableHead = makeWrapper(
  'ui-table-head',
  'table-head',
  'th',
  'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
);
export const UiTableCell = makeWrapper(
  'ui-table-cell',
  'table-cell',
  'td',
  'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
);
export const UiTableCaption = makeWrapper(
  'ui-table-caption',
  'table-caption',
  'caption',
  'mt-4 text-sm text-muted-foreground',
);
