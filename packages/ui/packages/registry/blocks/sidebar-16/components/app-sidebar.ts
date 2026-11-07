/**
 * The sidebar-16 app sidebar: the company, the main nav with collapsible
 * sections, the projects list, a secondary nav and the signed-in user, in a
 * sidebar that starts below the sticky site header. A fragment helper, so the
 * markup is rendered by the server; the sidebar and the menus are the kit's
 * elements. Ported from shadcn/ui's sidebar-16.
 *
 * The data below is sample data. Replace it with your own, and point each
 * `url` at a real route.
 */
import { html } from '@webjsdev/core';
import {
  sidebarContentClass,
  sidebarFooterClass,
  sidebarHeaderClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';
import { navMain, type NavMainItem } from './nav-main.ts';
import { navProjects, type NavProject } from './nav-projects.ts';
import { navSecondary, type NavSecondaryItem } from './nav-secondary.ts';
import { navUser } from './nav-user.ts';
import { BookOpenIcon, BotIcon, FrameIcon, LifeBuoyIcon, MapIcon, PieChartIcon, SendIcon, Settings2Icon, TerminalIcon, TerminalSquareIcon } from '../../../lib/icons.ts';

// This is sample data.
const data: {
  user: { name: string; email: string; avatar: string };
  navMain: NavMainItem[];
  navSecondary: NavSecondaryItem[];
  projects: NavProject[];
} = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: 'https://webjs.dev/public/avatars/vivek.jpg',
  },
  navMain: [
    {
      title: 'Playground',
      url: '#',
      icon: TerminalSquareIcon,
      isActive: true,
      items: [
        { title: 'History', url: '#' },
        { title: 'Starred', url: '#' },
        { title: 'Settings', url: '#' },
      ],
    },
    {
      title: 'Models',
      url: '#',
      icon: BotIcon,
      items: [
        { title: 'Genesis', url: '#' },
        { title: 'Explorer', url: '#' },
        { title: 'Quantum', url: '#' },
      ],
    },
    {
      title: 'Documentation',
      url: '#',
      icon: BookOpenIcon,
      items: [
        { title: 'Introduction', url: '#' },
        { title: 'Get Started', url: '#' },
        { title: 'Tutorials', url: '#' },
        { title: 'Changelog', url: '#' },
      ],
    },
    {
      title: 'Settings',
      url: '#',
      icon: Settings2Icon,
      items: [
        { title: 'General', url: '#' },
        { title: 'Team', url: '#' },
        { title: 'Billing', url: '#' },
        { title: 'Limits', url: '#' },
      ],
    },
  ],
  navSecondary: [
    { title: 'Support', url: '#', icon: LifeBuoyIcon },
    { title: 'Feedback', url: '#', icon: SendIcon },
  ],
  projects: [
    { name: 'Design Engineering', url: '#', icon: FrameIcon },
    { name: 'Sales & Marketing', url: '#', icon: PieChartIcon },
    { name: 'Travel', url: '#', icon: MapIcon },
  ],
};

export function appSidebar() {
  // shadcn's className lands on the sidebar's fixed container, which the
  // kit's <ui-sidebar> renders as its data-slot="sidebar-container" child.
  return html`
    <ui-sidebar class="[&>[data-slot=sidebar-container]]:top-(--header-height) [&>[data-slot=sidebar-container]]:h-[calc(100svh-var(--header-height))]!">
      <div data-slot="sidebar-header" data-sidebar="header" class=${sidebarHeaderClass()}>
        <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
            <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="lg" class=${sidebarMenuButtonClass({ size: 'lg' })}>
              <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                ${TerminalIcon('size-4')}
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">Acme Inc</span>
                <span class="truncate text-xs">Enterprise</span>
              </div>
            </a>
          </li>
        </ul>
      </div>
      <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
        ${navMain({ items: data.navMain })}
        ${navProjects({ projects: data.projects })}
        ${navSecondary({ items: data.navSecondary, class: 'mt-auto' })}
      </div>
      <div data-slot="sidebar-footer" data-sidebar="footer" class=${sidebarFooterClass()}>
        ${navUser({ user: data.user })}
      </div>
    </ui-sidebar>
  `;
}
