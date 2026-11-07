import { html } from '@webjsdev/core';
import type { Metadata, PageProps } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { listBlocks } from '#modules/ui/queries/blocks.server.ts';
import { blockViewer } from '#lib/ui/block-viewer.ts';
import { blocksShell, BLOCKS_TITLE, BLOCKS_DESCRIPTION, FEATURED_BLOCKS } from '#lib/ui/blocks-shell.ts';
// The viewer's behaviour. A page never hydrates, so it imports the element
// its markup uses to register it.
import '#components/block-viewer.ts';

/**
 * /ui/blocks, the featured blocks, ported from shadcn/ui's
 * apps/v4/app/(app)/blocks/page.tsx (#1666, D18): the page header, the
 * categories nav, one block viewer per featured block, and a link to the
 * rest.
 */

export const metadata: Metadata = {
  title: `${BLOCKS_TITLE} | WebJs UI`,
  description: BLOCKS_DESCRIPTION,
};

export default async function BlocksPage({ url }: Pick<PageProps, 'url'>) {
  const shipped = new Set((await listBlocks()).map((b) => b.name));
  const featured = FEATURED_BLOCKS.filter((name) => shipped.has(name));
  const viewers = await Promise.all(featured.map((name) => blockViewer(name)));
  return blocksShell(new URL(url).pathname, '', html`
    <div class="flex flex-col gap-12 md:gap-24">
      ${viewers}
      <div class="container-wrapper">
        <div class="container flex justify-center py-6">
          <a href="/ui/blocks/sidebar" data-slot="button" class=${cn(buttonClass({ variant: 'outline' }), 'no-underline')}>Browse more blocks</a>
        </div>
      </div>
    </div>
  `);
}
