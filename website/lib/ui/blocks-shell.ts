import { html, nothing } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { listBlocks } from '#modules/ui/queries/blocks.server.ts';
import { styleLinks } from '#lib/ui/style-links.ts';
import { uiPageHeader, pageNav } from '#lib/ui/ui-page-header.ts';

/**
 * The /ui/blocks page chrome, shadcn/ui's apps/v4/app/(app)/blocks/layout.tsx
 * and components/blocks-nav.tsx (#1666): the page header, the categories nav
 * with "Browse all blocks", and the soft section the block viewers sit on.
 *
 * It is a fragment each blocks page renders rather than a layout, because the
 * nav marks the current category: a layout is not re-rendered on a soft
 * navigation between two categories, so its active link would go stale.
 */

export const BLOCKS_TITLE = 'Building Blocks for the Web';
export const BLOCKS_DESCRIPTION =
  'Clean, modern building blocks. Copy and paste into your apps. Works with any WebJs app. Open Source. Free forever.';

/** shadcn's lib/categories.ts, in its order. A hidden category has a page but no nav link. */
export const BLOCK_CATEGORIES = [
  { name: 'Sidebar', slug: 'sidebar', hidden: false },
  { name: 'Dashboard', slug: 'dashboard', hidden: true },
  { name: 'Authentication', slug: 'authentication', hidden: true },
  { name: 'Login', slug: 'login', hidden: false },
  { name: 'Signup', slug: 'signup', hidden: false },
];

/** shadcn's FEATURED_BLOCKS, the /ui/blocks page; one not shipped yet is skipped. */
export const FEATURED_BLOCKS = ['dashboard-01', 'sidebar-07', 'sidebar-03', 'login-03', 'login-04'];

const NAV_LINK = 'flex h-7 items-center justify-center px-4 text-center text-base font-medium text-muted-foreground no-underline transition-colors hover:text-primary data-[active=true]:text-primary';

/** The categories nav, listing only the categories that have blocks. */
async function blocksNav(current: string) {
  const blocks = await listBlocks();
  const used = new Set(blocks.flatMap((b) => b.categories));
  const links = [{ name: 'Featured', slug: '' }, ...BLOCK_CATEGORIES.filter((c) => !c.hidden && used.has(c.slug))];
  return html`<nav aria-label="Block categories" class="relative overflow-hidden">
    <div class="no-scrollbar max-w-none overflow-x-auto">
      <div class="flex items-center">
        ${links.map((c) => {
          const href = c.slug ? `/ui/blocks/${c.slug}` : '/ui/blocks';
          const active = c.slug === current;
          return html`<a href=${href} class=${NAV_LINK} data-active=${active ? 'true' : 'false'} aria-current=${active ? 'page' : nothing}>${c.name}</a>`;
        })}
      </div>
    </div>
  </nav>`;
}

/** A blocks page: the header, the nav with `current` active, then `content`. */
export async function blocksShell(pathname: string, current: string, content: unknown) {
  return html`
    ${styleLinks(pathname)}
    <main id="main" class="flex flex-1 flex-col">
      ${uiPageHeader({
        title: BLOCKS_TITLE,
        description: BLOCKS_DESCRIPTION,
        actions: html`<span class="style-luma contents">
          <a href="#blocks" data-slot="button" class=${cn(buttonClass(), 'h-[35px] no-underline')}>Browse Blocks</a>
          <a href="/ui/docs/components" data-slot="button" class=${cn(buttonClass({ variant: 'secondary' }), 'no-underline')}>View Components</a>
        </span>`,
      })}
      ${pageNav(html`
        ${await blocksNav(current)}
        <span class="style-new-york contents">
          <a href="/ui/blocks/sidebar" data-slot="button" class=${cn(buttonClass({ variant: 'secondary', size: 'sm' }), 'mr-7 hidden shadow-none no-underline lg:flex')}>Browse all blocks</a>
        </span>
      `, { id: 'blocks' })}
      <div class="container-wrapper flex-1 section-soft md:py-12">
        <div class="container style-new-york">${content}</div>
      </div>
    </main>
  `;
}
