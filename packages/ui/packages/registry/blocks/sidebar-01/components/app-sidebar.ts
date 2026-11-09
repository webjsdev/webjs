/**
 * The sidebar-01 app sidebar: a version switcher and a search field in the
 * header, then one group per docs section with its pages as links. A
 * fragment helper, so the markup is rendered by the server; the sidebar, its
 * rail and the version menu are the kit's elements. Ported from shadcn/ui's
 * sidebar-01.
 *
 * The data below is sample data. Replace it with your own, point each `url`
 * at a real route, and mark the current page with `isActive`.
 */
import { html, nothing } from '@webjsdev/core';
import {
  sidebarContentClass,
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarGroupLabelClass,
  sidebarHeaderClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';
import { searchForm } from './search-form.ts';
import { versionSwitcher } from './version-switcher.ts';

interface NavSection {
  title: string;
  url: string;
  items: { title: string; url: string; isActive?: boolean }[];
}

// This is sample data.
const data: { versions: string[]; navMain: NavSection[] } = {
  versions: ['1.0.1', '1.1.0-alpha', '2.0.0-beta1'],
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
  ],
};

export function appSidebar() {
  return html`
    <ui-sidebar>
      <div data-slot="sidebar-header" data-sidebar="header" class=${sidebarHeaderClass()}>
        ${versionSwitcher({ versions: data.versions, defaultVersion: data.versions[0] })}
        ${searchForm()}
      </div>
      <nav aria-label="Docs" data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
        ${data.navMain.map((section) => html`
          <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
            <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>${section.title}</div>
            <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
              <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
                ${section.items.map((item) => html`
                  <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                    <a href=${item.url} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" data-active=${item.isActive ? 'true' : 'false'} aria-current=${item.isActive ? 'page' : nothing} class=${sidebarMenuButtonClass()}>${item.title}</a>
                  </li>
                `)}
              </ul>
            </div>
          </div>
        `)}
      </nav>
      <ui-sidebar-rail></ui-sidebar-rail>
    </ui-sidebar>
  `;
}
