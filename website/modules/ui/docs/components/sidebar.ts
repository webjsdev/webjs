import { html } from '@webjsdev/core';
import type { TocEntry } from '#lib/ui/docs/page.ts';
import { blockPreview } from '#lib/ui/block-viewer.ts';

/**
 * The Sidebar docs page, ported from shadcn's
 * content/docs/components/radix/sidebar.mdx (#1666). shadcn's page has no
 * component demo: it leads with a whole block, `<ComponentPreview
 * type="block">`, the sidebar that collapses to icons. Here that is the
 * sidebar-07 block, the same sidebar, shown in its /ui/view frame.
 */

/** The block preview and the paragraphs shadcn puts above Installation. */
export function intro(_toc: TocEntry[]) {
  return html`
    ${blockPreview('sidebar-07', { caption: 'A sidebar that collapses to icons.' })}
    <p>Sidebars are one of the most complex components to build. They are central to any application and often contain a lot of moving parts.</p>
    <p>We now have a solid foundation to build on top of. Composable. Themeable. Customizable.</p>
    <p><a href="/ui/blocks">Browse the Blocks Library</a>.</p>
  `;
}

/** Everything after Installation. */
export default function body(_toc: TocEntry[]) {
  return html``;
}
