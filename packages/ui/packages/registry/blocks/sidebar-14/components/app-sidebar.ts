/**
 * The sidebar-14 app sidebar: a "Table of Contents" group listing each
 * section as a link with its pages in a submenu, always open. A fragment
 * helper, so the markup is rendered by the server; the sidebar and its rail
 * are the kit's elements. Ported from shadcn/ui's sidebar-14.
 *
 * The data below is sample data. Replace it with your own, point each `url`
 * at a real route, and mark the current page from your router.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  sidebarContentClass,
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarGroupLabelClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
  sidebarMenuSubButtonClass,
  sidebarMenuSubClass,
  sidebarMenuSubItemClass,
} from '../../../components/sidebar.ts';

interface NavSection {
  title: string;
  url: string;
  items?: { title: string; url: string; isActive?: boolean }[];
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
      items: [{ title: 'Contribution Guide', url: '#' }],
    },
  ],
};

export function appSidebar(opts: { side?: 'left' | 'right' } = {}) {
  return html`
    <ui-sidebar side=${opts.side ?? 'left'}>
      <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
        <nav aria-label="Table of Contents" data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
          <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>Table of Contents</div>
          <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
            <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
              ${data.navMain.map((item) => html`
                <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                  <a href=${item.url} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${cn(sidebarMenuButtonClass(), 'font-medium')}>${item.title}</a>
                  ${item.items?.length
                    ? html`<ul data-slot="sidebar-menu-sub" data-sidebar="menu-sub" class=${sidebarMenuSubClass()}>
                        ${item.items.map((sub) => html`
                          <li data-slot="sidebar-menu-sub-item" data-sidebar="menu-sub-item" class=${sidebarMenuSubItemClass()}>
                            <a href=${sub.url} data-slot="sidebar-menu-sub-button" data-sidebar="menu-sub-button" data-size="md" data-active=${sub.isActive ? 'true' : 'false'} aria-current=${sub.isActive ? 'page' : null} class=${sidebarMenuSubButtonClass()}>${sub.title}</a>
                          </li>
                        `)}
                      </ul>`
                    : ''}
                </li>
              `)}
            </ul>
          </div>
        </nav>
      </div>
      <ui-sidebar-rail></ui-sidebar-rail>
    </ui-sidebar>
  `;
}
