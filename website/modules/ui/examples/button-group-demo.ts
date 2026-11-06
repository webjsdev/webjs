import { html } from '@webjsdev/core';
import { cn } from '#lib/utils/cn.ts';
import { buttonClass } from '#modules/ui/components/button.ts';
import { buttonGroupClass } from '#modules/ui/components/button-group.ts';
import {
  ArchiveIcon, ArrowLeftIcon, CalendarPlusIcon, ClockIcon, ListFilterIcon,
  MailCheckIcon, MoreHorizontalIcon, TagIcon, Trash2Icon,
} from '#lib/ui/lucide.ts';

export default function ButtonGroupDemo() {
  return html`
    <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${cn(buttonGroupClass(), 'hidden sm:flex')}>
        <button type="button" data-slot="button" data-variant="outline" data-size="icon" aria-label="Go Back" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
          ${ArrowLeftIcon()}
        </button>
      </div>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Archive</button>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Report</button>
      </div>
      <div role="group" data-slot="button-group" data-orientation="horizontal" class=${buttonGroupClass()}>
        <button type="button" data-slot="button" data-variant="outline" data-size="default" class=${buttonClass({ variant: 'outline' })}>Snooze</button>
        <button type="button" id="button-group-demo-more" data-slot="button" data-variant="outline" data-size="icon" aria-label="More Options" class=${buttonClass({ variant: 'outline', size: 'icon' })}>
          ${MoreHorizontalIcon()}
        </button>
      </div>
    </div>
    <ui-dropdown-menu trigger="button-group-demo-more" class="absolute">
      <ui-dropdown-menu-content align="end" class="w-40">
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item>
            ${MailCheckIcon()}
            Mark as Read
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${ArchiveIcon()}
            Archive
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item>
            ${ClockIcon()}
            Snooze
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${CalendarPlusIcon()}
            Add to Calendar
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-item>
            ${ListFilterIcon()}
            Add to List
          </ui-dropdown-menu-item>
          <ui-dropdown-menu-sub>
            <ui-dropdown-menu-sub-trigger>
              ${TagIcon()}
              Label As...
            </ui-dropdown-menu-sub-trigger>
            <ui-dropdown-menu-sub-content>
              <ui-dropdown-menu-group aria-label="Label As">
                <ui-dropdown-menu-item type="radio" value="personal" checked>Personal</ui-dropdown-menu-item>
                <ui-dropdown-menu-item type="radio" value="work">Work</ui-dropdown-menu-item>
                <ui-dropdown-menu-item type="radio" value="other">Other</ui-dropdown-menu-item>
              </ui-dropdown-menu-group>
            </ui-dropdown-menu-sub-content>
          </ui-dropdown-menu-sub>
        </ui-dropdown-menu-group>
        <ui-dropdown-menu-separator></ui-dropdown-menu-separator>
        <ui-dropdown-menu-group>
          <ui-dropdown-menu-item variant="destructive">
            ${Trash2Icon()}
            Trash
          </ui-dropdown-menu-item>
        </ui-dropdown-menu-group>
      </ui-dropdown-menu-content>
    </ui-dropdown-menu>
  `;
}
