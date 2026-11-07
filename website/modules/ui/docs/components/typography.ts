import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';

/**
 * The Typography docs page, ported from shadcn's
 * content/docs/components/radix/typography.mdx (#1666, D15). shadcn puts
 * its opening sentence above the lead demo; the page renders the lead demo
 * first, so the sentence is the intro just after it.
 */
/** The demo shown above the Installation section. */
export const demo = 'typography-demo';

/** shadcn's opening sentence. */
export function intro(_toc: TocEntry[]) {
  return html`<p>We do not ship any typography styles by default. This page is an example of how you can use utility classes to style your text.</p>`;
}

/** Everything after the lead demo (the page has no Installation section). */
export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'h1')}
    ${await componentPreview('typography-h1')}

    ${heading(toc, 2, 'h2')}
    ${await componentPreview('typography-h2')}

    ${heading(toc, 2, 'h3')}
    ${await componentPreview('typography-h3')}

    ${heading(toc, 2, 'h4')}
    ${await componentPreview('typography-h4')}

    ${heading(toc, 2, 'p')}
    ${await componentPreview('typography-p')}

    ${heading(toc, 2, 'blockquote')}
    ${await componentPreview('typography-blockquote')}

    ${heading(toc, 2, 'table')}
    ${await componentPreview('typography-table')}

    ${heading(toc, 2, 'list')}
    ${await componentPreview('typography-list')}

    ${heading(toc, 2, 'Inline code')}
    ${await componentPreview('typography-inline-code')}

    ${heading(toc, 2, 'Lead')}
    ${await componentPreview('typography-lead')}

    ${heading(toc, 2, 'Large')}
    ${await componentPreview('typography-large')}

    ${heading(toc, 2, 'Small')}
    ${await componentPreview('typography-small')}

    ${heading(toc, 2, 'Muted')}
    ${await componentPreview('typography-muted')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('typography-rtl', { direction: 'rtl', className: '[&_.preview]:h-auto!' })}
  `;
}
