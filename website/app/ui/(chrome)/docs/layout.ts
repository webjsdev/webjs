import { html } from '@webjsdev/core';
import type { LayoutProps } from '@webjsdev/core';
import '#components/ui-docs-sidebar.ts';
import { docsSidebar } from '#lib/ui/docs/sidebar.ts';

/**
 * The /ui docs layout, shadcn's apps/v4/app/(app)/docs/layout.tsx (#1666): a
 * grid of the sticky docs sidebar and the page, inside the site container.
 *
 * The chrome (header, sidebar, copy and navigation buttons) renders in the
 * new-york style, as shadcn's site does with its new-york-v4 parts. A page's
 * component previews set their own style wrapper.
 */
export default function UiDocsLayout({ children, url }: LayoutProps) {
  const { pathname } = new URL(url);
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return html`
    <div class="style-new-york container-wrapper flex flex-1 flex-col px-2">
      <div data-slot="sidebar-wrapper" style="--sidebar-width: calc(var(--spacing) * 72)" class="group/sidebar-wrapper flex min-h-min w-full flex-1 items-start px-0 [--top-spacing:0] lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] lg:[--top-spacing:calc(var(--spacing)*4)] 3xl:fixed:container 3xl:fixed:px-3">
        ${docsSidebar(path)}
        <div class="h-full w-full">${children}</div>
      </div>
    </div>
  `;
}
