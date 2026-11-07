/**
 * The dashboard-01 app sidebar: the brand, the main nav with "Quick Create",
 * the documents list, the secondary links pinned to the bottom, and the
 * signed-in user, in an inset sidebar that slides off canvas (Ctrl+B or
 * Cmd+B, or the header's trigger). A fragment helper, so the markup is
 * rendered by the server; the sidebar and the menus are the kit's elements.
 * Ported from shadcn/ui's dashboard-01.
 *
 * The data below is sample data. Replace it with your own, and point each
 * `url` at a real route.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  sidebarContentClass,
  sidebarFooterClass,
  sidebarHeaderClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';
import { navDocuments, type NavDocument } from './nav-documents.ts';
import { navMain, type NavMainItem } from './nav-main.ts';
import { navSecondary, type NavSecondaryItem } from './nav-secondary.ts';
import { navUser } from './nav-user.ts';
import { ChartBarIcon, CircleHelpIcon, CommandIcon, DatabaseIcon, FileChartColumnIcon, FileIcon, FolderIcon, LayoutDashboardIcon, ListIcon, SearchIcon, Settings2Icon, UsersIcon } from '../../../lib/icons.ts';

// This is sample data.
const data: {
  user: { name: string; email: string; avatar: string };
  navMain: NavMainItem[];
  navSecondary: NavSecondaryItem[];
  documents: NavDocument[];
} = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: 'https://webjs.dev/public/avatars/vivek.jpg',
  },
  navMain: [
    { title: 'Dashboard', url: '#', icon: LayoutDashboardIcon },
    { title: 'Lifecycle', url: '#', icon: ListIcon },
    { title: 'Analytics', url: '#', icon: ChartBarIcon },
    { title: 'Projects', url: '#', icon: FolderIcon },
    { title: 'Team', url: '#', icon: UsersIcon },
  ],
  navSecondary: [
    { title: 'Settings', url: '#', icon: Settings2Icon },
    { title: 'Get Help', url: '#', icon: CircleHelpIcon },
    { title: 'Search', url: '#', icon: SearchIcon },
  ],
  documents: [
    { name: 'Data Library', url: '#', icon: DatabaseIcon },
    { name: 'Reports', url: '#', icon: FileChartColumnIcon },
    { name: 'Word Assistant', url: '#', icon: FileIcon },
  ],
};

/**
 * The sidebar. shadcn's page widens it to 18rem through the provider's
 * `--sidebar-width`; the kit's provider sets its own on the wrapper it
 * renders, so the width rides on the sidebar itself here.
 */
export function appSidebar(opts: { variant?: 'sidebar' | 'floating' | 'inset' } = {}) {
  return html`
    <ui-sidebar collapsible="offcanvas" variant=${opts.variant ?? 'sidebar'} class="[--sidebar-width:calc(var(--spacing)*72)]">
      <div data-slot="sidebar-header" data-sidebar="header" class=${sidebarHeaderClass()}>
        <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
            <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${cn(sidebarMenuButtonClass(), 'data-[slot=sidebar-menu-button]:p-1.5!')}>
              ${CommandIcon('size-5!')}
              <span class="text-base font-semibold">Acme Inc.</span>
            </a>
          </li>
        </ul>
      </div>
      <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
        ${navMain({ items: data.navMain })}
        ${navDocuments({ items: data.documents })}
        ${navSecondary({ items: data.navSecondary, class: 'mt-auto' })}
      </div>
      <div data-slot="sidebar-footer" data-sidebar="footer" class=${sidebarFooterClass()}>
        ${navUser({ user: data.user })}
      </div>
    </ui-sidebar>
  `;
}
