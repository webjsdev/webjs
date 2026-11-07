/**
 * The sidebar-12 calendars list: one collapsible group per set of calendars,
 * each calendar a menu button with a check box drawn beside its name. A
 * fragment helper; each group is a native `<details>`, so it opens and closes
 * with no JavaScript. Ported from shadcn/ui's sidebar-12.
 *
 * The boxes are decoration, as in shadcn: the first two calendars of a group
 * render checked. Turn each button into a real control (a checkbox in a form,
 * or a link that toggles the calendar) when you wire it to your data.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { collapsibleClass, collapsibleContentClass } from '../../../components/collapsible.ts';
import {
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarGroupLabelClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
  sidebarSeparatorClass,
} from '../../../components/sidebar.ts';

const ChevronRightIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;
const CheckIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>`;

export function calendars({ calendars }: { calendars: { name: string; items: string[] }[] }) {
  return calendars.map((calendar, index) => html`
    <div data-slot="sidebar-group" data-sidebar="group" class=${sidebarGroupClass()}>
      <details data-slot="collapsible" class=${cn(collapsibleClass(), 'group/collapsible')} ?open=${index === 0}>
        <summary data-slot="sidebar-group-label" data-sidebar="group-label" class=${cn(sidebarGroupLabelClass(), 'group/label w-full cursor-pointer list-none text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&::-webkit-details-marker]:hidden')}>
          ${calendar.name}
          ${ChevronRightIcon('ml-auto transition-transform group-open/collapsible:rotate-90')}
        </summary>
        <div data-slot="collapsible-content" class=${collapsibleContentClass()}>
          <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
            <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
              ${calendar.items.map((item, i) => html`
                <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                  <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${sidebarMenuButtonClass()}>
                    <div data-active=${i < 2 ? 'true' : 'false'} class="group/calendar-item flex aspect-square size-4 shrink-0 items-center justify-center rounded-sm border border-sidebar-border text-sidebar-primary-foreground data-[active=true]:border-sidebar-primary data-[active=true]:bg-sidebar-primary">
                      ${CheckIcon('hidden size-3 group-data-[active=true]/calendar-item:block')}
                    </div>
                    ${item}
                  </button>
                </li>
              `)}
            </ul>
          </div>
        </div>
      </details>
    </div>
    <div role="none" data-slot="sidebar-separator" data-sidebar="separator" data-orientation="horizontal" class=${cn(sidebarSeparatorClass(), 'mx-0')}></div>
  `);
}
