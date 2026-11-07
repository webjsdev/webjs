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

const Settings2Icon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 17H5"></path><path d="M19 7h-9"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>`;
const FileTextIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>`;
const LinkIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
const CopyIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>`;
const CornerUpRightIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"></path><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>`;
const Trash2Icon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
const CornerUpLeftIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path><path d="M9 14 4 9l5-5"></path></svg>`;
const ChartLineIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v16a2 2 0 0 0 2 2h16"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>`;
const GalleryVerticalEndIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 2h10"></path><path d="M5 6h14"></path><rect width="18" height="12" x="3" y="10" rx="2"></rect></svg>`;
const TrashIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
const BellIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>`;
const ArrowUpIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path></svg>`;
const ArrowDownIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path></svg>`;
const StarIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path></svg>`;
const MoreHorizontalIcon = (cls = '') => html`<svg class=${cls || null} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>`;

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
