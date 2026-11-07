import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Skeleton docs page, ported from shadcn's
 * content/docs/components/radix/skeleton.mdx (#1666): the same sections in
 * the same order, the prose rewritten where it describes React.
 */
export const demo = 'skeleton-demo';

/** Everything after Installation. */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { skeletonClass } from '#components/ui/skeleton.ts';
import { cn } from '#lib/utils/cn.ts';`)}
    ${codeFigure(`<div aria-hidden="true" class=\${cn(skeletonClass(), 'h-[20px] w-[100px] rounded-full')}></div>`)}

    ${heading(toc, 2, 'Avatar')}
    ${await componentPreview('skeleton-avatar')}

    ${heading(toc, 2, 'Card')}
    ${await componentPreview('skeleton-card', { previewClass: 'h-80' })}

    ${heading(toc, 2, 'Text')}
    ${await componentPreview('skeleton-text')}

    ${heading(toc, 2, 'Form')}
    ${await componentPreview('skeleton-form')}

    ${heading(toc, 2, 'Table')}
    ${await componentPreview('skeleton-table')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('skeleton-rtl', { direction: 'rtl' })}
  `;
}
