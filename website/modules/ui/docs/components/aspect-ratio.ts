import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Aspect Ratio docs page, ported from shadcn's
 * content/docs/components/radix/aspect-ratio.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'aspect-ratio-demo';

export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { aspectRatioClass } from '#components/ui/aspect-ratio.ts';`, { lineNumbers: true })}
    ${codeFigure(`<div data-slot="aspect-ratio" style="aspect-ratio: 16 / 9" class=\${aspectRatioClass()}>
  <img src="..." alt="Image" class="absolute inset-0 h-full w-full rounded-md object-cover">
</div>`, { lineNumbers: true })}

    ${heading(toc, 2, 'Square')}
    <p>A square aspect ratio component using <code>style="aspect-ratio: 1 / 1"</code>. This is useful for displaying images in a square format.</p>
    ${await componentPreview('aspect-ratio-square')}

    ${heading(toc, 2, 'Portrait')}
    <p>A portrait aspect ratio component using <code>style="aspect-ratio: 9 / 16"</code>. This is useful for displaying images in a portrait format.</p>
    ${await componentPreview('aspect-ratio-portrait', { previewClass: 'h-96' })}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('aspect-ratio-rtl', { direction: 'rtl', previewClass: 'h-96' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'aspectRatioClass')}
    <p><code>aspectRatioClass()</code> returns the classes for the box that holds content within a desired ratio. It takes no options: the ratio is the CSS <code>aspect-ratio</code> property, set inline or with a Tailwind class such as <code>aspect-video</code> or <code>aspect-[4/3]</code>. Position the content inside with <code>absolute inset-0</code> so it fills the box.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Attribute</th><th>Type</th><th>Required</th></tr></thead>
        <tbody>
          <tr><td><code>style="aspect-ratio: …"</code></td><td><code>string</code></td><td>Yes</td></tr>
          <tr><td><code>class</code></td><td><code>string</code></td><td>No</td></tr>
        </tbody>
      </table>
    </div>
  `;
}
