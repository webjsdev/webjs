import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Separator docs page, ported from shadcn's
 * content/docs/components/radix/separator.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'separator-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { separatorClass } from '#components/ui/separator.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div role="none" data-orientation="horizontal" class=\${separatorClass()}></div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Vertical')}
    <p>Use <code>data-orientation="vertical"</code> for a vertical separator.</p>
    ${await componentPreview('separator-vertical')}

    ${heading(toc, 2, 'Menu')}
    <p>Vertical separators between menu items with descriptions.</p>
    ${await componentPreview('separator-menu')}

    ${heading(toc, 2, 'List')}
    <p>Horizontal separators between list items.</p>
    ${await componentPreview('separator-list')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('separator-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'separatorClass')}
    <p><code>separatorClass()</code> returns the classes for a divider. Put them on an empty element. The orientation is read from the element's <code>data-orientation</code> attribute, not from an option, so the same classes draw a horizontal or a vertical line.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>data-orientation</code></td><td><code>"horizontal" | "vertical"</code></td><td><code>"horizontal"</code></td></tr>
          <tr><td><code>role</code></td><td><code>"none" | "separator"</code></td><td><code>"none"</code></td></tr>
          <tr><td><code>aria-orientation</code></td><td><code>"horizontal" | "vertical"</code></td><td>-</td></tr>
        </tbody>
      </table>
    </div>
    <p>A purely decorative divider takes <code>role="none"</code>, as shadcn's default <code>decorative</code> separator does. A divider that carries meaning takes <code>role="separator"</code> plus <code>aria-orientation</code>, so assistive technology announces it.</p>
  `;
}
