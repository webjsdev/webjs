/**
 * The sidebar-07 app sidebar: a team switcher, the main nav with collapsible
 * sections, the projects list and the signed-in user, in a sidebar that
 * collapses to icons (Ctrl+B or Cmd+B, the trigger, or the rail). A fragment
 * helper, so the markup is rendered by the server; the sidebar, its rail and
 * the menus are the kit's elements. Ported from shadcn/ui's sidebar-07.
 *
 * The data below is sample data. Replace it with your own, and point each
 * `url` at a real route.
 */
import { html } from '@webjsdev/core';
import {
  sidebarContentClass,
  sidebarFooterClass,
  sidebarHeaderClass,
} from '../../../components/sidebar.ts';
import { navMain, type NavMainItem } from './nav-main.ts';
import { navProjects, type NavProject } from './nav-projects.ts';
import { navUser } from './nav-user.ts';
import { teamSwitcher, type Team } from './team-switcher.ts';
import { AudioLinesIcon, BookOpenIcon, BotIcon, FrameIcon, GalleryVerticalEndIcon, MapIcon, PieChartIcon, Settings2Icon, TerminalIcon, TerminalSquareIcon } from '../../../lib/icons.ts';

// This is sample data.
const data: {
  user: { name: string; email: string; avatar: string };
  teams: Team[];
  navMain: NavMainItem[];
  projects: NavProject[];
} = {
  user: {
    name: 'vivek',
    email: 'vivek@example.com',
    avatar: 'https://webjs.dev/public/avatars/vivek.jpg',
  },
  teams: [
    { name: 'Acme Inc', logo: GalleryVerticalEndIcon, plan: 'Enterprise' },
    { name: 'Acme Corp.', logo: AudioLinesIcon, plan: 'Startup' },
    { name: 'Evil Corp.', logo: TerminalIcon, plan: 'Free' },
  ],
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
  projects: [
    { name: 'Design Engineering', url: '#', icon: FrameIcon },
    { name: 'Sales & Marketing', url: '#', icon: PieChartIcon },
    { name: 'Travel', url: '#', icon: MapIcon },
  ],
};

export function appSidebar() {
  return html`
    <ui-sidebar collapsible="icon">
      <div data-slot="sidebar-header" data-sidebar="header" class=${sidebarHeaderClass()}>
        ${teamSwitcher({ teams: data.teams })}
      </div>
      <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
        ${navMain({ items: data.navMain })}
        ${navProjects({ projects: data.projects })}
      </div>
      <div data-slot="sidebar-footer" data-sidebar="footer" class=${sidebarFooterClass()}>
        ${navUser({ user: data.user })}
      </div>
      <ui-sidebar-rail></ui-sidebar-rail>
    </ui-sidebar>
  `;
}
