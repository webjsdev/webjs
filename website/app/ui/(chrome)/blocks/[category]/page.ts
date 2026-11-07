import { html, notFound } from '@webjsdev/core';
import type { PageProps } from '@webjsdev/core';
import { listBlocks } from '#modules/ui/queries/blocks.server.ts';
import { blockViewer } from '#lib/ui/block-viewer.ts';
import { blocksShell, BLOCK_CATEGORIES } from '#lib/ui/blocks-shell.ts';
// The viewer's behaviour, registered by the page that renders it.
import '#components/block-viewer.ts';

/**
 * /ui/blocks/<category>, every block in one category, ported from shadcn/ui's
 * apps/v4/app/(app)/blocks/[...categories]/page.tsx (#1666, D18). A hidden
 * category (dashboard, authentication) still has its page, as in shadcn, and
 * a category with no block yet is a 404.
 */

export async function generateMetadata({ params }: PageProps<'/ui/blocks/[category]'>) {
  const category = BLOCK_CATEGORIES.find((c) => c.slug === params.category);
  return category ? { title: `${category.name} Blocks | WebJs UI` } : {};
}

export default async function BlockCategoryPage({ params, url }: PageProps<'/ui/blocks/[category]'>) {
  const category = BLOCK_CATEGORIES.find((c) => c.slug === params.category);
  if (!category) notFound();
  const blocks = await listBlocks(category.slug);
  if (!blocks.length) notFound();
  const viewers = await Promise.all(blocks.map((b) => blockViewer(b.name)));
  return blocksShell(new URL(url).pathname, category.slug, html`
    <div class="flex flex-col gap-12 md:gap-24">${viewers}</div>
  `);
}
