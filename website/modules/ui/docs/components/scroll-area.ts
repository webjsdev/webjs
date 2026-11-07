import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Scroll Area docs page, ported from shadcn's
 * content/docs/components/radix/scroll-area.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'scroll-area-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { scrollAreaClass } from '#components/ui/scroll-area.ts';
import { cn } from '#lib/utils/cn.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div
  tabindex="0"
  role="region"
  aria-label="Release notes"
  class=\${cn(scrollAreaClass(), 'h-[200px] w-[350px] rounded-md border p-4')}
>
  Your scrollable content here.
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Composition')}
    <p>A scroll area is one element. The kit styles the browser's own scrollbar rather than drawing a <code>ScrollBar</code> part, so native scrolling, momentum and keyboard scrolling keep working:</p>
    ${codeFigure(`div (scrollAreaClass)
└── your content`, { lang: 'text' })}

    ${heading(toc, 2, 'Horizontal')}
    <p>Use <code>scrollAreaClass({ orientation: 'horizontal' })</code> for horizontal scrolling.</p>
    ${await componentPreview('scroll-area-horizontal-demo')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('scroll-area-rtl', { direction: 'rtl', previewClass: 'h-auto' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'scrollAreaClass')}
    <p><code>scrollAreaClass()</code> returns the classes for the scrolling region: native overflow on the chosen axis, a thin scrollbar in the theme's border colour, and a focus ring. Give the element a size so it has something to scroll inside, and <code>tabindex="0"</code>, <code>role="region"</code> and an <code>aria-label</code> so a keyboard can reach it and a screen reader can name it.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>orientation</code></td><td><code>"vertical" | "horizontal" | "both"</code></td><td><code>"vertical"</code></td></tr>
        </tbody>
      </table>
    </div>
  `;
}
