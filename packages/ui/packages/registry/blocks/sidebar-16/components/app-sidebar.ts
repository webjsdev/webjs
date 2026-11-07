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

const SquareTerminalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 11 2-2-2-2"></path><path d="M11 13h4"></path><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect></svg>`;
const BotIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>`;
const BookOpenIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg>`;
const Settings2Icon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 17H5"></path><path d="M19 7h-9"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>`;
const LifeBuoyIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="m4.93 4.93 4.24 4.24"></path><path d="m14.83 9.17 4.24-4.24"></path><path d="m14.83 14.83 4.24 4.24"></path><path d="m9.17 14.83-4.24 4.24"></path><circle cx="12" cy="12" r="4"></circle></svg>`;
const SendIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path></svg>`;
const FrameIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" x2="2" y1="6" y2="6"></line><line x1="22" x2="2" y1="18" y2="18"></line><line x1="6" x2="6" y1="2" y2="22"></line><line x1="18" x2="18" y1="2" y2="22"></line></svg>`;
const PieChartIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"></path><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path></svg>`;
const MapIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"></path><path d="M15 5.764v15"></path><path d="M9 3.236v15"></path></svg>`;
const TerminalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19h8"></path><path d="m4 17 6-6-6-6"></path></svg>`;

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
    avatar: 'https://github.com/shadcn.png',
  },
  navMain: [
    {
      title: 'Playground',
      url: '#',
      icon: SquareTerminalIcon,
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
