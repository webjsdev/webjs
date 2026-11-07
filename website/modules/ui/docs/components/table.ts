import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Table docs page, ported from shadcn's
 * content/docs/components/radix/table.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'table-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  tableContainerClass,
  tableClass,
  tableBodyClass,
  tableCaptionClass,
  tableCellClass,
  tableHeadClass,
  tableHeaderClass,
  tableRowClass,
} from '#components/ui/table.ts';
import { cn } from '#lib/utils/cn.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div class=\${tableContainerClass()}>
  <table class=\${tableClass()}>
    <caption class=\${tableCaptionClass()}>A list of your recent invoices.</caption>
    <thead class=\${tableHeaderClass()}>
      <tr class=\${tableRowClass()}>
        <th scope="col" class=\${cn(tableHeadClass(), 'w-[100px]')}>Invoice</th>
        <th scope="col" class=\${tableHeadClass()}>Status</th>
        <th scope="col" class=\${tableHeadClass()}>Method</th>
        <th scope="col" class=\${cn(tableHeadClass(), 'text-right')}>Amount</th>
      </tr>
    </thead>
    <tbody class=\${tableBodyClass()}>
      <tr class=\${tableRowClass()}>
        <td class=\${cn(tableCellClass(), 'font-medium')}>INV001</td>
        <td class=\${tableCellClass()}>Paid</td>
        <td class=\${tableCellClass()}>Credit Card</td>
        <td class=\${cn(tableCellClass(), 'text-right')}>$250.00</td>
      </tr>
    </tbody>
  </table>
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a table, each part a native table element with its helper:</p>
    ${codeFigure(`div (tableContainerClass)
└── table (tableClass)
    ├── caption (tableCaptionClass)
    ├── thead (tableHeaderClass)
    │   └── tr (tableRowClass)
    │       ├── th (tableHeadClass)
    │       ├── th (tableHeadClass)
    │       ├── th (tableHeadClass)
    │       └── th (tableHeadClass)
    ├── tbody (tableBodyClass)
    │   ├── tr (tableRowClass)
    │   │   ├── td (tableCellClass)
    │   │   ├── td (tableCellClass)
    │   │   ├── td (tableCellClass)
    │   │   └── td (tableCellClass)
    │   └── tr (tableRowClass)
    │       ├── td (tableCellClass)
    │       ├── td (tableCellClass)
    │       ├── td (tableCellClass)
    │       └── td (tableCellClass)
    └── tfoot (tableFooterClass)`, { lang: 'text' })}

    ${heading(toc, 2, 'Footer')}
    <p>Use a <code>&lt;tfoot&gt;</code> with <code>tableFooterClass()</code> to add a footer to the table.</p>
    ${await componentPreview('table-footer')}

    ${heading(toc, 2, 'Actions')}
    <p>A table showing actions for each row using a <code>&lt;ui-dropdown-menu&gt;</code> element.</p>
    ${await componentPreview('table-actions')}

    ${heading(toc, 2, 'Data Table')}
    <p>You can use the table helpers to build more complex data tables. Add sorting, filtering and pagination on the server, which can sort and slice the rows before it renders them, driven by the query string, which keeps the table working with JavaScript off.</p>
    <p>See the <a href="/ui/docs/components/data-table">Data Table</a> documentation for more information.</p>

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('table-rtl', { direction: 'rtl', previewClass: 'h-auto' })}

    ${heading(toc, 2, 'API Reference')}
    <p>Each helper returns the classes for one native table element. The native elements keep their semantics, so the accessibility tree works without extra roles. Give every header cell a <code>scope</code> and the table a <code>&lt;caption&gt;</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Helper</th><th>Element</th><th>Part</th></tr></thead>
        <tbody>
          <tr><td><code>tableContainerClass()</code></td><td><code>&lt;div&gt;</code></td><td>The scroll wrapper</td></tr>
          <tr><td><code>tableClass()</code></td><td><code>&lt;table&gt;</code></td><td>The table</td></tr>
          <tr><td><code>tableHeaderClass()</code></td><td><code>&lt;thead&gt;</code></td><td>The header rows</td></tr>
          <tr><td><code>tableBodyClass()</code></td><td><code>&lt;tbody&gt;</code></td><td>The body rows</td></tr>
          <tr><td><code>tableFooterClass()</code></td><td><code>&lt;tfoot&gt;</code></td><td>The footer rows</td></tr>
          <tr><td><code>tableRowClass()</code></td><td><code>&lt;tr&gt;</code></td><td>A row</td></tr>
          <tr><td><code>tableHeadClass()</code></td><td><code>&lt;th&gt;</code></td><td>A header cell</td></tr>
          <tr><td><code>tableCellClass()</code></td><td><code>&lt;td&gt;</code></td><td>A data cell</td></tr>
          <tr><td><code>tableCaptionClass()</code></td><td><code>&lt;caption&gt;</code></td><td>The caption</td></tr>
        </tbody>
      </table>
    </div>
  `;
}
