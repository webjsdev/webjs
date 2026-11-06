/**
 * Table: semantic data table with shadcn styling. Tier-1 class helpers;
 * compose with native `<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`,
 * `<th>`, `<td>`, `<caption>`. Native semantics + accessibility tree
 * work out of the box.
 *
 * shadcn parity:
 *   Table container (scroll wrapper)  → tableContainerClass()
 *   Table                             → tableClass()
 *   TableHeader / TableBody / TableFooter
 *                                     → tableHeaderClass() / tableBodyClass() / tableFooterClass()
 *   TableRow                          → tableRowClass()
 *   TableHead / TableCell / TableCaption
 *                                     → tableHeadClass() / tableCellClass() / tableCaptionClass()
 *
 * A11y (required for accessible output): every header cell needs a scope
 * (scope="col" on a column header, scope="row" on a row header) so screen
 * readers map cells to their headers. Add a <caption> naming the table's
 * purpose (it can be visually hidden if a heading already names it).
 *
 * Design tokens used: --muted, --muted-foreground, --foreground.
 *
 * @example
 * ```html
 * <div class=${tableContainerClass()}>
 *   <table class=${tableClass()}>
 *     <thead class=${tableHeaderClass()}>
 *       <tr class=${tableRowClass()}>
 *         <th scope="col" class=${tableHeadClass()}>Name</th>
 *         <th scope="col" class=${tableHeadClass()}>Status</th>
 *       </tr>
 *     </thead>
 *     <tbody class=${tableBodyClass()}>
 *       <tr class=${tableRowClass()}>
 *         <td class=${tableCellClass()}>Vivek</td>
 *         <td class=${tableCellClass()}>Active</td>
 *       </tr>
 *     </tbody>
 *     <caption class=${tableCaptionClass()}>Users</caption>
 *   </table>
 * </div>
 * ```
 */

export const tableContainerClass = (): string => 'cn-table-container';

export const tableClass = (): string => 'cn-table';

export const tableHeaderClass = (): string => 'cn-table-header';

export const tableBodyClass = (): string => 'cn-table-body';

export const tableFooterClass = (): string =>
  'cn-table-footer';

export const tableRowClass = (): string =>
  'cn-table-row has-aria-expanded:bg-muted/50';

export const tableHeadClass = (): string =>
  'cn-table-head';

export const tableCellClass = (): string =>
  'cn-table-cell';

export const tableCaptionClass = (): string => 'cn-table-caption';
