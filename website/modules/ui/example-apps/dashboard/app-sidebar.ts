import { html, svg } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import {
  sidebarContentClass,
  sidebarFooterClass,
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarGroupLabelClass,
  sidebarHeaderClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '#modules/ui/components/sidebar.ts';
import { navDocuments, type NavDocument } from '#modules/ui/blocks/dashboard-01/components/nav-documents.ts';
import { navSecondary, type NavSecondaryItem } from '#modules/ui/blocks/dashboard-01/components/nav-secondary.ts';
import { navUser } from '#modules/ui/blocks/dashboard-01/components/nav-user.ts';

/**
 * The /ui/examples/dashboard sidebar, shadcn/ui's
 * apps/v4/app/(app)/examples/dashboard/components/app-sidebar.tsx (#1666).
 *
 * It differs from the dashboard-01 block's sidebar in three ways the example
 * makes on purpose: it does not collapse (it sits inside the examples frame,
 * not against the viewport), its main nav is a "Home" group with no Quick
 * Create (that moves to the header), and its icons are Tabler's. The
 * documents, secondary and user parts are the block's own, imported as they
 * are.
 */

type Icon = (cls?: string) => TemplateResult;

// Tabler icons (3.34.1, MIT), as @tabler/icons-react renders them.
const tabler = (name: string, body: ReturnType<typeof svg>): Icon => (cls = '') =>
  html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class=${'tabler-icon tabler-icon-' + name + (cls ? ' ' + cls : '')}><path stroke="none" d="M0 0h24v24H0z" fill="none"></path>${body}</svg>`;

const IconDashboard = tabler('dashboard', svg`<path d="M12 13m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M13.45 11.55l2.05 -2.05"></path><path d="M6.4 20a9 9 0 1 1 11.2 0z"></path>`);
const IconListDetails = tabler('list-details', svg`<path d="M13 5h8"></path><path d="M13 9h5"></path><path d="M13 15h8"></path><path d="M13 19h5"></path><path d="M3 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path><path d="M3 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path>`);
const IconChartBar = tabler('chart-bar', svg`<path d="M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path><path d="M15 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path><path d="M9 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"></path><path d="M4 20h14"></path>`);
const IconFolder = tabler('folder', svg`<path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2"></path>`);
const IconUsers = tabler('users', svg`<path d="M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"></path><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path><path d="M21 21v-2a4 4 0 0 0 -3 -3.85"></path>`);
const IconSettings = tabler('settings', svg`<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"></path><path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"></path>`);
const IconHelp = tabler('help', svg`<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"></path><path d="M12 17l0 .01"></path><path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4"></path>`);
const IconSearch = tabler('search', svg`<path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"></path><path d="M21 21l-6 -6"></path>`);
const IconInnerShadowTop = tabler('inner-shadow-top', svg`<path d="M5.636 5.636a9 9 0 1 0 12.728 12.728a9 9 0 0 0 -12.728 -12.728z"></path><path d="M16.243 7.757a6 6 0 0 0 -8.486 0"></path>`);
const IconDatabase = tabler('database', svg`<path d="M12 6m-8 0a8 3 0 1 0 16 0a8 3 0 1 0 -16 0"></path><path d="M4 6v6a8 3 0 0 0 16 0v-6"></path><path d="M4 12v6a8 3 0 0 0 16 0v-6"></path>`);
const IconReport = tabler('report', svg`<path d="M8 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h5.697"></path><path d="M18 14v4h4"></path><path d="M18 11v-4a2 2 0 0 0 -2 -2h-2"></path><path d="M8 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"></path><path d="M18 18m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"></path><path d="M8 11h4"></path><path d="M8 15h3"></path>`);
const IconFileWord = tabler('file-word', svg`<path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2"></path><path d="M9 12l1.333 5l1.667 -4l1.667 4l1.333 -5"></path>`);

/** Tabler's filled circle-plus, the header's Quick Create icon. */
export const IconCirclePlusFilled = (cls = '') =>
  html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class=${'tabler-icon tabler-icon-circle-plus-filled' + (cls ? ' ' + cls : '')}><path d="M4.929 4.929a10 10 0 1 1 14.141 14.141a10 10 0 0 1 -14.14 -14.14zm8.071 4.071a1 1 0 1 0 -2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0 -2h-2v-2z"></path></svg>`;

const data: {
  user: { name: string; email: string; avatar: string };
  navMain: { title: string; url: string; icon: Icon }[];
  navSecondary: NavSecondaryItem[];
  documents: NavDocument[];
} = {
  user: { name: 'shadcn', email: 'm@example.com', avatar: '/public/avatars/vivek.jpg' },
  navMain: [
    { title: 'Dashboard', url: '#', icon: IconDashboard },
    { title: 'Lifecycle', url: '#', icon: IconListDetails },
    { title: 'Analytics', url: '#', icon: IconChartBar },
    { title: 'Projects', url: '#', icon: IconFolder },
    { title: 'Team', url: '#', icon: IconUsers },
  ],
  navSecondary: [
    { title: 'Settings', url: '#', icon: IconSettings },
    { title: 'Get Help', url: '#', icon: IconHelp },
    { title: 'Search', url: '#', icon: IconSearch },
  ],
  documents: [
    { name: 'Data Library', url: '#', icon: IconDatabase },
    { name: 'Reports', url: '#', icon: IconReport },
    { name: 'Word Assistant', url: '#', icon: IconFileWord },
  ],
};

/** The example's NavMain: a "Home" group of links. */
function navMain(items: typeof data.navMain) {
  return html`
    <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
      <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
        <div data-slot="sidebar-group-label" data-sidebar="group-label" class=${sidebarGroupLabelClass()}>Home</div>
        <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
          ${items.map((item) => html`
            <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
              <a href=${item.url} data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${sidebarMenuButtonClass()}>
                ${item.icon()}
                <span>${item.title}</span>
              </a>
            </li>`)}
        </ul>
      </div>
    </div>
  `;
}

export function appSidebar() {
  return html`
    <ui-sidebar collapsible="none" class="h-auto border-r [--sidebar-width:calc(var(--spacing)*64)]">
      <div data-slot="sidebar-header" data-sidebar="header" class=${cn(sidebarHeaderClass(), 'border-b')}>
        <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
            <a href="#" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${cn(sidebarMenuButtonClass(), 'data-[slot=sidebar-menu-button]:p-1.5!')}>
              ${IconInnerShadowTop('size-5!')}
              <span class="text-base font-semibold">Acme Inc.</span>
            </a>
          </li>
        </ul>
      </div>
      <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
        ${navMain(data.navMain)}
        ${navDocuments({ items: data.documents })}
        ${navSecondary({ items: data.navSecondary, class: 'mt-auto' })}
      </div>
      <div data-slot="sidebar-footer" data-sidebar="footer" class=${sidebarFooterClass()}>
        ${navUser({ user: data.user })}
      </div>
    </ui-sidebar>
  `;
}
