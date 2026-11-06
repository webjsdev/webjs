import { html } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';
import '#components/docs-drawer.ts';
import '#components/code-block.ts';
import { docsShell } from '#lib/ui/docs-shell.ts';
import { loadRegistryIndex } from '#modules/ui/queries/registry.server.ts';
import { splitByTier } from '#modules/ui/utils/tier.ts';

/**
 * The interim component gallery's sidebar shell (#1666).
 *
 * The gallery pages (/ui/docs and /ui/<name>) keep the sidebar they had
 * before the /ui chrome was rebuilt, inside this route group, so the home
 * page above it renders full width the way shadcn's does. The /ui docs
 * layout replaces this group later in #1666.
 */
export default async function UiGalleryLayout({ children }: LayoutProps) {
  const all = await loadRegistryIndex();
  const { tier1, tier2 } = splitByTier(all.filter((i) => i.type === 'registry:ui'));
  // The gallery's previews render in the kit's default look.
  return html`<div class="style-new-york contents">${docsShell({
    nav: [
      { title: 'Getting Started', items: [{ href: '/ui/docs', label: 'Introduction' }] },
      { title: 'Tier 1', count: tier1.length, items: tier1.map((c) => ({ href: `/ui/${c.name}`, label: c.name })) },
      { title: 'Tier 2', count: tier2.length, items: tier2.map((c) => ({ href: `/ui/${c.name}`, label: c.name })) },
    ],
    label: 'Component library',
    menuLabel: 'Components menu',
    // No prose wrapper: the component pages carry live previews that the
    // unlayered .prose-docs rules would restyle. Pages wrap their genuinely
    // prose regions themselves.
    contentClass: '',
    children,
  })}</div>`;
}
