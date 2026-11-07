import { html } from '@webjsdev/core';
import { heading, type TocEntry } from '#lib/ui/docs/page.ts';
import { componentPreview } from '#lib/ui/docs/preview.ts';
import { codeFigure } from '#lib/ui/docs/code.ts';

/**
 * The Badge docs page, ported from shadcn's
 * content/docs/components/radix/badge.mdx (#1666): the same sections in the
 * same order, the prose rewritten where it describes React.
 */
export const demo = 'badge-demo';

export default async function body(toc: TocEntry[]) {
  return html`
    ${heading(toc, 2, 'Usage')}
    ${codeFigure(`import { badgeClass } from '#components/ui/badge.ts';`)}
    ${codeFigure(`<span class=\${badgeClass({ variant: 'outline' })}>Badge</span>`)}

    ${heading(toc, 2, 'Variants')}
    <p>Use the <code>variant</code> option to change the variant of the badge.</p>
    ${await componentPreview('badge-variants')}

    ${heading(toc, 2, 'With Icon')}
    <p>You can render an icon inside the badge. Use <code>data-icon="inline-start"</code> to render the icon on the left and <code>data-icon="inline-end"</code> to render the icon on the right.</p>
    ${await componentPreview('badge-icon')}

    ${heading(toc, 2, 'With Spinner')}
    <p>You can render a <code>spinner()</code> inside the badge. Remember to add the <code>data-icon="inline-start"</code> or <code>data-icon="inline-end"</code> attribute to the spinner.</p>
    ${await componentPreview('badge-spinner')}

    ${heading(toc, 2, 'Link')}
    <p>A class helper styles any element, so a link that looks like a badge is an <code>&lt;a&gt;</code> with the badge's classes. The hover styles apply only when the element is a link.</p>
    ${await componentPreview('badge-link')}

    ${heading(toc, 2, 'Custom Colors')}
    <p>You can customize the colors of a badge by adding custom classes such as <code>bg-green-50 dark:bg-green-800</code>, merged with the helper's through <code>cn()</code>.</p>
    ${await componentPreview('badge-colors')}

    ${heading(toc, 2, 'RTL')}
    <p>To enable RTL support, see the <a href="/ui/docs/rtl">RTL configuration guide</a>.</p>
    ${await componentPreview('badge-rtl', { direction: 'rtl' })}

    ${heading(toc, 2, 'API Reference')}
    ${heading(toc, 3, 'badgeClass')}
    <p><code>badgeClass()</code> returns the classes for a badge or an element that looks like a badge. Put them on a <code>&lt;span&gt;</code> for a static badge, or on an <code>&lt;a&gt;</code> or <code>&lt;button&gt;</code> for an interactive one. <code>badgeVariants()</code> is an alias of <code>badgeClass()</code> that also merges a <code>className</code>.</p>
    <div class="typeset-scroll scroll-fade-x scrollbar-none *:[table]:w-full">
      <table>
        <thead><tr><th>Option</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>"default" | "secondary" | "destructive" | "outline" | "ghost" | "link"</code></td><td><code>"default"</code></td></tr>
        </tbody>
      </table>
    </div>
  `;
}
