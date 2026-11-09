/**
 * The sidebar-03 app sidebar: the docs logo and version in the header, then
 * each docs section as a menu item with its pages in a submenu. A fragment
 * helper, so the markup is rendered by the server; the sidebar and its rail
 * are the kit's elements. Ported from shadcn/ui's sidebar-03.
 *
 * The data below is sample data. Replace it with your own, point each `url`
 * at a real route, and mark the current page with `isActive`.
 */
import { html, nothing } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  sidebarContentClass,
  sidebarGroupClass,
  sidebarHeaderClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
  sidebarMenuSubButtonClass,
  sidebarMenuSubClass,
  sidebarMenuSubItemClass,
} from '../../../components/sidebar.ts';
import { GalleryVerticalEndIcon } from '../../../lib/icons.ts';

interface NavSection {
  title: string;
  url: string;
  items: { title: string; url: string; isActive?: boolean }[];
}

// This is sample data.
const data: { navMain: NavSection[] } = {
  navMain: [
    {
      title: 'Getting Started',
      url: '#',
      items: [
        { title: 'Installation', url: '#' },
        { title: 'Project Structure', url: '#' },
      ],
    },
    {
      title: 'Build Your Application',
      url: '#',
      items: [
        { title: 'Routing', url: '#' },
        { title: 'Data Fetching', url: '#', isActive: true },
        { title: 'Rendering', url: '#' },
        { title: 'Caching', url: '#' },
        { title: 'Styling', url: '#' },
        { title: 'Optimizing', url: '#' },
        { title: 'Configuring', url: '#' },
        { title: 'Testing', url: '#' },
        { title: 'Authentication', url: '#' },
        { title: 'Deploying', url: '#' },
        { title: 'Upgrading', url: '#' },
        { title: 'Examples', url: '#' },
      ],
    },
    {
      title: 'API Reference',
      url: '#',
      items: [
        { title: 'Components', url: '#' },
        { title: 'File Conventions', url: '#' },
        { title: 'Functions', url: '#' },
        { title: 'next.config.js Options', url: '#' },
        { title: 'CLI', url: '#' },
        { title: 'Edge Runtime', url: '#' },
      ],
    },
    {
      title: 'Architecture',
      url: '#',
      items: [
        { title: 'Accessibility', url: '#' },
        { title: 'Fast Refresh', url: '#' },
        { title: 'Next.js Compiler', url: '#' },
        { title: 'Supported Browsers', url: '#' },
        { title: 'Turbopack', url: '#' },
      ],
    },
    {
      title: 'Community',
      url: '#',
      items: [
        { title: 'Contribution Guide', url: '#' },
      ],
    },
  ],
};

export function appSidebar() {
  return html`
    <ui-sidebar>
      <div data-slot="sidebar-header" data-sidebar="header" class=${sidebarHeaderClass()}>
        <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
            <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="lg" class=${sidebarMenuButtonClass({ size: 'lg' })}>
              <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                ${GalleryVerticalEndIcon('size-4')}
              </div>
              <div class="flex flex-col gap-0.5 leading-none">
                <span class="font-medium">Documentation</span>
                <span>v1.0.0</span>
              </div>
            </a>
          </li>
        </ul>
      </div>
      <nav aria-label="Docs" data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
        <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
          <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
            ${data.navMain.map((section) => html`
              <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                <a href=${section.url} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${cn(sidebarMenuButtonClass(), 'font-medium')}>${section.title}</a>
                ${section.items.length ? html`
                  <ul data-slot="sidebar-menu-sub" data-sidebar="menu-sub" class=${sidebarMenuSubClass()}>
                    ${section.items.map((item) => html`
                      <li data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" class=${sidebarMenuSubItemClass()}>
                        <a href=${item.url} data-slot="sidebar-menu-sub-button" data-sidebar="menu-sub-button" data-size="md" data-active=${item.isActive ? 'true' : 'false'} aria-current=${item.isActive ? 'page' : nothing} class=${sidebarMenuSubButtonClass()}>${item.title}</a>
                      </li>
                    `)}
                  </ul>
                ` : ''}
              </li>
            `)}
          </ul>
        </div>
      </nav>
      <ui-sidebar-rail></ui-sidebar-rail>
    </ui-sidebar>
  `;
}
