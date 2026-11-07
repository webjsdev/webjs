/**
 * The sidebar-15 right sidebar: the signed-in user, a calendar, the list of
 * calendars and a "New Calendar" button, in a sidebar that does not collapse
 * and shows from the large breakpoint up. A fragment helper, so the markup is
 * rendered by the server. Ported from shadcn/ui's sidebar-15.
 *
 * The data below is sample data. Replace it with your own.
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
  sidebarSeparatorClass,
} from '../../../components/sidebar.ts';
import { calendars } from './calendars.ts';
import { datePicker } from './date-picker.ts';
import { navUser } from './nav-user.ts';

const PlusIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;

// This is sample data.
const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: 'https://github.com/shadcn.png',
  },
  calendars: [
    { name: 'My Calendars', items: ['Personal', 'Work', 'Family'] },
    { name: 'Favorites', items: ['Holidays', 'Birthdays'] },
    { name: 'Other', items: ['Travel', 'Reminders', 'Deadlines'] },
  ],
};

export function sidebarRight() {
  return html`
    <ui-sidebar collapsible="none" class="sticky top-0 hidden h-svh border-l lg:flex">
      <div data-slot="sidebar-header" data-sidebar="header" class=${cn(sidebarHeaderClass(), 'h-16 border-b border-sidebar-border')}>
        ${navUser({ user: data.user })}
      </div>
      <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
        ${datePicker()}
        <div role="none" data-slot="sidebar-separator" data-sidebar="separator" data-orientation="horizontal" class=${cn(sidebarSeparatorClass(), 'mx-0')}></div>
        ${calendars({ calendars: data.calendars })}
      </div>
      <div data-slot="sidebar-footer" data-sidebar="footer" class=${sidebarFooterClass()}>
        <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
          <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
            <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${sidebarMenuButtonClass()}>
              ${PlusIcon()}
              <span>New Calendar</span>
            </button>
          </li>
        </ul>
      </div>
    </ui-sidebar>
  `;
}
