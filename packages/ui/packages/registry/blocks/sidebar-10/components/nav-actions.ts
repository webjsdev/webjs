/**
 * The sidebar-10 page actions: the last-edited date, a favourite button and a
 * "More" button opening a menu of page actions, laid out as a small sidebar
 * in a popover. A fragment helper; the popover is the native Popover API, so
 * it opens, light-dismisses and closes on Escape with no JavaScript. Ported
 * from shadcn/ui's sidebar-10.
 *
 * shadcn opens the popover once the page has mounted. Here it starts closed,
 * since a native popover cannot be open in server-rendered HTML. The actions
 * are placeholders: make each one a link or a form posting to an action.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import { buttonClass } from '../../../components/button.ts';
import { popoverContentClass } from '../../../components/popover.ts';
import {
  sidebarContentClass,
  sidebarGroupClass,
  sidebarGroupContentClass,
  sidebarMenuButtonClass,
  sidebarMenuClass,
  sidebarMenuItemClass,
} from '../../../components/sidebar.ts';
import { ArrowDownIcon, ArrowUpIcon, BellIcon, ChartLineIcon, CopyIcon, CornerUpLeftIcon, CornerUpRightIcon, FileTextIcon, GalleryVerticalEndIcon, LinkIcon, MoreHorizontalIcon, Settings2Icon, StarIcon, Trash2Icon, TrashIcon } from '../../../lib/icons.ts';

const data: { label: string; icon: (cls?: string) => TemplateResult }[][] = [
  [
    { label: 'Customize Page', icon: Settings2Icon },
    { label: 'Turn into wiki', icon: FileTextIcon },
  ],
  [
    { label: 'Copy Link', icon: LinkIcon },
    { label: 'Duplicate', icon: CopyIcon },
    { label: 'Move to', icon: CornerUpRightIcon },
    { label: 'Move to Trash', icon: Trash2Icon },
  ],
  [
    { label: 'Undo', icon: CornerUpLeftIcon },
    { label: 'View analytics', icon: ChartLineIcon },
    { label: 'Version History', icon: GalleryVerticalEndIcon },
    { label: 'Show delete pages', icon: TrashIcon },
    { label: 'Notifications', icon: BellIcon },
  ],
  [
    { label: 'Import', icon: ArrowUpIcon },
    { label: 'Export', icon: ArrowDownIcon },
  ],
];

export function navActions() {
  return html`
    <div class="flex items-center gap-2 text-sm">
      <div class="hidden font-medium text-muted-foreground md:inline-block">Edit Oct 08</div>
      <button type="button" data-slot="button" aria-label="Add to favorites" class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'h-7 w-7')}>
        ${StarIcon()}
      </button>
      <button type="button" data-slot="button" popovertarget="nav-actions" aria-haspopup="dialog" aria-label="More actions" class=${cn(buttonClass({ variant: 'ghost', size: 'icon' }), 'h-7 w-7')}>
        ${MoreHorizontalIcon()}
      </button>
      <div id="nav-actions" popover role="dialog" aria-label="Page actions" data-slot="popover-content" class=${cn(popoverContentClass({ side: 'bottom', align: 'end' }), 'w-56 overflow-hidden rounded-lg p-0')}>
        <ui-sidebar collapsible="none" class="bg-transparent">
          <div data-slot="sidebar-content" data-sidebar="content" class=${sidebarContentClass()}>
            ${data.map((group) => html`
              <div data-slot="sidebar-group" data-sidebar="group" class=${cn(sidebarGroupClass(), 'border-b last:border-none')}>
                <div data-slot="sidebar-group-content" data-sidebar="group-content" class=${cn(sidebarGroupContentClass(), 'gap-0')}>
                  <ul data-slot="sidebar-menu" data-sidebar="menu" class=${sidebarMenuClass()}>
                    ${group.map((item) => html`
                      <li data-slot="sidebar-menu-item" data-sidebar="menu-item" class=${sidebarMenuItemClass()}>
                        <button type="button" data-slot="sidebar-menu-button" data-sidebar="menu-button" data-size="default" class=${sidebarMenuButtonClass()}>
                          ${item.icon()} <span>${item.label}</span>
                        </button>
                      </li>
                    `)}
                  </ul>
                </div>
              </div>
            `)}
          </div>
        </ui-sidebar>
      </div>
    </div>
  `;
}
