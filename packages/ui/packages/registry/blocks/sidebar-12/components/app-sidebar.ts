/**
 * The sidebar-12 app sidebar: the signed-in user, a calendar, the list of
 * calendars, and a "New Calendar" button. A fragment helper, so the markup is
 * rendered by the server; the sidebar and its rail are the kit's elements.
 * Ported from shadcn/ui's sidebar-12.
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
import { PlusIcon } from '../../../lib/icons.ts';

// This is sample data.
const data = {
  user: {
    name: 'vivek',
    email: 'vivek@example.com',
    avatar: 'https://webjs.dev/public/avatars/vivek.jpg',
  },
  calendars: [
    { name: 'My Calendars', items: ['Personal', 'Work', 'Family'] },
    { name: 'Favorites', items: ['Holidays', 'Birthdays'] },
    { name: 'Other', items: ['Travel', 'Reminders', 'Deadlines'] },
  ],
};

export function appSidebar() {
  return html`
    <ui-sidebar>
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
      <ui-sidebar-rail></ui-sidebar-rail>
    </ui-sidebar>
  `;
}
