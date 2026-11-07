import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Breadcrumb docs page, ported from shadcn's
 * content/docs/components/radix/breadcrumb.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'breadcrumb-demo';

const classOnly = (row: unknown, desc: unknown) => html`
  <p>${desc}</p>
  <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
    <table>
      <thead><tr><th>Helper</th><th>Element</th><th>Attributes</th></tr></thead>
      <tbody>${row}</tbody>
    </table>
  </div>`;

export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import {
  breadcrumbListClass,
  breadcrumbItemClass,
  breadcrumbLinkClass,
  breadcrumbPageClass,
  breadcrumbSeparatorClass,
} from '#components/ui/breadcrumb.ts';`, { lineNumbers: true })}
    ${codeFigure(`<nav aria-label="breadcrumb" data-slot="breadcrumb">
  <ol data-slot="breadcrumb-list" class=\${breadcrumbListClass()}>
    <li data-slot="breadcrumb-item" class=\${breadcrumbItemClass()}>
      <a data-slot="breadcrumb-link" href="/" class=\${breadcrumbLinkClass()}>Home</a>
    </li>
    <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=\${breadcrumbSeparatorClass()}>
      \${ChevronRightIcon()}
    </li>
    <li data-slot="breadcrumb-item" class=\${breadcrumbItemClass()}>
      <a data-slot="breadcrumb-link" href="/components" class=\${breadcrumbLinkClass()}>Components</a>
    </li>
    <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true" class=\${breadcrumbSeparatorClass()}>
      \${ChevronRightIcon()}
    </li>
    <li data-slot="breadcrumb-item" class=\${breadcrumbItemClass()}>
      <span data-slot="breadcrumb-page" aria-current="page" class=\${breadcrumbPageClass()}>Breadcrumb</span>
    </li>
  </ol>
</nav>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>Use the following composition to build a breadcrumb:</p>
    ${codeFigure(`<nav aria-label="breadcrumb">
└── breadcrumbListClass()
    ├── breadcrumbItemClass()
    │   └── breadcrumbLinkClass()
    ├── breadcrumbSeparatorClass()
    ├── breadcrumbItemClass()
    │   └── breadcrumbLinkClass()
    ├── breadcrumbSeparatorClass()
    └── breadcrumbItemClass()
        └── breadcrumbPageClass()`, { lang: 'text' })}

    ${heading(toc, 2, 'Basic')}
    <p>A basic breadcrumb with a home link and a components link.</p>
    ${await componentPreview('breadcrumb-basic')}

    ${heading(toc, 2, 'Custom separator')}
    <p>The separator is whatever its <code>&lt;li&gt;</code> holds, so put any icon inside the item that carries <code>breadcrumbSeparatorClass()</code> to create a custom separator.</p>
    ${await componentPreview('breadcrumb-separator')}

    ${heading(toc, 2, 'Dropdown')}
    <p>You can put a <code>&lt;ui-dropdown-menu&gt;</code> inside a breadcrumb item to create a dropdown in the breadcrumb.</p>
    ${await componentPreview('breadcrumb-dropdown')}

    ${heading(toc, 2, 'Collapsed')}
    <p>Use <code>breadcrumbEllipsisClass()</code> to show a collapsed state when the breadcrumb is too long.</p>
    ${await componentPreview('breadcrumb-ellipsis', { previewClass: 'p-2' })}

    ${heading(toc, 2, 'Link component')}
    <p>A breadcrumb link is a plain <code>&lt;a&gt;</code> with <code>breadcrumbLinkClass()</code>. WebJs's client router handles a plain link on its own.</p>
    ${await componentPreview('breadcrumb-link')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('breadcrumb-rtl', { direction: 'rtl', previewClass: 'p-2' })}

    ${heading(toc, 2, 'API Reference')}
    <p>Every part is a class helper with no options. Put it on the native element below, together with the <code>data-slot</code> and the ARIA attributes the helper does not emit.</p>

    ${heading(toc, 3, 'Breadcrumb')}
    ${classOnly(html`<tr><td>none</td><td><code>&lt;nav&gt;</code></td><td><code>aria-label="breadcrumb"</code>, <code>data-slot="breadcrumb"</code></td></tr>`,
      html`The root navigation element that wraps the breadcrumb. It needs no classes.`)}

    ${heading(toc, 3, 'breadcrumbListClass')}
    ${classOnly(html`<tr><td><code>breadcrumbListClass()</code></td><td><code>&lt;ol&gt;</code></td><td><code>data-slot="breadcrumb-list"</code></td></tr>`,
      html`The ordered list of breadcrumb items.`)}

    ${heading(toc, 3, 'breadcrumbItemClass')}
    ${classOnly(html`<tr><td><code>breadcrumbItemClass()</code></td><td><code>&lt;li&gt;</code></td><td><code>data-slot="breadcrumb-item"</code></td></tr>`,
      html`Wraps an individual breadcrumb item.`)}

    ${heading(toc, 3, 'breadcrumbLinkClass')}
    ${classOnly(html`<tr><td><code>breadcrumbLinkClass()</code></td><td><code>&lt;a&gt;</code></td><td><code>data-slot="breadcrumb-link"</code>, <code>href</code></td></tr>`,
      html`A clickable link in the breadcrumb.`)}

    ${heading(toc, 3, 'breadcrumbPageClass')}
    ${classOnly(html`<tr><td><code>breadcrumbPageClass()</code></td><td><code>&lt;span&gt;</code></td><td><code>data-slot="breadcrumb-page"</code>, <code>aria-current="page"</code></td></tr>`,
      html`The current page in the breadcrumb (not clickable).`)}

    ${heading(toc, 3, 'breadcrumbSeparatorClass')}
    ${classOnly(html`<tr><td><code>breadcrumbSeparatorClass()</code></td><td><code>&lt;li&gt;</code></td><td><code>data-slot="breadcrumb-separator"</code>, <code>role="presentation"</code>, <code>aria-hidden="true"</code></td></tr>`,
      html`A separator between breadcrumb items. Its content is the separator icon, so put any icon inside it.`)}

    ${heading(toc, 3, 'breadcrumbEllipsisClass')}
    ${classOnly(html`<tr><td><code>breadcrumbEllipsisClass()</code></td><td><code>&lt;span&gt;</code></td><td><code>data-slot="breadcrumb-ellipsis"</code>, <code>role="presentation"</code>, <code>aria-hidden="true"</code></td></tr>`,
      html`An ellipsis indicator for collapsed breadcrumb items. Put an icon and an <code>sr-only</code> label inside it.`)}
  `;
}
