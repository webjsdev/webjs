import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';
import { callout } from '#lib/ui/docs/callout.ts';

/**
 * The Pagination docs page, ported from shadcn's
 * content/docs/components/radix/pagination.mdx (#1666, D15): the same
 * sections in the same order, the prose rewritten where it describes React
 * and Next.js.
 */
export const demo = 'pagination-demo';

const TABLE = 'typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  paginationClass,
  paginationContentClass,
  paginationLinkClass,
  paginationPreviousClass,
  paginationNextClass,
  paginationEllipsisClass,
} from '#components/ui/pagination.ts';`, { lineNumbers: true })}
    ${codeFigure(`<nav aria-label="pagination" class=\${paginationClass()}>
  <ul class=\${paginationContentClass()}>
    <li>
      <a href="#" aria-label="Go to previous page" class=\${paginationPreviousClass()}>Previous</a>
    </li>
    <li>
      <a href="#" class=\${paginationLinkClass()}>1</a>
    </li>
    <li>
      <a href="#" aria-current="page" class=\${paginationLinkClass({ isActive: true })}>2</a>
    </li>
    <li>
      <a href="#" class=\${paginationLinkClass()}>3</a>
    </li>
    <li class=\${paginationEllipsisClass()} aria-hidden="true">...</li>
    <li>
      <a href="#" aria-label="Go to next page" class=\${paginationNextClass()}>Next</a>
    </li>
  </ul>
</nav>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a pagination:</p>
    ${codeFigure(`<nav> paginationClass()
└── <ul> paginationContentClass()
    ├── <li>
    │   └── <a> paginationPreviousClass()
    ├── <li>
    │   └── <a> paginationLinkClass()
    ├── <li> paginationEllipsisClass()
    └── <li>
        └── <a> paginationNextClass()`, { lang: 'text' })}

    ${heading(toc, 2, 'Simple')}
    <p>A simple pagination with only page numbers.</p>
    ${await componentPreview('pagination-simple')}

    ${heading(toc, 2, 'Icons Only')}
    <p>Use just the previous and next buttons without page numbers. This is useful for data tables with a rows per page selector.</p>
    ${await componentPreview('pagination-icons-only')}

    ${heading(toc, 2, 'Next.js')}
    <p>shadcn's React component renders an <code>&lt;a&gt;</code> and asks you to swap in the Next.js <code>&lt;Link&gt;</code> for client-side navigation. In WebJs there is nothing to swap: a page link is a plain <code>&lt;a href&gt;</code>, and the client router picks it up on its own, with prefetch and a soft navigation. Use a real page URL such as <code>?page=3</code> in the <code>href</code> so the links also work with JavaScript off.</p>
    ${codeFigure(`<a href="?page=3" class=\${paginationLinkClass()}>3</a>`)}
    ${callout(html`<strong>Note:</strong> Because the links are native anchors, no change to <code>pagination.ts</code> is needed for routing.`, { className: 'mt-6' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('pagination-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'Changelog')}

    ${heading(toc, 3, 'RTL Support')}
    <p>shadcn added a <code>text</code> prop to <code>PaginationPrevious</code> and <code>PaginationNext</code> so their labels can be translated. The kit's helpers style an anchor you write yourself, so the label is already your own text and there is nothing to update. Give the chevrons the <code>rtl:rotate-180</code> class so they point the right way in a right-to-left page, and use the logical <code>ps-1.5!</code> and <code>pe-1.5!</code> paddings, as the RTL example above does.</p>

    ${heading(toc, 2, 'API Reference')}
    <p>Every part is a class helper for a native element. The helpers emit no ARIA, so add it yourself: wrap the list in <code>&lt;nav aria-label="pagination"&gt;</code>, set <code>aria-current="page"</code> on the active link, give an icon-only previous or next link an <code>aria-label</code>, and mark the ellipsis <code>aria-hidden="true"</code>.</p>
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Helper</th><th>Applies to</th></tr></thead>
        <tbody>
          <tr><td><code>paginationClass()</code></td><td>The <code>&lt;nav&gt;</code>.</td></tr>
          <tr><td><code>paginationContentClass()</code></td><td>The <code>&lt;ul&gt;</code>.</td></tr>
          <tr><td><code>paginationLinkClass()</code></td><td>A page <code>&lt;a&gt;</code>.</td></tr>
          <tr><td><code>paginationPreviousClass()</code></td><td>The previous page <code>&lt;a&gt;</code>.</td></tr>
          <tr><td><code>paginationNextClass()</code></td><td>The next page <code>&lt;a&gt;</code>.</td></tr>
          <tr><td><code>paginationEllipsisClass()</code></td><td>The ellipsis.</td></tr>
        </tbody>
      </table>
    </div>

    ${heading(toc, 3, 'paginationLinkClass')}
    <div class=${TABLE}>
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>isActive</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>size</code></td><td><code>"default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"</code></td><td><code>"icon"</code></td></tr>
        </tbody>
      </table>
    </div>
  `;
}
