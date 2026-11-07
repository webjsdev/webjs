import { html } from '@webjsdev/core';
import { NAV } from '#modules/ui/docs/nav.ts';
import { docsPage, heading, type TocEntry } from '#lib/ui/docs/page.ts';

export const metadata = {
  title: 'Components | WebJs UI',
};

/**
 * /ui/docs/components, shadcn's components index
 * (content/docs/components/index.mdx and components/components-list.tsx):
 * every component page as a link, in the sidebar's order.
 *
 * shadcn's page also lists its newest components first and closes with a
 * pointer to the registry directory. Nothing here is flagged new yet and the
 * directory has no page yet, so both wait for the step that adds them.
 */
export default function ComponentsIndex() {
  const components = NAV.find((g) => g.title === 'Components')?.items ?? [];
  const toc: TocEntry[] = [];
  const body = html`
    ${heading(toc, 2, 'All Components')}
    <div data-not-typeset class="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-x-8 lg:gap-x-16 lg:gap-y-6 xl:gap-x-20">
      ${components.map((c) => html`<a href=${c.href} class="inline-flex items-center gap-2 text-lg font-medium underline-offset-4 hover:underline md:text-base">${c.title}</a>`)}
    </div>
  `;
  return docsPage({
    href: '/ui/docs/components',
    title: 'Components',
    description: 'Here you can find all the components available in the library. We are working on adding more components.',
    toc,
    body,
  });
}
