import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  sidebarContentClass, sidebarGroupClass, sidebarGroupLabelClass, sidebarGroupContentClass,
  sidebarMenuClass, sidebarMenuItemClass, sidebarMenuButtonClass,
} from '#modules/ui/components/sidebar.ts';
import { SECTIONS, NAV, type DocLink } from '#modules/ui/docs/nav.ts';

/**
 * The /ui docs sidebar, shadcn's DocsSidebar (apps/v4/components/docs-sidebar.tsx)
 * as markup: a non-collapsible sidebar holding the Sections group and one
 * group per docs section, from the shared nav (modules/ui/docs/nav.ts).
 *
 * The active item is marked on the server from the request's path, and
 * <ui-docs-sidebar> (components/ui-docs-sidebar.ts) moves the mark on a soft
 * navigation, where this layout is not re-rendered.
 */

/** Pages listed under Sections and left out of their group, as shadcn does. */
const EXCLUDED = ['/ui/docs', '/ui/docs/changelog', '/ui/docs/rtl'];

const ITEM_BUTTON = 'relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium no-underline after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:border-accent data-[active=true]:bg-accent 3xl:fixed:w-full 3xl:fixed:max-w-48';

/** Whether a Sections link is active: the introduction exactly, the rest by prefix. */
export function sectionActive(href: string, pathname: string): boolean {
  return href === '/ui/docs' ? pathname === href : pathname === href || pathname.startsWith(href + '/');
}

function item(link: DocLink, active: boolean, prefix: boolean) {
  // The llms.txt entry is a text file, not a page, so the client router
  // leaves it to the browser rather than fetching it for a swap.
  const file = /\.txt$/.test(link.href);
  return html`
    <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
      <a href=${link.href} ?data-no-router=${file} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" data-active=${active ? 'true' : 'false'} data-match=${prefix ? 'prefix' : 'exact'} aria-current=${active ? 'page' : null} class=${cn(sidebarMenuButtonClass(), ITEM_BUTTON)}>
        <span class="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent"></span>
        ${link.title}
      </a>
    </li>`;
}

function group(title: string, cls: string, body: unknown) {
  return html`
    <div data-slot="sidebar-group" data-sidebar="group" class=${cn(sidebarGroupClass(), cls)}>
      <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${cn(sidebarGroupLabelClass(), 'font-medium text-muted-foreground')}>${title}</div>
      <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>${body}</div>
    </div>`;
}

export function docsSidebar(pathname: string) {
  return html`
    <ui-docs-sidebar data-slot="sidebar" class="sticky top-[calc(var(--header-height)+0.6rem)] z-30 hidden h-[calc(100svh-10rem)] w-(--sidebar-width) flex-col overflow-hidden overscroll-none bg-transparent text-sidebar-foreground [--sidebar-menu-width:--spacing(56)] lg:flex">
      <div class="absolute top-12 right-2 bottom-0 hidden h-full w-px bg-[linear-gradient(to_bottom,transparent_0%,var(--border)_10%,var(--border)_90%,transparent_100%)] lg:flex"></div>
      <nav aria-label="Docs" data-slot="sidebar-content" data-sidebar="content" data-docs-sidebar-content class=${cn(sidebarContentClass(), 'w-(--sidebar-menu-width) scroll-fade scrollbar-none overflow-x-hidden pl-2.5')}>
        ${group('Sections', 'pt-12', html`
          <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
            ${SECTIONS.map((l) => item(l, sectionActive(l.href, pathname), l.href !== '/ui/docs'))}
          </ul>`)}
        ${NAV.map((g) => group(g.title, '', html`
          <ul data-slot="sidebar-menu" data-sidebar="menu" class=${cn(sidebarMenuClass(), 'gap-0.5')}>
            ${g.items.filter((l) => !EXCLUDED.includes(l.href)).map((l) => item(l, l.href === pathname, false))}
          </ul>`))}
      </nav>
    </ui-docs-sidebar>`;
}
