/**
 * The sidebar-15 date picker: the kit's `<ui-calendar>` with month and year
 * dropdowns, in a sidebar group. A fragment helper; the calendar is rendered
 * by the server and picking a day needs JavaScript. Ported from shadcn/ui's
 * sidebar-15.
 *
 * It opens on the 12th of the current month, as shadcn's does. Listen for
 * `ui-value-change` on the calendar, or give it a `name` inside a form, to use
 * the chosen date.
 */
import { html } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import '../../../components/calendar.ts';
import { sidebarGroupClass, sidebarGroupContentClass } from '../../../components/sidebar.ts';

export function datePicker() {
  const now = new Date();
  const value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-12`;
  return html`
    <div data-slot="sidebar-group" data-sidebar="group" class=${cn(sidebarGroupClass(), 'px-0')}>
      <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${sidebarGroupContentClass()}>
        <ui-calendar mode="single" value=${value} caption-layout="dropdown" class="**:data-[slot=calendar]:bg-transparent **:data-[slot=calendar]:[--cell-size:2.1rem]"></ui-calendar>
      </div>
    </div>
  `;
}
